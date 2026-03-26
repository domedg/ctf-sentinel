#!/usr/bin/env python3
import subprocess
import sys
import os
import re
import hashlib
import stat

# --- Configurazione Colori ANSI ---
C_BLUE = "\033[94m"
C_GREEN = "\033[92m"
C_YELLOW = "\033[93m"
C_RED = "\033[91m"
C_BOLD = "\033[1m"
C_CYAN = "\033[96m"
C_MAGENTA = "\033[95m"
C_END = "\033[0m"

full_output_buffer = ""

def clean_ansi(text):
    return re.sub(r'\033\[[0-9;]*m', '', text)

def get_file_hashes(filepath):
    """Calcola MD5 e SHA256 del binario."""
    sha256_hash = hashlib.sha256()
    md5_hash = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
                md5_hash.update(byte_block)
        return md5_hash.hexdigest(), sha256_hash.hexdigest()
    except Exception as e:
        return str(e), str(e)

def print_header(title, command, description, file_ptr=None):
    global full_output_buffer
    header = (
        f"\n{C_BLUE}{'='*80}{C_END}\n"
        f"{C_BOLD}{C_YELLOW}TARGET: {title}{C_END}\n"
        f"{C_GREEN}COMMAND: {C_END}{command}\n"
        f"{C_GREEN}INFO:    {C_END}{description}\n"
        f"{C_BLUE}{'-'*80}{C_END}"
    )
    print(header)
    full_output_buffer += header + "\n"
    if file_ptr:
        file_ptr.write(clean_ansi(header) + "\n")

def run_command(cmd, show_full=False, preview_lines=15, file_ptr=None, force_show=False):
    global full_output_buffer
    try:
        # Usiamo shell=True e uniamo stderr a stdout. 
        # Aggiungiamo '2>&1' per sicurezza extra nel comando shell.
        proc = subprocess.run(
            f"{cmd} 2>&1", 
            shell=True, 
            capture_output=True, 
            text=True
        )
        
        output = proc.stdout
        if not output or output.strip() == "":
            # Se è vuoto, stampiamo un feedback visivo leggero
            no_out = f"  {C_CYAN}[Nessun output rilevato]{C_END}\n"
            if show_full or force_show:
                print(no_out)
                full_output_buffer += no_out
            return

        lines = output.strip().split('\n')
        output_to_print = ""

        # Decidiamo cosa stampare
        if force_show or show_full or len(lines) <= preview_lines:
            for line in lines:
                output_to_print += f"  {line}\n"
        else:
            for line in lines[:preview_lines]:
                output_to_print += f"  {line}\n"
            output_to_print += f"\n{C_RED}[!] Output troncato ({len(lines)} righe totali).{C_END}\n"

        # Stampa a video e salva
        print(output_to_print, end="")
        full_output_buffer += output_to_print
        if file_ptr:
            file_ptr.write(clean_ansi(output_to_print))
            
    except Exception as e:
        err = f"{C_RED}Errore esecuzione: {e}{C_END}\n"
        print(err, end="")
        full_output_buffer += err

def get_sections(target):
    try:
        output = subprocess.check_output(f"readelf -S -W {target}", shell=True, stderr=subprocess.DEVNULL, text=True)
        return re.findall(r'\[\s*\d+\]\s+([\.\w\d_-]+)', output)
    except:
        return []

def find_secrets():
    global full_output_buffer
    print(f"\n{C_BOLD}{C_MAGENTA}{'#'*30} ANALISI MATCHING FINALE {'#'*30}{C_END}")
    clean_buf = clean_ansi(full_output_buffer)
    
    # Pattern espansi per includere Base64 e IP
    patterns = {
        "FLAG CCIT": r"CCIT\{.*?\}",
        "Generic Flag": r"flag\{.*?\}",
        "Credenziali": r"(?i)(password|passwd|secret|key|admin|root)[:=]\s*\S+",
        "Indirizzo IP": r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b",
        "Possibile Base64": r"(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/])" # Stringhe b64 > 40 char
    }
    found = False
    for label, regex in patterns.items():
        matches = re.findall(regex, clean_buf)
        if matches:
            found = True
            for m in set(matches):
                print(f"{C_GREEN}[+] TROVATA ({label}): {C_BOLD}{C_RED}{m}{C_END}")
    if not found:
        print(f"{C_YELLOW}[!] Nessun pattern rilevante trovato.{C_END}")

def main():
    # Gestione modalità automatica
    auto_mode = False
    target = None
    for arg in sys.argv[1:]:
        if arg in ["--noinput", "-q"]:
            auto_mode = True
        elif not target:
            target = arg

    if not target:
        print(f"{C_BOLD}{C_RED}Usage: python3 {sys.argv[0]} <binary_file> [--noinput]{C_END}")
        sys.exit(1)

    if not os.path.exists(target):
        print(f"{C_RED}File non trovato: {target}{C_END}")
        sys.exit(1)

    # --- AUTO-FIX PERMESSI DI ESECUZIONE ---
    st = os.stat(target)
    if not bool(st.st_mode & stat.S_IXUSR):
        print(f"{C_YELLOW}[!] Il file non è eseguibile. Aggiungo i permessi (+x) in automatico...{C_END}")
        os.chmod(target, st.st_mode | stat.S_IEXEC)
    # ---------------------------------------

    print(f"{C_BOLD}{C_CYAN}--- RECON AVANZATA IBRIDA: {target} ---{C_END}")

    # Calcolo immediato degli hash
    md5_val, sha256_val = get_file_hashes(target)
    print(f"{C_YELLOW}MD5:{C_END}    {md5_val}")
    print(f"{C_YELLOW}SHA256:{C_END} {sha256_val}")

    f_ptr = None
    if auto_mode:
        save_file = 'n'
        MODE_FULL = True
    else:
        save_file = input(f"\n{C_YELLOW}Salvare su file? (y/n): {C_END}").lower().strip()
        if save_file in ['y', 'yes']:
            fname = input(f"{C_YELLOW}Nome file: {C_END}").strip()
            try:
                f_ptr = open(fname, "w")
                f_ptr.write(f"Target: {target}\nMD5: {md5_val}\nSHA256: {sha256_val}\n\n")
            except Exception as e:
                print(f"{C_RED}Errore apertura file: {e}{C_END}")

        choice = input(f"{C_YELLOW}Output completo a video? (y/n): {C_END}").lower().strip()
        MODE_FULL = choice in ['y', 'yes']

    # --- FASE 1: ANALISI STATICA ---

    # 1. File info
    print_header("FILE INFO", f"file {target}", "Info architettura.", f_ptr)
    run_command(f"file {target}", show_full=True, file_ptr=f_ptr)

    # 1.5 LDD (Librerie dinamiche)
    print_header("SHARED LIBRARIES", f"ldd {target}", "Dipendenze dinamiche (libc).", f_ptr)
    run_command(f"ldd {target}", show_full=True, file_ptr=f_ptr)

    # 2. Checksec (Sempre visibile)
    print_header("CHECKSEC", f"checksec --file={target}", "Mitigazioni exploit.", f_ptr)
    run_command(f"checksec --file={target}", show_full=True, file_ptr=f_ptr, force_show=True)

    # 3. Strings
    print_header("STRINGS", f"strings -n 6 {target}", "Stringhe interessanti (>= 6 char).", f_ptr)
    run_command(f"strings -n 6 {target}", show_full=MODE_FULL, file_ptr=f_ptr)

    # 4. ELF Header
    print_header("ELF HEADER", f"readelf -h {target}", "Entry point e metadati.", f_ptr)
    run_command(f"readelf -h {target}", show_full=True, file_ptr=f_ptr)

    # 5. Program Headers
    print_header("PROGRAM HEADERS", f"readelf -l {target}", "Segmenti RWX.", f_ptr)
    run_command(f"readelf -l {target}", show_full=True, file_ptr=f_ptr)

    # 6. Simboli
    print_header("SYMBOLS", f"readelf -s {target}", "Funzioni e variabili.", f_ptr)
    run_command(f"readelf -s {target}", show_full=MODE_FULL, file_ptr=f_ptr)

    # 7. Disassembly
    print_header("DISASSEMBLY", f"objdump -M intel -D {target}", "Codice assembly.", f_ptr)
    run_command(f"objdump -M intel -D {target}", show_full=MODE_FULL, file_ptr=f_ptr)

    # 7.5 ROP Gadget Base (Se ROPgadget è installato)
    print_header("ROP GADGETS", f"ROPgadget --binary {target} --only \"pop|ret\" 2>/dev/null | head -n 20", "Estrazione gadget ROP di base.", f_ptr)
    run_command(f"ROPgadget --binary {target} --only \"pop|ret\" 2>/dev/null", show_full=MODE_FULL, file_ptr=f_ptr)

    # 8. Hex Dump
    sections = get_sections(target)
    for sect in ['.text', '.rodata', '.data', '.plt', '.got']:
        if sect in sections:
            cmd = f"objdump -s -j {sect} {target}"
            print_header(f"HEX DUMP: {sect}", cmd, f"Dati raw in {sect}.", f_ptr)
            run_command(cmd, show_full=MODE_FULL, file_ptr=f_ptr)

    # 9. Fallback Heuristic
    print_header("HEURISTIC DUMP", f"hexdump -C -n 512 {target}", "Primi 512 byte.", f_ptr)
    run_command(f"hexdump -C -n 512 {target}", show_full=True, file_ptr=f_ptr)


    # --- FASE 2: ANALISI DINAMICA RAPIDA ---
    
    # NOTA: Usiamo 'timeout' e iniettiamo input vuoto (< /dev/null) per evitare blocchi infiniti su scanf/read.
    
    # 10. ltrace (Librerie utente)
    ltrace_cmd = f"timeout 2 ltrace -i -s 128 {target} < /dev/null"
    print_header("LTRACE (Dynamic)", ltrace_cmd, "Tracciamento chiamate a librerie di sistema (max 2 sec).", f_ptr)
    run_command(ltrace_cmd, show_full=MODE_FULL, file_ptr=f_ptr, force_show=True)

    # 11. strace (Syscalls)
    strace_cmd = f"timeout 2 strace -s 128 {target} < /dev/null"
    print_header("STRACE (Dynamic)", strace_cmd, "Tracciamento System Calls (max 2 sec).", f_ptr)
    run_command(strace_cmd, show_full=MODE_FULL, file_ptr=f_ptr, force_show=True)

    # --- RICERCA FINALE ---
    find_secrets()
    
    if f_ptr: 
        print(f"\n{C_GREEN}[*] Dati salvati con successo.{C_END}")
        f_ptr.close()

if __name__ == "__main__":
    main()