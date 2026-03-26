# 🧰 External Security Tools & Resources

Una raccolta di tool online indispensabili per il debugging, la decodifica e l'exploitation durante le fasi di CTF o penetration testing.

---

## 🔐 Cryptography & Math
Risorse per l'analisi di cifrari, teoria dei numeri e RSA.

* **[FactorDB](https://factordb.com/)**: Database enorme per la fattorizzazione di numeri interi (fondamentale per rompere chiavi RSA con moduli $n$ piccoli).
* **[Extended Euclidean Algorithm Calculator](https://miniwebtool.com/it/calcolatore-dell-algoritmo-euclideo-esteso/)**: Calcolatore per l'algoritmo di Euclide esteso, utile per trovare l'inverso modulare.
* **[RapidTables (Dec to Hex)](https://www.rapidtables.com/convert/number/decimal-to-hex.html)**: Convertitore rapido tra basi numeriche (Decimale, Esadecimale, Binario).

---

## 🔓 Hash Cracking & Encoding
Tool per bypassare protezioni e trasformare dati.

* **[CrackStation](https://crackstation.net/)**: Uno dei migliori motori di ricerca per lookup table di hash (MD5, SHA1, ecc.).
* **[CyberChef](https://cyberchef.io/)**: Il "coltellino svizzero" definitivo. Permette di concatenare operazioni di encoding, cifratura e analisi dati in una pipeline visuale.
* **[Base64 to Image](https://base64.guru/converter/decode/image)**: Decoder specifico per ricostruire file immagine partendo da stringhe Base64.

---

## 🕵️ Forensics & Steganography
Analisi di file multimediali e dati nascosti.

* **[Aperi'Solve](https://www.aperisolve.com/)**: Tool all-in-one per la steganografia. Esegue automaticamente `zsteg`, `steghide`, `exiftool` e analisi dei layer di colore sulle immagini.

---

## 💻 PrivEsc & Linux Exploitation
Post-exploitation e gestione dei sistemi.

* **[GTFOBins](https://gtfobins.org/)**: Lista curata di binari Unix che possono essere utilizzati per bypassare restrizioni di sistema locali o ottenere privilegi di root.
* **[DuckDNS](https://www.duckdns.org/)**: Servizio di Dynamic DNS gratuito, utile per mantenere l'accesso a macchine con IP dinamico durante i test.

---

## 🛠️ Regex & Development
Utility per la manipolazione di stringhe e codice.

* **[Regex101](https://regex101.com/)**: Il miglior debugger per espressioni regolari. Fondamentale per testare i pattern di ricerca che usi nei tuoi script di *Secret Hunting*.

---

> **Tip:** Se vuoi aggiungere un tool alla lista velocemente da terminale, usa:
> `echo "* [Nome](URL)" >> tools.md`
