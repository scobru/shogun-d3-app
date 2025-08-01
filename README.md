# Shogun-D3 - Decentralized Chat

Una chat decentralizzata peer-to-peer basata su GunDB e blockchain technology.

## 🚀 Sviluppo con Vite

### Prerequisiti
- Node.js >= 14.0.0
- npm o yarn

### Installazione
```bash
npm install
# oppure
yarn install
```

### Avvio in Sviluppo
```bash
# Avvia il server di sviluppo Vite
npm run dev
# oppure
yarn dev

# Avvia su porta specifica (3001)
npm run start
# oppure
yarn start
```

### Build per Produzione
```bash
# Crea build ottimizzata
npm run build
# oppure
yarn build

# Anteprima della build
npm run preview
# oppure
yarn preview
```

### Server Legacy (http-server)
```bash
# Se preferisci usare http-server
npm run start-legacy
# oppure
yarn start-legacy
```

## 📁 Struttura del Progetto

```
shogun-d3/
├── app/                    # Codice sorgente
│   ├── index.html         # Landing page
│   ├── d3.html           # Chat application
│   ├── d3.js             # API principale
│   └── logo.svg          # Logo
├── dist/                  # Build di produzione (generato)
├── docs/                  # Documentazione
├── vite.config.js        # Configurazione Vite
├── package.json          # Dipendenze e script
└── README.md             # Questo file
```

## 🌐 Accesso all'Applicazione

Dopo aver avviato il server di sviluppo:

- **Landing Page**: http://localhost:3001/
- **Chat App**: http://localhost:3001/d3.html

## 🔧 Configurazione Vite

Il progetto è configurato con Vite per:
- **Hot Module Replacement (HMR)** - Ricarica automatica durante lo sviluppo
- **Build ottimizzata** - Per produzione
- **CORS abilitato** - Per le connessioni GunDB
- **Porta 3001** - Come nel setup originale

## 📚 Documentazione API

Vedi [API.md](./API.md) per la documentazione completa dell'API JavaScript.

## 🛠️ Tecnologie

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Build Tool**: Vite
- **Database**: GunDB
- **Crittografia**: Gun SEA
- **Blockchain**: MetaMask/Ethereum
- **Deploy**: Vercel

## 🚀 Deploy

Il progetto è configurato per il deploy su Vercel:

```bash
vercel
```

## 📄 Licenza

MIT License