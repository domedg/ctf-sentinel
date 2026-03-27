
# 🛡️ CTF Sentinel - SecOps Interface

**mail:** [domedg5@gmail.com]

---

### 🎥 Demo in Azione

https://github.com/user-attachments/assets/9ba38a9e-c8a9-4659-9a26-b9ceedca748f

---

## 🚀 Cos'è CTF Sentinel?

CTF Sentinel è la tua piattaforma avanzata per la risoluzione di challenge CTF e attività di cybersecurity, pensata per professionisti e appassionati. Unisce la potenza dell'AI (Google Gemini) a una suite di tool locali e script personalizzati, offrendo un ambiente "hacker" elegante, produttivo e realmente utile.

---

## 🌳 Struttura del Progetto

```text
ctf-sentinel/
├── Images/                # Media e screenshot interfaccia
│   ├── interface.png
│   └── Demo_CTF_Sentinelx2.mp4
├── public/                # File pubblici e knowledge base
│   └── knowledge.txt      # Base di conoscenza generata automaticamente
├── src/                   # Codice React e logica app
│   ├── App.tsx            # Interfaccia principale e AI logic
│   ├── main.tsx           # Entry point React
│   ├── index.css          # Stili custom e tema dark
│   └── lib/
│       └── utils.ts       # Utility JS/TS
├── Utils/                 # Tool, script e risorse personali
│   ├── recon.py           # Motore di analisi binaria automatica
│   ├── Tools.md           # Raccolta di link/tool OSINT, crypto, forensics
│   └── RepoMix/           # Output aggregati da repo/tool esterni
├── scripts/               # Script di supporto (es. build knowledge)
│   └── build-knowledge.js # Genera knowledge.txt da tutti i file chiave
├── Writeups/              # Writeup generati e archiviati
├── vite.config.ts         # Configurazione Vite + middleware Express
├── package.json           # Dipendenze e script NPM
├── start.sh               # Avvio rapido server (Unix)
└── ...
```

---

## 🧠 Knowledge Base & Automazione

La knowledge base (public/knowledge.txt) viene generata automaticamente tramite uno script (`scripts/build-knowledge.js`) che aggrega e normalizza tutte le risorse, script, markdown e file di interesse dalla cartella Utils. Questo permette all'AI di attingere a:

- Metodologie e appunti personali
- Output di tool forensi e di ricognizione
- Database di link e risorse (Utils/Tools.md)
- Output aggregati da repository esterne (RepoMix)

Ogni volta che carichi un binario, viene eseguito automaticamente `Utils/recon.py` (con opzione --noinput) per estrarre tutte le informazioni chiave (hash, checksec, strings, ecc.) e fornirle all'AI, velocizzando la fase di analisi e riducendo richieste ridondanti.

---

## ✨ Funzionalità Core

- **Analisi Binaria Automatica**: Carica un file e ottieni subito tutte le info tecniche grazie a recon.py (checksec, strings, hash, strace, objdump...)
- **Autogenerazione Writeup**: Al termine di una challenge, l'app genera un writeup markdown completo e lo archivia in /Writeups
- **Exploit Box**: Ogni exploit o script proposto viene visualizzato in un riquadro dedicato, pronto da copiare o scaricare
- **Cyber Bookmarks Dinamici**: I tuoi tool preferiti (da Tools.md) sono sempre accessibili come link rapidi nella sidebar
- **Gestione Chat e Menu**: Puoi nascondere, eliminare o rinominare le chat e personalizzare la UI secondo le tue esigenze

---

## ⚙️ Requisiti di Sistema

- **Node.js** (v18+)
- **Python 3** (per recon.py)
- **Toolchain Linux**: file, ldd, strings, readelf, objdump, hexdump, ltrace, strace, checksec
- **API Key Google Gemini** (da salvare in `.env.local`)

---

## 🛠️ Setup e Avvio

1. Clona la repo:
  ```bash
  git clone <URL_REPOSITORY>
  cd ctf-sentinel
  ```
2. Installa le dipendenze:
  ```bash
  npm install
  ```
3. Crea `.env.local` con la tua API Key:
  ```env
  GEMINI_API_KEY=la_tua_key
  ```
4. Avvia il server:
  ```bash
  npm run dev
  # oppure
  ./start.sh
  ```

---

## 📚 Approfondimenti e Personalizzazioni

- Puoi estendere recon.py con nuovi moduli di analisi
- Modifica Tools.md per aggiungere i tuoi link/tool preferiti
- I file in RepoMix permettono di integrare output da altre repository/tool
- La UI è completamente personalizzabile (stili, sidebar, exploit box)

---

## 🤝 Contribuisci

Forka la repo, proponi nuove feature o migliora i tool esistenti! Ogni contributo è benvenuto.