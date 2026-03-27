#!/bin/bash
cd "$(dirname "$0")"

echo "Avvio di CTF Sentinel in corso..."

# Avvia l'apertura del browser dopo 3 secondi per dare tempo al server
(sleep 3 && open "http://localhost:3000") &

# Avvia l'applicazione in primo piano per vedere i log
npm run dev
