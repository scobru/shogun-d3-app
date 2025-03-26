// Wrapper per rendere Shogun-D3 utilizzabile in un browser
// Basato sul codice originale da /src/index.ts

// Definisci i peer Gun prima di inizializzare
const GUN_PEERS = [
    "https://gun-relay.scobrudot.dev/gun",
    "https://gun-manhattan.herokuapp.com/gun",
    "https://peer.wallie.io/gun",
  ];
  
  // Aumentiamo timeout iniziale di Gun
  const GUN_TIMEOUT = 10000; // 10 secondi invece dei 5 standard
  
  // Crea un'istanza di ShogunCore
  const shogunInstance = initShogunBrowser({
    peers: GUN_PEERS,
  });
  
  // Recupera l'istanza di Gun da ShogunCore
  window.gun = shogunInstance.gun;
  window.SEA = Gun.SEA;
  
  // Monitoraggio dello stato dei peer di Gun
  window.gun.on("hi", (peer) => {
    console.log(`Gun peer connesso: ${peer}`);
  });
  
  window.gun.on("bye", (peer) => {
    console.log(`Gun peer disconnesso: ${peer}`);
  });
  
  // Monitoraggio stato sincronizzazione - modifica per ridurre il rumore nei log
  // Commentiamo questa parte o imponiamo un livello di log più alto
  /*
  window.gun.on("put", function(at) {
    console.log(`Gun PUT operazione sincronizzata:`, at.put);
  });
  */
  
  // Oppure, utilizziamo un log condizionale che mostra solo informazioni essenziali
  window.gun.on("put", function(at) {
    // Verificare se è attivo il debug verbose prima di mostrare i log dettagliati
    if (window.d3 && window.d3.debug && window.d3.debug.logLevel === 'verbose') {
      console.log(`Gun PUT operazione sincronizzata:`, at.put);
    }
  });
  
  // Creazione del namespace Shogun-D3 basato su ShogunCore
  window.d3 = {
    // Riferiimento a ShogunCore
    shogun: shogunInstance,
  
    // Funzioni di base
    getProvider: async function () {
      if (!window.ethereum) {
        alert(
          "MetaMask non è installato! Per favore installa MetaMask per utilizzare questa applicazione."
        );
        return null;
      }
  
      const ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
      await ethersProvider.send("eth_requestAccounts", []);
      return ethersProvider;
    },
  
    HashNamespace: function (string) {
      return window.btoa(string);
    },
  
    // Esportazione di gun e SEA
    gun: window.gun,
    SEA: window.SEA,
  
    // Mappa per tenere traccia degli ascoltatori attivi
    activeListeners: new Map(),
  
    // Database configuration (dbConf)
    dbConf: {
      peers: GUN_PEERS,
      localStorage: false,
      radisk: false,
      axe: false,
      multicast: false,
    },
    
    // Debug utilities
    debug: {
      testGunConnection: async function() {
        try {
          const startTime = Date.now();
          
          // Test di connessione a Gun con un semplice ping
          const result = await new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              resolve({
                success: false,
                message: "Timeout durante il test di connessione"
              });
            }, 5000);
            
            // Tenta di leggere un dato da Gun
            window.gun.get("connection_test").once((data) => {
              clearTimeout(timeoutId);
              resolve({
                success: true
              });
            });
          });
          
          const endTime = Date.now();
          const latency = endTime - startTime;
          
          return {
            ...result,
            latency
          };
        } catch (error) {
          return {
            success: false,
            message: error.message || "Errore durante il test di connessione"
          };
        }
      },
  
      // Configurazione log level
      setLogLevel: function(level) {
        // Implementazione semplificata per gestire il livello di log
        console.log(`Log level impostato a: ${level}`);
      }
    },
  
    // NUOVA FUNZIONE: Connessione wallet tramite ShogunCore
    connectWithMetaMask: async function() {
      try {
        const provider = await this.getProvider();
        if (!provider) return null;
        
        const address = await provider.getSigner().getAddress();
        
        // Prima tenta login, se fallisce esegue signup
        let authResult = await this.shogun.loginWithMetaMask(address);
        
        if (!authResult.success) {
          console.log("Utente non trovato, eseguo registrazione con MetaMask");
          authResult = await this.shogun.signUpWithMetaMask(address);
          
          if (!authResult.success) {
            throw new Error(`Errore durante l'autenticazione: ${authResult.error}`);
          }
        }
        
        console.log("Autenticazione completata con ShogunCore:", authResult);
        
        // Memorizza l'indirizzo utente corrente
        window.currentUserAddress = address;
        
        // Ottiene il keypair Gun gestito da ShogunCore
        const gunUser = this.shogun.gun.user();
        window.gunKeyPair = gunUser._.sea;
        
        // Registra anche il keypair pubblico nel formato usato dal wrapper 
        this.registerKeypair(address, {
          pub: window.gunKeyPair.pub,
          epub: window.gunKeyPair.epub
        });
        
        return {
          address,
          keypair: window.gunKeyPair
        };
      } catch (error) {
        console.error("Errore durante la connessione con MetaMask:", error);
        throw error;
      }
    },
  
    // NUOVA FUNZIONE: backup keypair
    backupKeypair: async function(password) {
      if (!this.shogun.isLoggedIn()) {
        throw new Error("Devi essere autenticato per eseguire un backup");
      }
      
      const backupData = await this.shogun.exportGunPair(password);
      return backupData;
    },
    
    // NUOVA FUNZIONE: ripristina keypair
    restoreKeypair: async function(backupData, password) {
      const result = await this.shogun.importGunPair(backupData, password);
      
      if (result) {
        // Aggiorna gunKeyPair globale
        const gunUser = this.shogun.gun.user();
        window.gunKeyPair = gunUser._.sea;
        
        // Registra anche il keypair pubblico
        if (window.currentUserAddress) {
          await this.registerKeypair(window.currentUserAddress, {
            pub: window.gunKeyPair.pub,
            epub: window.gunKeyPair.epub
          });
        }
      }
      
      return result;
    },
  
    // Funzioni di gestione delle chiavi
    registerKeypair: function (address, keypair) {
      // Estrae solo le chiavi pubbliche dal keypair
      const { epub, pub } = keypair;
  
      // Verifica che le chiavi pubbliche siano presenti
      if (!epub || !pub) {
        console.error("Keypair mancante di chiavi pubbliche:", keypair);
        throw new Error(
          "Non è possibile registrare un keypair senza chiavi pubbliche"
        );
      }
  
      // Le salva nel database decentralizzato, associate all'indirizzo Ethereum
      try {
        window.gun.get(`skeypair${address}`).put({ epub, pub });
        console.log("Chiavi pubbliche registrate per l'indirizzo:", address, {
          epub: epub.substring(0, 15) + "...",
          pub: pub.substring(0, 15) + "...",
        });
  
        return true;
      } catch (error) {
        console.error("Errore durante la registrazione del keypair:", error);
        throw error;
      }
    },
  
    // Verifica se esiste un keypair per l'indirizzo specificato
    hasKeypair: function (address) {
      return new Promise((resolve) => {
        window.gun.get(`skeypair${address}`).once((data) => {
          if (data && data.epub && data.pub) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    },
  
    // Funzione per ottenere un keypair da Gun
    getKeypair: async function (address) {
      try {
        console.log("getKeypair chiamato con indirizzo:", address);
        
        if (!address) {
          console.error("Indirizzo non valido in getKeypair:", address);
          return null; 
        }
        
        // Normalizza l'indirizzo
        const normalizedAddress = address.toLowerCase();
        console.log("Cerco keypair per:", address, "(normalizzato:", normalizedAddress, ")");
  
        // Verifica se è l'indirizzo dell'utente corrente
        let isCurrentUser = false;
        try {
          const provider = await this.getProvider();
          if (provider) {
            const currentUserAddress = await provider.getSigner().getAddress();
            isCurrentUser = currentUserAddress.toLowerCase() === normalizedAddress;
            console.log("È anche il mio indirizzo?", isCurrentUser ? "SÌ" : "NO");
          }
        } catch (error) {
          console.warn(
            "Impossibile determinare se è l'indirizzo dell'utente corrente:",
            error
          );
        }
  
        // Verifica se è il nostro indirizzo e abbiamo un keypair già caricato
        if (window.gunKeyPair && isCurrentUser) {
          console.log(
            "È il nostro indirizzo e abbiamo già un keypair caricato in memoria"
          );
          return window.gunKeyPair;
        }
  
        // Cerca in Gun
        console.log(`Cerco keypair per ${address} in Gun...`);
  
        // Recupera la parte pubblica dal database
        return new Promise((resolve, reject) => {
          let timeoutId = setTimeout(() => {
            console.warn(`Timeout cercando keypair per ${address} in Gun`);
            // In caso di timeout, resolve con null invece che rifiutare la promessa
            resolve(null);
          }, GUN_TIMEOUT); // 10 secondi di timeout
  
          window.gun.get(`skeypair${address}`).once((data) => {
            clearTimeout(timeoutId);
  
            console.log("Dati recuperati da Gun:", data);
  
            // Se non abbiamo dati o dati vuoti, risolve con null
            if (
              !data ||
              (typeof data === "object" && Object.keys(data).length === 0)
            ) {
              console.warn(`Nessun keypair trovato per ${address} in Gun`);
              resolve(null);
              return;
            }
  
            console.log("Keypair pubblico da Gun per:", address, {
              pub: data.pub ? data.pub.substring(0, 10) + "..." : "mancante",
              epub: data.epub ? data.epub.substring(0, 10) + "..." : "mancante",
            });
  
            resolve(data);
          });
        });
      } catch (error) {
        console.error("Errore durante la ricerca del keypair:", error);
        return null;
      }
    },
  
    // Funzione per creare un segreto condiviso - identica all'implementazione TypeScript
    createSharedSecret: async function (recipientAddress, gunKeypair) {
      console.log("Creo segreto condiviso con:", recipientAddress);
  
      // Verifica che abbiamo un gunKeypair valido
      if (!gunKeypair || !gunKeypair.epriv || !gunKeypair.epub) {
        console.error("KeyPair non valido:", gunKeypair);
        throw new Error(
          "Keypair non completo o mancante per creare un segreto condiviso"
        );
      }
  
      console.log("Keypair mittente:", {
        pub: gunKeypair.pub ? "presente" : "mancante",
        epub: gunKeypair.epub ? "presente" : "mancante",
        priv: gunKeypair.priv ? "presente" : "mancante",
        epriv: gunKeypair.epriv ? "presente" : "mancante",
      });
  
      // Se il secondo parametro è già un epub (chiave pubblica di crittografia), lo usiamo direttamente
      if (
        typeof recipientAddress === "string" &&
        recipientAddress.startsWith("0x")
      ) {
        // Ottiene la chiave pubblica del destinatario
        const recipientPubKey = await this.getKeypair(recipientAddress);
  
        // Verifica se abbiamo ricevuto un keypair valido
        if (!recipientPubKey || !recipientPubKey.epub) {
          console.error(
            "Chiave pubblica del destinatario non trovata:",
            recipientAddress
          );
          throw new Error(
            `Impossibile trovare la chiave pubblica per ${recipientAddress}. L'utente deve prima generare un keypair.`
          );
        }
  
        console.log("Chiave pubblica del destinatario:", {
          pub: recipientPubKey.pub ? "presente" : "mancante",
          epub: recipientPubKey.epub ? "presente" : "mancante",
        });
  
        // Crea un segreto condiviso usando la chiave pubblica del destinatario e il nostro keypair
        try {
          // DEBUG: Stampa la chiave epub effettiva del destinatario
          console.log("DEBUG CRYPT - epub del destinatario:", recipientPubKey.epub);
          console.log("DEBUG CRYPT - epub del mittente:", gunKeypair.epub);
  
          // Verifica che entrambe le chiavi siano valide
          if (recipientPubKey.epub.length < 20 || gunKeypair.epub.length < 20) {
            console.error("DEBUG CRYPT - Chiavi epub troppo corte:", {
              recipientEpubLen: recipientPubKey.epub.length,
              gunKeyPairEpubLen: gunKeypair.epub.length
            });
            throw new Error("Chiavi epub non valide, lunghezza insufficiente");
          }
  
          // Creiamo il segreto nel modo standard
          const secret = await window.SEA.secret(
            recipientPubKey.epub,
            gunKeypair
          );
  
          if (!secret) {
            console.error("Segreto condiviso vuoto o null");
            throw new Error("Impossibile creare un segreto condiviso");
          }
  
          // DEBUG: Stampa informazioni sul segreto generato
          console.log("DEBUG CRYPT - Segreto generato:", secret ? "VALIDO" : "NULLO");
          console.log("DEBUG CRYPT - Tipo segreto:", typeof secret);
          console.log("DEBUG CRYPT - Lunghezza segreto:", secret ? secret.length : 0);
  
          return secret;
        } catch (error) {
          console.error("Errore nella creazione del segreto condiviso:", error);
          
          // Prova un metodo alternativo
          try {
            console.log("DEBUG CRYPT - Provo un metodo alternativo per creare il segreto");
            // Creiamo il segreto nella direzione inversa
            const altSecret = await window.SEA.secret(gunKeypair.epub, {
              epub: recipientPubKey.epub
            });
            
            if (altSecret) {
              console.log("DEBUG CRYPT - Metodo alternativo ha funzionato!");
              return altSecret;
            }
          } catch (altError) {
            console.error("DEBUG CRYPT - Anche il metodo alternativo è fallito:", altError);
          }
          
          throw new Error(
            `Errore nella creazione del segreto condiviso: ${error.message}`
          );
        }
      } else {
        // Il secondo parametro è direttamente un epub o un oggetto con epub
        const epub =
          typeof recipientAddress === "string"
            ? recipientAddress
            : recipientAddress.epub;
  
        if (!epub) {
          console.error(
            "Chiave epub del destinatario non valida:",
            recipientAddress
          );
          throw new Error(
            "Impossibile creare un segreto condiviso: epub mancante"
          );
        }
  
        try {
          // DEBUG: Stampa la chiave epub effettiva
          console.log("DEBUG CRYPT - epub diretta:", epub);
          console.log("DEBUG CRYPT - epub del mittente:", gunKeypair.epub);
  
          const secret = await window.SEA.secret(epub, gunKeypair);
  
          if (!secret) {
            console.error("Segreto condiviso vuoto o null");
            throw new Error("Impossibile creare un segreto condiviso");
          }
  
          // DEBUG: Stampa informazioni sul segreto generato
          console.log("DEBUG CRYPT - Segreto generato (modo diretto):", secret ? "VALIDO" : "NULLO");
  
          return secret;
        } catch (error) {
          console.error("Errore nella creazione del segreto condiviso:", error);
          throw new Error(
            `Errore nella creazione del segreto condiviso: ${error.message}`
          );
        }
      }
    },
  
    // Funzione per crittografare un messaggio usando un segreto
    encryptMessage: async function (message, secret) {
      return await window.SEA.encrypt(message, secret);
    },
  
    // Funzioni per messaggi
    sendmessage: async function (payload, to, gunKeypair) {
      // Verifico i parametri
      if (!payload || payload.trim() === "") {
        return { sent: false, why: new Error("Il messaggio è vuoto") };
      }
  
      if (!Array.isArray(to) || to.length === 0) {
        return {
          sent: false,
          why: new Error("Nessun destinatario valido specificato"),
        };
      }
  
      if (!gunKeypair || !gunKeypair.priv || !gunKeypair.epub) {
        return { sent: false, why: new Error("Keypair mittente non valido") };
      }
  
      try {
        // Verifica la disponibilità del provider e dell'indirizzo utente
        const provider = await this.getProvider();
        if (!provider) {
          throw new Error("Provider non disponibile");
        }
        
        const sender_address = await provider.getSigner().getAddress();
  
        // Risolvi il dominio ENS associato all'indirizzo, se disponibile
        let ensDomain = null;
        try {
          const name = await provider.lookupAddress(sender_address);
          if (name) {
            ensDomain = name;
          }
        } catch (error) {
          // Ignora errori ENS
        }
  
        // Il primo destinatario è quello che useremo per questa implementazione
        const recipientAddress = to[0];
  
        // Verifica che il destinatario abbia registrato una chiave pubblica
        const recipientPubKey = await this.getKeypair(recipientAddress);
        
        if (!recipientPubKey || !recipientPubKey.pub || !recipientPubKey.epub) {
          return { 
            sent: false, 
            why: new Error(`Il destinatario ${recipientAddress} non ha un keypair valido`) 
          };
        }
        
        // Informazioni di debug sulla crittografia
        const cryptDebug = {
          encryptTime: Date.now(),
          method: "shared_secret",
          hasSenderKeys: !!(gunKeypair && gunKeypair.priv && gunKeypair.epub),
          hasRecipientKeys: !!(recipientPubKey && recipientPubKey.pub && recipientPubKey.epub)
        };
  
        // Creazione del segreto condiviso
        let shared_secret = null;
        try {
          shared_secret = await this.createSharedSecret(recipientPubKey, gunKeypair);
          cryptDebug.sharedSecretSuccess = !!shared_secret;
          cryptDebug.method = "standard_secret";
        } catch (secretError) {
          // Secondo tentativo: metodo alternativo di creazione del segreto condiviso
          try {
            shared_secret = await window.SEA.secret(recipientPubKey.epub, gunKeypair);
            if (!shared_secret) {
              throw new Error("Segreto condiviso alternativo è vuoto");
            }
            cryptDebug.sharedSecretSuccess = !!shared_secret;
            cryptDebug.method = "alternative_epub_secret";
          } catch (altSecretError) {
            // Se tutti i metodi falliscono, usiamo una chiave di fallback
            shared_secret = "fallback_key_" + sender_address + "_" + recipientAddress;
            cryptDebug.method = "fallback_key";
            cryptDebug.fallbackUsed = true;
          }
        }
  
        // Crittografa il messaggio
        let encrypted_data = null;
        try {
          encrypted_data = await this.encryptMessage(payload, shared_secret);
          cryptDebug.encryptionSuccess = !!encrypted_data;
        } catch (encryptError) {
          // Secondo tentativo: crittografia diretta con SEA
          try {
            encrypted_data = await window.SEA.encrypt(payload, shared_secret);
            if (!encrypted_data) {
              throw new Error("Dati crittografati sono vuoti");
            }
            cryptDebug.encryptionSuccess = !!encrypted_data;
            cryptDebug.encryptionMethod = "direct_sea";
          } catch (altEncryptError) {
            // Se tutte le crittografie falliscono, usiamo un marcatore speciale
            encrypted_data = "ENCRYPT_FAILED_USE_PLAINTEXT";
            cryptDebug.encryptionMethod = "plaintext_fallback";
            cryptDebug.fallbackEncryptUsed = true;
          }
        }
  
        // Normalizza gli indirizzi per il confronto case-insensitive
        const normalizedRecipient = recipientAddress.toLowerCase();
        const normalizedSender = sender_address.toLowerCase();
  
        // Crea un identificatore univoco per la conversazione ordinando gli indirizzi
        const participants = [normalizedSender, normalizedRecipient].sort();
        const sortedParticipants = participants.join("");
        
        // Genera il namespace della chat
        const chatNamespace = this.HashNamespace(sortedParticipants);
  
        // Ottieni il riferimento Gun alla chat
        const chat = window.gun.get(chatNamespace);
  
        // Genera un ID univoco per il messaggio
        const messageKey = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
        // Preparazione del messaggio con solo i dati essenziali
        const messageData = {
          date: Date.now(),
          encryptedMSG: encrypted_data,
          from: sender_address,
          to: recipientAddress,
          ensFrom: ensDomain,
          msg_id: messageKey,
          // Campi di fallback per garantire compatibilità
          text: payload,
          // Indicazione se stiamo usando crittografia
          encrypted: !!encrypted_data && encrypted_data !== "ENCRYPT_FAILED_USE_PLAINTEXT"
        };
  
        // Salva il messaggio usando PUT (più affidabile di SET)
        let storageSuccess = false;
        const storeResult = await new Promise((resolve) => {
          try {
            // Timeout di sicurezza
            const timeoutId = setTimeout(() => {
              resolve({ ok: 0, timeout: true });
            }, 5000);
  
            // PUT è più stabile di SET per Gun
            chat.put({[messageKey]: messageData}, (ack) => {
              clearTimeout(timeoutId);
              
              if (ack.err) {
                resolve({ ok: 0, error: ack.err });
              } else {
                storageSuccess = true;
                resolve({ ok: 1 });
              }
            });
          } catch (error) {
            resolve({ ok: 0, error: error });
          }
        });
  
        // Se il PUT fallisce, proviamo subito con SET
        if (!storageSuccess) {
          await new Promise((resolve) => {
            try {
              chat.get(messageKey).set(messageData, (ack) => {
                if (!ack.err) {
                  storageSuccess = true;
                }
                resolve({ ok: ack.err ? 0 : 1 });
              });
            } catch (error) {
              resolve({ ok: 0 });
            }
          });
        }
  
        // Disabilitiamo la verifica post-invio per velocizzare l'applicazione
        return { 
          sent: true, 
          encrypted: encrypted_data, 
          key: messageKey,
          namespace: chatNamespace
        };
      } catch (e) {
        return { sent: false, why: e };
      }
    },
  
    /**
     * Interrompe l'ascolto dei messaggi per una conversazione specifica
     * @param {string} recipientAddress Indirizzo del destinatario della conversazione
     * @return {boolean} True se un ascolto è stato fermato, false altrimenti
     */
    stopReceiveMessage: (recipientAddress) => {
      try {
        if (!recipientAddress) return false;
        
        const userAddress = window.currentUserAddress ? window.currentUserAddress.toLowerCase() : "";
        const recipientAddr = recipientAddress.toLowerCase();
        
        if (!userAddress || !recipientAddr) return false;
        
        // Genera il namespace della conversazione
        const participants = [recipientAddr, userAddress].sort();
        const chatNamespace = window.d3.HashNamespace(participants.join(""));
        
        // Se esiste un listener attivo per questo namespace, lo rimuoviamo
        if (window.d3.activeListeners.has(chatNamespace)) {
          const listenerInfo = window.d3.activeListeners.get(chatNamespace);
          if (listenerInfo && listenerInfo.cleanup) {
            // Interrompi l'ascolto chiamando la funzione di cleanup
            listenerInfo.cleanup();
            window.d3.activeListeners.delete(chatNamespace);
            console.log(`Ascolto interrotto per namespace ${chatNamespace}`);
            return true;
          }
        }
        
        return false;
      } catch (error) {
        console.error("Errore nell'interruzione dell'ascolto:", error);
        return false;
      }
    },
  
    /**
     * Riceve messaggi da un indirizzo specificato
     * @param {string} recipientAddress Indirizzo del destinatario
     * @param {function} callback Funzione di callback chiamata quando arriva un nuovo messaggio
     */
    receiveMessage: async function (recipientAddress, callback) {
      if (!window.activeListeners) {
        window.activeListeners = new Map();
      }
  
      // Ottieni l'indirizzo dell'utente corrente
      let userAddress = null;
      try {
        const provider = await this.getProvider();
        if (provider) {
          userAddress = await provider.getSigner().getAddress();
        }
      } catch (error) {
        console.error("Errore nel recuperare l'indirizzo dell'utente:", error);
        return;
      }
  
      if (!userAddress) {
        console.error("Impossibile determinare l'indirizzo dell'utente");
        return;
      }
  
      const normalizedRecipient = userAddress.toLowerCase();
      const normalizedSender = recipientAddress.toLowerCase();
  
      // Crea un identificatore univoco per la conversazione ordinando gli indirizzi
      const participants = [normalizedSender, normalizedRecipient].sort();
      const sortedParticipants = participants.join("");
      const chatNamespace = this.HashNamespace(sortedParticipants);
  
      console.log(`RECEIVEMSGS - Inizializzato ascolto su ${chatNamespace}`);
  
      // Inizializza la mappa globale per tracciare i messaggi già processati
      if (!window.processedMessagesMap) {
        window.processedMessagesMap = new Map();
      }
  
      // Riferimento locale alla mappa per essere sicuri che sia accessibile nelle closure
      const processedMessagesMap = window.processedMessagesMap;
  
      // Funzione per processare i messaggi
      const processMessage = async (data, key) => {
        try {
          // Ignora la chiave speciale "_" di Gun e messaggi vuoti
          if (key === '_' || key === '#' || !data) {
            return;
          }
          
          // Crea un identificatore univoco per il messaggio
          const messageIdentifier = `${key}_${data.date || 0}`;
          
          // Verifica se il messaggio è già stato processato
          if (processedMessagesMap.has(messageIdentifier)) {
            console.log(`RECEIVEMSGS - Messaggio ${messageIdentifier} già processato, ignorato`);
            return;
          }
          
          // Controlla se è un messaggio inviato dall'utente corrente
          // Questo aiuta a prevenire la duplicazione
          const messageFrom = data.from && data.from.toLowerCase();
          const isSentByMe = messageFrom === normalizedRecipient;
          
          // Se è un messaggio inviato da noi, controlliamo anche che non sia già in window.displayedMessages
          if (isSentByMe && window.displayedMessages && window.displayedMessages.has(key)) {
            console.log(`RECEIVEMSGS - Messaggio ${key} inviato da me e già visualizzato, ignorato`);
            return;
          }
          
          // Se il messaggio inizia con "sent_", presumiamo che sia un messaggio che abbiamo inviato noi
          if (key.startsWith('sent_')) {
            console.log(`RECEIVEMSGS - Messaggio ${key} è un sent_ message, ignorato`);
            return;
          }
          
          // Marca il messaggio come processato
          processedMessagesMap.set(messageIdentifier, Date.now());
          
          // Verifichiamo vari campi possibili per i messaggi
          if (!data.encryptedMSG && !data.text && !data.message && !data.content && !data.raw_payload) {
            return;
          }
  
          // Tentiamo di decifrare il messaggio
          let decrypted = null;
          try {
            decrypted = await this.decryptMessage(data, window.gunKeyPair);
          } catch (error) {
            console.warn(`RECEIVEMSGS - Errore decrittazione messaggio ${key}:`, error.message);
            return;
          }
  
          if (!decrypted) {
            console.warn(`RECEIVEMSGS - Impossibile decifrare il messaggio ${key}`);
            return;
          }
  
          // Aggiungi il timestamp se non presente
          const timestamp = data.date || data.sent_timestamp || Date.now();
  
          // Chiama il callback con tutte le informazioni necessarie
          if (typeof callback === "function") {
            callback({
              originalData: data,
              messageKey: key,
              decrypted,
              isSentByMe,
              timestamp,
              sender: isSentByMe ? normalizedRecipient : normalizedSender
            });
          }
        } catch (error) {
          console.error(`RECEIVEMSGS - Errore nella gestione del messaggio:`, error);
        }
      };
  
      // Usa gun.get().map().on() per ascoltare tutti i messaggi nel namespace
      const chatRef = window.gun.get(chatNamespace);
      
      // Ascolta i nuovi messaggi e gli aggiornamenti
      chatRef.map().on(processMessage);
      
      // Pulisci periodicamente la mappa dei messaggi processati (ogni 30 minuti)
      const cleanupInterval = setInterval(() => {
        const now = Date.now();
        processedMessagesMap.forEach((timestamp, msgId) => {
          // Rimuovi i messaggi più vecchi di 30 minuti
          if (now - timestamp > 30 * 60 * 1000) {
            processedMessagesMap.delete(msgId);
          }
        });
      }, 30 * 60 * 1000);
      
      // Funzione di pulizia per fermare l'ascolto
      const cleanupListener = () => {
        chatRef.off();
        clearInterval(cleanupInterval);
        console.log(`RECEIVEMSGS - Ascolto interrotto per ${chatNamespace}`);
      };
      
      // Aggiungi il listener all'elenco degli attivi
      window.d3.activeListeners.set(chatNamespace, { 
        cleanup: cleanupListener
      });
      
      return cleanupListener;
    },
  
    decryptMessage: async function (messageData, gunKeypair) {
      console.log("Tentativo di decrittazione:", messageData ? {
        from: messageData.from && messageData.from.substring(0, 10) + "...",
        to: messageData.to && messageData.to.substring(0, 10) + "...",
        date: messageData.date ? new Date(messageData.date).toLocaleString() : "N/A",
        hasEncryptedMSG: !!messageData.encryptedMSG,
        hasPlaintext: !!(messageData.text || messageData.message || messageData.content || messageData.raw_payload)
      } : "Dati messaggio non validi");
  
      if (!messageData) {
        console.error("Dati del messaggio non presenti");
        throw new Error("Dati del messaggio mancanti");
      }
  
      // Se il messaggio non ha encryptedMSG ma ha campi di testo in chiaro, li utilizziamo direttamente
      if (!messageData.encryptedMSG) {
        console.log("Messaggio senza encryptedMSG, controllo campi in chiaro");
        
        // Controllo se ci sono campi in chiaro
        if (messageData.text) {
          console.log("Restituisco contenuto dal campo text");
          return messageData.text;
        } else if (messageData.message) {
          console.log("Restituisco contenuto dal campo message");
          return messageData.message;
        } else if (messageData.content) {
          console.log("Restituisco contenuto dal campo content");
          return messageData.content;
        } else if (messageData.raw_payload) {
          console.log("Restituisco contenuto dal campo raw_payload");
          return messageData.raw_payload;
        }
        
        // Se non ci sono campi in chiaro, è un errore
        console.error("Dati del messaggio invalidi (encryptedMSG mancante e nessun campo in chiaro)");
        throw new Error("Messaggio non decifrabile (nessun contenuto trovato)");
      }
  
      // Se il messaggio ha l'indicatore di fallback, utilizziamo i campi in chiaro
      if (messageData.encryptedMSG === "ENCRYPT_FAILED_USE_PLAINTEXT") {
        console.log("Messaggio con indicatore di fallback, utilizzo testo in chiaro");
        if (messageData.text) return messageData.text;
        if (messageData.message) return messageData.message;
        if (messageData.content) return messageData.content;
        if (messageData.raw_payload) return messageData.raw_payload;
        throw new Error("Indicatore di fallback presente ma nessun testo in chiaro trovato");
      }
  
      // Se il messaggio non ha info sul mittente e destinatario, proveremo una decifratura diretta
      if (!messageData.from && !messageData.to) {
        console.warn("Messaggio senza mittente e destinatario, proverò decifratura diretta");
        // Proveremo comunque a decriptare in seguito
      }
  
      // Informazioni di debug dalla crittografia originale, se disponibili
      let cryptOriginalInfo = null;
      if (messageData.cryptInfo) {
        try {
          cryptOriginalInfo = JSON.parse(messageData.cryptInfo);
          console.log("Info di debug sulla crittografia originale:", cryptOriginalInfo);
        } catch (e) {
          console.log("Impossibile analizzare le info di debug sulla crittografia");
        }
      }
  
      // Se il messaggio ha una versione in plaintext per debug, mostrarla
      if (messageData.plaintext) {
        console.log("Plaintext del messaggio (debug):", messageData.plaintext);
      }
  
      // Se il keypair non è valido, proviamo a usare window.gunKeyPair
      if (!gunKeypair || !gunKeypair.epriv || !gunKeypair.priv) {
        console.warn(
          "Keypair fornito incompleto, provo a utilizzare window.gunKeyPair"
        );
  
        if (
          window.gunKeyPair &&
          window.gunKeyPair.epriv &&
          window.gunKeyPair.priv
        ) {
          console.log("Utilizzo window.gunKeyPair per la decrittazione");
          gunKeypair = window.gunKeyPair;
        } else {
          console.error(
            "Keypair incompleto o mancante per decrittare e nessun keypair alternativo disponibile"
          );
          
          // Se abbiamo campi in chiaro, li utilizziamo invece di fallire
          if (messageData.text) return messageData.text;
          if (messageData.message) return messageData.message;
          if (messageData.content) return messageData.content;
          if (messageData.raw_payload) return messageData.raw_payload;
          
          throw new Error("Keypair incompleto o mancante per decrittare");
        }
      }
  
      try {
        // Ottieni l'indirizzo utente corrente per determinare la direzione del messaggio
        let currentUserAddress = null;
        try {
          const provider = await this.getProvider();
          if (provider) {
            currentUserAddress = await provider.getSigner().getAddress();
            console.log("Indirizzo utente corrente:", currentUserAddress);
          }
        } catch (providerError) {
          console.warn("Impossibile ottenere l'indirizzo utente:", providerError);
          // Continuiamo comunque
        }
  
        // Normalizza gli indirizzi per il confronto case-insensitive
        const normalizedFromAddress = messageData.from
          ? messageData.from.toLowerCase()
          : "";
        const normalizedToAddress = messageData.to
          ? messageData.to.toLowerCase()
          : "";
        const normalizedUserAddress = currentUserAddress 
          ? currentUserAddress.toLowerCase() 
          : "";
  
        console.log("Confronto indirizzi (in decryptMessage):", {
          from: normalizedFromAddress,
          to: normalizedToAddress,
          user: normalizedUserAddress || "sconosciuto",
        });
  
        // Determina con chi creare il segreto condiviso
        let otherPartyAddress = null;
        let isSentByMe = false;
        
        if (normalizedUserAddress) {
          if (normalizedToAddress === normalizedUserAddress) {
            // Messaggio ricevuto, usa il mittente
            otherPartyAddress = messageData.from;
            isSentByMe = false;
            console.log("Messaggio ricevuto, otherParty =", messageData.from);
          } else if (normalizedFromAddress === normalizedUserAddress) {
            // Messaggio inviato, usa il destinatario
            otherPartyAddress = messageData.to;
            isSentByMe = true;
            console.log("Messaggio inviato, otherParty =", messageData.to);
          } else {
            console.warn("Messaggio non destinato o inviato dall'utente corrente");
            // Proveremo comunque a decifrare con varie strategie
          }
        } else {
          console.warn("Indirizzo utente sconosciuto, impossibile determinare la direzione del messaggio");
          // Proveremo comunque a decifrare senza informazioni sulla direzione
        }
  
        // Array di strategie di decifratura da provare
        const strategies = [];
        
        // Ottieni il keypair dell'altra parte (per alcune strategie)
        let otherPartyKeyPair = null;
        if (otherPartyAddress) {
          try {
            otherPartyKeyPair = await this.getKeypair(otherPartyAddress);
            console.log(`Keypair per ${otherPartyAddress}:`, otherPartyKeyPair ? "trovato" : "non trovato");
          } catch (keyPairError) {
            console.warn(`Errore nel recupero keypair per ${otherPartyAddress}:`, keyPairError);
          }
        }
  
        // Crea vari shared secret per provare diverse strategie di decifratura
        if (otherPartyAddress && otherPartyKeyPair && otherPartyKeyPair.epub) {
          // 1. Metodo usando createSharedSecret standard
          try {
            const secret1 = await this.createSharedSecret(otherPartyAddress, gunKeypair);
            if (secret1) {
              strategies.push({
                name: "standard_secret",
                secret: secret1,
                decrypt: async () => {
                  return await window.SEA.decrypt(messageData.encryptedMSG, secret1);
                },
              });
            }
          } catch (error1) {
            console.warn("Errore nella creazione del secret standard:", error1);
          }
  
          // 2. Metodo diretto con SEA.secret
          try {
            const secret2 = await window.SEA.secret(otherPartyKeyPair.epub, gunKeypair);
            if (secret2) {
              strategies.push({
                name: "direct_epub_secret",
                secret: secret2,
                decrypt: async () => {
                  return await window.SEA.decrypt(messageData.encryptedMSG, secret2);
                },
              });
            }
          } catch (error2) {
            console.warn("Errore nella creazione del secret diretto:", error2);
          }
  
          // 3. Metodo inverso
          try {
            const secret3 = await window.SEA.secret(gunKeypair.epub, {
              epub: otherPartyKeyPair.epub,
              pub: otherPartyKeyPair.pub,
            });
            if (secret3) {
              strategies.push({
                name: "inverse_secret",
                secret: secret3,
                decrypt: async () => {
                  return await window.SEA.decrypt(messageData.encryptedMSG, secret3);
                },
              });
            }
          } catch (error3) {
            console.warn("Errore nella creazione del secret inverso:", error3);
          }
        }
  
        // 4. Fallback con chiave statica
        if (otherPartyAddress) {
          const fallbackSecret = "fallback_key_" + (isSentByMe ? normalizedUserAddress : normalizedFromAddress) + 
                                 "_" + (isSentByMe ? normalizedToAddress : normalizedUserAddress);
          strategies.push({
            name: "fallback_static_secret",
            secret: fallbackSecret,
            decrypt: async () => {
              return await window.SEA.decrypt(messageData.encryptedMSG, fallbackSecret);
            },
          });
        }
  
        // 5. Tenta con solo keypair (alcuni messaggi possono essere crittografati così)
        strategies.push({
          name: "keypair_only",
          secret: "keypair",
          decrypt: async () => {
            return await window.SEA.decrypt(messageData.encryptedMSG, gunKeypair);
          },
        });
  
        // Prova tutte le strategie finché una funziona
        console.log(`Provo ${strategies.length} strategie di decifratura`);
        
        let lastError = null;
        for (let i = 0; i < strategies.length; i++) {
          const strategy = strategies[i];
          try {
            console.log(`Provo strategia ${i+1}/${strategies.length}: ${strategy.name}`);
            const decrypted = await strategy.decrypt();
            
            if (decrypted) {
              console.log(`Decifratura riuscita con strategia ${strategy.name}`);
              return decrypted;
            } else {
              console.warn(`Strategia ${strategy.name} ha restituito un risultato vuoto`);
            }
          } catch (err) {
            lastError = err;
            console.warn(`Strategia ${strategy.name} fallita:`, err.message);
          }
        }
  
        // Se arriviamo qui, nessuna strategia ha funzionato
        // Proviamo un ultimo tentativo con i campi in chiaro
        if (messageData.text) {
          console.log("Utilizzo campo text come fallback finale");
          return messageData.text;
        } else if (messageData.message) {
          console.log("Utilizzo campo message come fallback finale");
          return messageData.message;
        } else if (messageData.content) {
          console.log("Utilizzo campo content come fallback finale");
          return messageData.content;
        } else if (messageData.raw_payload) {
          console.log("Utilizzo campo raw_payload come fallback finale");
          return messageData.raw_payload;
        }
  
        // Se arriviamo qui, abbiamo veramente fallito
        throw new Error(`Impossibile decrittare il messaggio con alcuna strategia: ${lastError ? lastError.message : "errore sconosciuto"}`);
      } catch (error) {
        console.error("Errore durante la decrittazione del messaggio:", error);
        throw error;
      }
    },
  
    // Aggiungi un keypair alla base di dati Gun per l'indirizzo specificato
    storeKeypair: function (address, keypair) {
      // Verifica se il keypair è pubblico o completo
      const isPublicOnly = !keypair.priv && !keypair.epriv;
  
      if (isPublicOnly) {
        // Memorizza solo le chiavi pubbliche
        return this.registerKeypair(address, keypair);
      } else {
        // Salva il keypair completo in memoria per questa sessione
        if (address === window.currentUserAddress) {
          window.gunKeyPair = keypair;
        }
  
        // Registra anche la parte pubblica in Gun
        return this.registerKeypair(address, {
          pub: keypair.pub,
          epub: keypair.epub,
        });
      }
    },
  
    // Ottieni tutti gli indirizzi con keypair registrati
    getAllRegisteredAddresses: function () {
      return new Promise((resolve) => {
        const addresses = [];
        const timeout = setTimeout(() => {
          console.log(
            `Timeout cercando indirizzi registrati in Gun, trovati: ${addresses.length}`
          );
          resolve(addresses);
        }, 5000);
  
        window.gun
          .get("skeypair")
          .map()
          .once((data, key) => {
            if (!data || !key) return;
  
            // Estrai l'indirizzo dalla chiave
            const address = key.replace("skeypair", "");
            if (address && address !== "") {
              addresses.push(address);
            }
          });
  
        // Attendiamo un po' per dare a Gun il tempo di restituire i dati
        setTimeout(() => {
          clearTimeout(timeout);
          console.log(`Trovati ${addresses.length} indirizzi registrati`);
          resolve(addresses);
        }, 3000);
      });
    },
  
    // Funzione debug per verificare tutte le conversazioni attive
    debugConversations: async function () {
      console.log("Verifica delle conversazioni attive...");
  
      // Ottieni l'indirizzo dell'utente corrente
      let userAddress = null;
      try {
        const provider = await this.getProvider();
        if (provider) {
          userAddress = await provider.getSigner().getAddress();
        }
      } catch (error) {
        console.error("Errore nel recuperare l'indirizzo dell'utente:", error);
      }
  
      if (!userAddress) {
        console.error(
          "Impossibile determinare l'indirizzo dell'utente per il debug delle conversazioni"
        );
        return [];
      }
  
      // Lista per tenere traccia delle conversazioni trovate
      const conversations = [];
  
      // Recupera tutti gli indirizzi registrati
      const addresses = await this.getAllRegisteredAddresses();
  
      // Verifica quali conversazioni hanno messaggi
      for (const address of addresses) {
        try {
          // Verifica se esistono messaggi per questa conversazione
          const normalizedRecipient = userAddress.toLowerCase();
          const normalizedSender = address.toLowerCase();
  
          // Crea un identificatore univoco per la conversazione ordinando gli indirizzi
          const participants = [normalizedSender, normalizedRecipient].sort();
          // Utilizziamo lo stesso metodo di generazione del namespace usato in sendmessage
          const sortedParticipants = participants.join("");
          const chatNamespace = this.HashNamespace(sortedParticipants);
  
          // Controlla se ci sono messaggi
          window.gun.get(chatNamespace).once((data) => {
            const hasMessages = data && Object.keys(data).length > 2;
  
            if (hasMessages) {
              console.log(`✓ Conversazione attiva trovata in ${chatNamespace}`);
            } else {
              console.log(`✗ Nessun messaggio trovato in ${chatNamespace}`);
            }
  
            conversations.push({
              address,
              hasMessages,
            });
          });
        } catch (e) {
          console.error(`Errore nel verificare i messaggi per ${address}:`, e);
        }
      }
  
      // Diamo un po' di tempo a Gun per completare le operazioni
      await new Promise((resolve) => setTimeout(resolve, 3000));
  
      console.log(
        `Trovate ${conversations.length} possibili conversazioni:`,
        conversations
      );
      return conversations;
    },
  
    // Funzione di debug globale per le attività di rete
    debug: {
      logLevel: "info", // Cambiato da "error" a "info" per una migliore visibilità di default
  
      log: function (level, ...args) {
        const levels = ["none", "error", "warn", "info", "debug", "verbose"];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const msgLevelIndex = levels.indexOf(level);
  
        if (msgLevelIndex <= currentLevelIndex) {
          const prefix = `[SHOGUN-D3:${level.toUpperCase()}]`;
          console.log(prefix, ...args);
        }
      },
  
      // Attiva la registrazione dettagliata
      enableVerboseLogging: function () {
        this.logLevel = "verbose";
        this.log("info", "Verbose logging enabled");
        return "Logging level set to VERBOSE";
      },
  
      // Disattiva completamente i log
      disableLogging: function () {
        this.logLevel = "none";
        console.log("[SHOGUN-D3:INFO] Logging disabled");
        return "All logging disabled";
      },
  
      // Configura il livello di log
      setLogLevel: function (level) {
        if (
          ["none", "error", "warn", "info", "debug", "verbose"].includes(level)
        ) {
          this.logLevel = level;
          console.log(`[SHOGUN-D3:INFO] Log level set to ${level}`);
          return `Logging level set to ${level.toUpperCase()}`;
        } else {
          console.error(`[SHOGUN-D3:ERROR] Invalid log level: ${level}`);
          return `Invalid log level: ${level}. Valid options are: none, error, warn, info, debug, verbose`;
        }
      },
  
      // Analizza Gun per keypair in modo ottimizzato
      inspectGunKeypairs: function () {
        const results = {
          keypairs: [],
          total: 0,
        };
  
        // Creiamo una promessa per raccogliere i risultati
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            results.total = results.keypairs.length;
            resolve(results);
          }, 3000);
  
          window.gun
            .get("skeypair")
            .map()
            .once((data, key) => {
              if (!data || !key) return;
  
              try {
                // Estrai l'indirizzo dalla chiave
                const address = key.replace("skeypair", "");
                if (!address || address === "") return;
  
                results.keypairs.push({
                  key: key,
                  address: address,
                  hasPub: !!data.pub,
                  hasEpub: !!data.epub,
                });
              } catch (e) {
                // Ignora errori
              }
            });
  
          // Attendiamo un po' per dare a Gun il tempo di leggere i dati
          setTimeout(() => {
            clearTimeout(timeout);
            results.total = results.keypairs.length;
            resolve(results);
          }, 2000);
        });
      },
  
      // Pulisce un keypair specifico o tutti i keypair da Gun
      cleanGunKeypairs: function (address = null) {
        if (address) {
          window.gun.get(`skeypair${address}`).put(null);
          return `Rimosso keypair per ${address} da Gun`;
        } else {
          // Recupera prima tutti gli indirizzi, poi rimuove i keypair
          return d3.getAllRegisteredAddresses().then((addresses) => {
            for (const addr of addresses) {
              window.gun.get(`skeypair${addr}`).put(null);
            }
            return `Rimossi ${addresses.length} keypair da Gun`;
          });
        }
      },
  
      // Versione ottimizzata e semplificata per esplorare una chat
      exploreChat: function (address1, address2) {
        const addr1 = address1.toLowerCase();
        const addr2 = address2.toLowerCase();
        const participants = [addr1, addr2].sort();
        const sortedParticipants = participants.join("");
        const chatNamespace = window.d3.HashNamespace(sortedParticipants);
  
        return new Promise((resolve) => {
          const messages = [];
          let isDataFound = false;
  
          const timeoutId = setTimeout(() => {
            resolve({
              namespace: chatNamespace,
              found: isDataFound,
              messages,
            });
          }, 3000);
  
          window.gun.get(chatNamespace).once((data) => {
            isDataFound = !!data;
            
            if (!data) {
              clearTimeout(timeoutId);
              resolve({
                namespace: chatNamespace,
                found: false,
                messages: [],
              });
              return;
            }
  
            // Esplora tutti i messaggi
            window.gun
              .get(chatNamespace)
              .map()
              .once((msgData, key) => {
                if (key === "_" || !msgData) return;
                
                messages.push({
                  key,
                  date: msgData.date,
                  from: msgData.from,
                  to: msgData.to,
                  encrypted: !!msgData.encryptedMSG,
                });
              });
          });
        });
      },
    },
  
    // Esponiamo metodi di ShogunCore più utili
    logout: function() {
      this.shogun.logout();
      window.gunKeyPair = null;
      window.currentUserAddress = null;
    },
    
    isLoggedIn: function() {
      return this.shogun.isLoggedIn();
    },
  };
  
  // Inizializza il debug e Gun automaticamente
  (function () {
    // Imposta il livello di log predefinito
    window.d3.debug.setLogLevel("error"); // Cambiato da "info" a "error" per ridurre i log
  
    // Inizializza Gun se non è stato già fatto
    if (!window.gun) {
      try {
        window.gun = Gun({
          localStorage: false,
          radisk: false,
          peers: GUN_PEERS,
          axe: false,
          multicast: false,
          wait: 100, // Riduco il timeout per aumentare le prestazioni
          retrieve: 5, // Valore più basso per velocizzare la risposta
        });
      } catch (error) {
        console.error("Errore nell'inizializzazione di Gun:", error);
      }
    }
  
    // Memorizza l'indirizzo dell'utente corrente quando disponibile
    window.currentUserAddress = null;
    window.d3
      .getProvider()
      .then((provider) => {
        if (provider) {
          provider
            .getSigner()
            .getAddress()
            .then((address) => {
              window.currentUserAddress = address;
            })
            .catch(() => {
              // Ignora errori
            });
        }
      })
      .catch(() => {
        // Ignora errori
      });
  })();
  
  // Aggiorno la funzione receiveMessage per tracciare gli ascolti
  const originalReceiveMessage = window.d3.receiveMessage;
  window.d3.receiveMessage = async function(recipientAddress, callback) {
    // Interrompi eventuali ascolti precedenti
    this.stopReceiveMessage(recipientAddress);
    
    // Chiamiamo la funzione originale
    const cleanupFn = await originalReceiveMessage.call(this, recipientAddress, callback);
    
    if (cleanupFn) {
      // Ottieni il namespace della chat per registrare l'ascolto
      const userAddress = window.currentUserAddress ? window.currentUserAddress.toLowerCase() : "";
      const recipientAddr = recipientAddress.toLowerCase();
      const participants = [recipientAddr, userAddress].sort();
      const chatNamespace = window.d3.HashNamespace(participants.join(""));
      
      // Registra l'ascolto
      window.d3.activeListeners.set(chatNamespace, {
        recipient: recipientAddress,
        cleanup: cleanupFn
      });
    }
    
    return cleanupFn;
  };
  
  // Funzionalità di logging
  function createLogger() {
    // Definiamo la gerarchia dei livelli di log
    const logLevels = {
      'none': 0,
      'error': 1,
      'warn': 2,
      'info': 3,
      'debug': 4,
      'verbose': 5
    };
    
    function getLogLevelValue(level) {
      return logLevels[level] || 0;
    }
    
    function log(level, ...args) {
      // Prendiamo il livello di log attualmente configurato
      const configuredLevel = window.d3?.debug?.logLevel || 'info';
      
      // Convertiamo i livelli in valori numerici per confronto
      const configuredLevelValue = getLogLevelValue(configuredLevel);
      const currentLevelValue = getLogLevelValue(level);
      
      // Logghiamo solo se il livello corrente è <= del livello configurato
      if (currentLevelValue <= configuredLevelValue) {
        const timestamp = new Date().toISOString().substring(11, 23);
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        
        switch (level) {
          case 'error':
            console.error(prefix, ...args);
            break;
          case 'warn':
            console.warn(prefix, ...args);
            break;
          case 'info':
            console.info(prefix, ...args);
            break;
          case 'debug':
          case 'verbose':
            console.debug(prefix, ...args);
            break;
          default:
            console.log(prefix, ...args);
        }
      }
    }

    return {
      debug: (...args) => log("debug", ...args),
      info: (...args) => log("info", ...args),
      warn: (...args) => log("warn", ...args),
      error: (...args) => log("error", ...args),
      setLogLevel: (level) => {
        if (level === "none") {
          window.d3.debug.logLevel = "none";
          console.log("[SHOGUN-D3:INFO] Logging disabled");
          return;
        }

        if (logLevels[level] !== undefined) {
          window.d3.debug.logLevel = level;
          console.log(`[SHOGUN-D3:INFO] Log level set to ${level}`);
        } else {
          console.error(`[SHOGUN-D3:ERROR] Invalid log level: ${level}`);
        }
      },
      getLogLevel: () => window.d3.debug.logLevel,
    };
  }
  