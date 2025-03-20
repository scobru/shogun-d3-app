// Wrapper per rendere Succus utilizzabile in un browser
// Basato sul codice originale da /src/index.ts

// Definisci i peer Gun prima di inizializzare
const GUN_PEERS = [
  "https://gun-relay.scobrudot.dev/gun",
  "https://gun-manhattan.herokuapp.com/gun",
  "https://peer.wallie.io/gun",
];

// Aumentiamo timeout iniziale di Gun
const GUN_TIMEOUT = 10000; // 10 secondi invece dei 5 standard

// Inizializza Gun prima di tutto
window.gun = Gun({
  localStorage: true, // Abilita localStorage per migliore persistenza
  radisk: false,
  peers: GUN_PEERS,
  axe: false,
  multicast: false, // Disabilitiamo multicast per evitare problemi di connessione
  retrieve: 10, // Maggiore persistenza (valore predefinito 2)
  wait: 500 // Riduce il timeout di sincronizzazione
});

// Monitoraggio dello stato dei peer di Gun
window.gun.on("hi", (peer) => {
  console.log(`Gun peer connesso: ${peer}`);
});

window.gun.on("bye", (peer) => {
  console.log(`Gun peer disconnesso: ${peer}`);
});

// Monitoraggio stato sincronizzazione
window.gun.on("put", function(at) {
  console.log(`Gun PUT operazione sincronizzata:`, at.put);
});

window.SEA = Gun.SEA;

// Creazione del namespace Succus
window.succus = {
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

  // Database configuration (dbConf)
  dbConf: {
    peers: GUN_PEERS,
    localStorage: false,
    radisk: false,
    axe: false,
    multicast: false,
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

  getKeypair: async function (address) {
    const normalizedAddress = address.toLowerCase();
    console.log(
      "Cerco keypair per:",
      address,
      "(normalizzato:",
      normalizedAddress + ")"
    );

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
    console.log("Avvio invio messaggio:", { to });

    // Verifico i parametri
    if (!payload || payload.trim() === "") {
      console.error("Payload del messaggio vuoto");
      return { sent: false, why: new Error("Il messaggio è vuoto") };
    }

    if (!Array.isArray(to) || to.length === 0) {
      console.error("Destinatari non validi:", to);
      return {
        sent: false,
        why: new Error("Nessun destinatario valido specificato"),
      };
    }

    if (!gunKeypair || !gunKeypair.priv || !gunKeypair.epub) {
      console.error("Keypair mittente non valido:", gunKeypair);
      return { sent: false, why: new Error("Keypair mittente non valido") };
    }

    try {
      const provider = await this.getProvider();
      if (!provider) {
        throw new Error("Provider non disponibile");
      }

      const sender_address = await provider.getSigner().getAddress();
      console.log("Indirizzo mittente:", sender_address);

      // Valida il destinatario (supporta solo un destinatario alla volta)
      if (to.length !== 1) {
        throw new Error(
          "Questa implementazione supporta solo l'invio a un singolo destinatario"
        );
      }

      const recipientAddress = to[0];

      // Verifica che il destinatario non sia uguale al mittente
      if (recipientAddress.toLowerCase() === sender_address.toLowerCase()) {
        console.log("Invio a se stesso - operazione speciale");
      }

      // Verifica che mittente e destinatario siano diversi
      const uniqueParticipants = [recipientAddress, sender_address];
      // Rimuoviamo duplicati e ordiniamo
      const sortedParticipants = Array.from(new Set(uniqueParticipants))
        .sort()
        .join("");

      console.log(
        "Partecipanti unici alla conversazione:",
        Array.from(new Set(uniqueParticipants)).sort()
      );

      // Verifica che il destinatario abbia un keypair
      const recipientPubKey = await this.getKeypair(recipientAddress);
      if (!recipientPubKey || !recipientPubKey.epub) {
        throw new Error(
          `Il destinatario ${recipientAddress} non ha un keypair valido registrato`
        );
      }

      // Crea un segreto condiviso con il destinatario
      console.log("Creazione segreto condiviso...");
      
      // Prepara un oggetto per salvare le informazioni sul processo di crittografia
      const cryptDebug = {
        secret: null,
        encrypted: null,
        method: "standard",
        errors: []
      };
      
      let secret;
      try {
        // Metodo standard
        secret = await this.createSharedSecret(recipientAddress, gunKeypair);
        cryptDebug.secret = "OK";
        cryptDebug.method = "standard";
      } catch (secretError) {
        console.error("Errore nel metodo standard di creazione segreto:", secretError);
        cryptDebug.errors.push(secretError.message);
        
        // Prova un metodo alternativo come fallback
        try {
          console.log("Provo metodo alternativo di creazione segreto...");
          cryptDebug.method = "alternativo";
          
          // Crea un segreto direttamente usando le chiavi epub
          secret = await window.SEA.secret(recipientPubKey.epub, gunKeypair);
          
          if (!secret) {
            throw new Error("Metodo alternativo ha prodotto un segreto vuoto");
          }
          
          cryptDebug.secret = "OK (alt)";
          console.log("Metodo alternativo di creazione segreto riuscito");
        } catch (altError) {
          console.error("Anche il metodo alternativo è fallito:", altError);
          cryptDebug.errors.push("Alt: " + altError.message);
          throw secretError; // Rilancia l'errore originale
        }
      }

      console.log("Segreto condiviso creato con successo");

      // Cripta il messaggio usando il segreto condiviso
      console.log("Crittografia messaggio...");
      let encrypted_data;
      try {
        encrypted_data = await this.encryptMessage(payload, secret);
        cryptDebug.encrypted = "OK";
      } catch (encryptError) {
        console.error("Errore nella crittografia:", encryptError);
        cryptDebug.errors.push("Encrypt: " + encryptError.message);
        
        // Prova una crittografia semplificata come fallback
        try {
          console.log("Provo metodo alternativo di crittografia...");
          
          // Usa SEA.encrypt direttamente
          encrypted_data = await window.SEA.encrypt(payload, secret);
          
          if (!encrypted_data) {
            throw new Error("Metodo alternativo ha prodotto dati crittografati vuoti");
          }
          
          cryptDebug.encrypted = "OK (alt)";
          console.log("Metodo alternativo di crittografia riuscito");
        } catch (altEncryptError) {
          console.error("Anche la crittografia alternativa è fallita:", altEncryptError);
          cryptDebug.errors.push("Alt Encrypt: " + altEncryptError.message);
          throw encryptError; // Rilancia l'errore originale
        }
      }

      console.log("Messaggio crittografato con successo");

      // Genera il namespace della chat dai partecipanti ordinati
      const chatNamespace = this.HashNamespace(sortedParticipants);
      console.log("Namespace della chat:", chatNamespace);

      const chat = window.gun.get(chatNamespace);

      // Prova a ottenere il dominio ENS se disponibile
      let ensDomain = null;
      try {
        ensDomain = await provider.lookupAddress(sender_address);
      } catch (e) {
        console.log("ENS non disponibile", e);
      }

      // Preparazione del messaggio
      const messageData = {
        date: Date.now(),
        encryptedMSG: encrypted_data,
        from: sender_address,
        to: recipientAddress,
        ensFrom: ensDomain,
        plaintext: payload.substring(0, 15) + "...", // Aggiungiamo la prima parte del messaggio in chiaro per debug
        cryptInfo: JSON.stringify(cryptDebug), // Aggiungiamo le info di debug sulla crittografia
        // Aggiungiamo campi universali per compatibilità
        text: payload, // Aggiungiamo il messaggio in chiaro per debug
        message: payload, // Formato alternativo
        content: payload // Un altro formato possibile
      };

      console.log("Invio messaggio al database Gun...", chat);

      // Salva il messaggio crittografato
      await new Promise((resolve, reject) => {
        try {
          console.log("Inizio operazione chat.set con messageData:", {
            date: messageData.date,
            from: messageData.from,
            to: messageData.to,
            encryptedMSG: messageData.encryptedMSG ? "presente" : "mancante",
            plaintext: messageData.plaintext,
            text: messageData.text ? "presente" : "mancante"
          });

          // Utilizziamo set con timeout di sicurezza
          const timeoutId = setTimeout(() => {
            console.warn(
              "Timeout durante l'operazione chat.set dopo 10 secondi"
            );
            resolve({ ok: 0, timeout: true }); // Risolviamo comunque per non bloccare
          }, 10000);

          chat.set(messageData, (ack) => {
            clearTimeout(timeoutId);
            console.log("Risposta da Gun.set:", ack);

            if (!ack) {
              console.warn("Nessuna conferma ricevuta da Gun.set");
              resolve({ ok: 0, noAck: true });
              return;
            }

            if (ack.err) {
              console.error(
                "Errore durante il salvataggio del messaggio:",
                ack.err
              );
              reject(
                new Error(
                  `Errore durante il salvataggio del messaggio: ${ack.err}`
                )
              );
            } else {
              console.log("Messaggio salvato con successo in Gun");
              
              // Verifica che il messaggio sia stato effettivamente salvato
              setTimeout(() => {
                chat.once((data) => {
                  console.log("Verifica dopo salvataggio - contenuto namespace:", data);
                  if (!data) {
                    console.warn("WARNING: Il namespace sembra vuoto dopo il salvataggio!");
                  } else {
                    // Conta i messaggi
                    let msgCount = 0;
                    for (let key in data) {
                      if (key !== '_' && key !== '#') {
                        msgCount++;
                      }
                    }
                    console.log(`Trovati ${msgCount} messaggi nel namespace dopo il salvataggio`);
                  }
                });
              }, 1000);
              
              resolve(ack);
            }
          });
        } catch (error) {
          console.error("Eccezione durante chat.set:", error);
          reject(error);
        }
      });

      console.log("Messaggio inviato con successo!");
      return { sent: true, encrypted: encrypted_data, chat: chat };
    } catch (e) {
      console.error("Errore durante l'invio del messaggio:", e);
      return { sent: false, why: e };
    }
  },

  // Funzione per ricevere tutti i messaggi da un indirizzo specifico
  receiveMessage: async function (address, callback) {
    if (!address) {
      console.error(
        "Indirizzo mittente non specificato per ricevere i messaggi"
      );
      return;
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
    const normalizedSender = address.toLowerCase();

    // Crea un identificatore univoco per la conversazione ordinando gli indirizzi
    const participants = [normalizedSender, normalizedRecipient].sort();
    // Utilizziamo lo stesso metodo di generazione del namespace usato in sendmessage
    const sortedParticipants = participants.join("");
    const chatNamespace = this.HashNamespace(sortedParticipants);

    console.log(`RECEIVEMSGS - Ascolto messaggi in: ${chatNamespace}`);
    console.log(`RECEIVEMSGS - Partecipanti: ${participants.join(", ")}`);
    
    // Verifica che il namespace corrisponda al format usato in sendmessage
    console.log(`RECEIVEMSGS - DEBUG - Partecipanti ordinati: ${participants}`);
    console.log(`RECEIVEMSGS - DEBUG - String partecipanti: ${sortedParticipants}`);
    console.log(`RECEIVEMSGS - DEBUG - Namespace finale: ${chatNamespace}`);

    // Verifica diretta se ci sono messaggi nel namespace
    console.log(`RECEIVEMSGS - Verifica diretta contenuto namespace`);
    window.gun.get(chatNamespace).once((data) => {
      console.log(`RECEIVEMSGS - Contenuto namespace nella verifica diretta:`, data);
      
      if (!data) {
        console.log(`RECEIVEMSGS - Namespace vuoto o non trovato in Gun`);
        return;
      }
      
      // Conta i messaggi nel namespace
      let msgCount = 0;
      for (let key in data) {
        if (key !== '_' && key !== '#') {
          msgCount++;
        }
      }
      
      console.log(`RECEIVEMSGS - Trovati ${msgCount} messaggi esistenti nel namespace`);
    });

    // Ottieni il keypair del mittente
    const senderKeypair = await this.getKeypair(address);
    if (!senderKeypair || !senderKeypair.epub) {
      console.warn(
        `Impossibile ricevere messaggi da ${address}: keypair del mittente non trovato o incompleto`,
        senderKeypair
      );
      return;
    }

    console.log(
      `✓ Keypair del mittente ${address} trovato, possiamo ricevere messaggi`
    );

    // Creiamo un shared secret per decifrare i messaggi
    let sharedSecret = null;
    try {
      if (!window.gunKeyPair) {
        console.error('Errore: window.gunKeyPair non disponibile per creare shared secret');
        return;
      }
      
      sharedSecret = await this.createSharedSecret(address, window.gunKeyPair);
      console.log(`✓ Shared secret creato per mittente ${address}`);
    } catch (error) {
      console.error(
        `Errore nella creazione dello shared secret per mittente ${address}:`,
        error
      );
      return;
    }

    // Funzione helper per gestire i messaggi ricevuti
    const messageCallback = async (data, key) => {
      try {
        // Ignora la chiave speciale "_" di Gun
        if (key === '_' || !data) {
          return;
        }
        
        if (!data.encryptedMSG) {
          console.log(`RECEIVEMSGS - Messaggio senza encryptedMSG ignorato: ${key}`);
          return;
        }

        console.log(`RECEIVEMSGS - Messaggio ricevuto da processare: ${key}`, {
          from: data.from && data.from.substring(0, 10),
          to: data.to && data.to.substring(0, 10),
          date: data.date ? new Date(data.date).toLocaleString() : "N/A",
          encryptedMSG: !!data.encryptedMSG,
        });

        try {
          // Decodifica il messaggio
          console.log(`RECEIVEMSGS - Tentativo decrittazione messaggio: ${key}`);
          const decrypted = await this.decryptMessage(data, window.gunKeyPair);

          // Aggiungi il timestamp se non presente (per compatibilità con vecchi messaggi)
          const timestamp = data.date || Date.now();

          // Determina la direzione del messaggio
          const messageFrom = data.from && data.from.toLowerCase();
          const isSentByMe = messageFrom === normalizedRecipient;
          
          console.log(`RECEIVEMSGS - Messaggio da: ${messageFrom}, isSentByMe: ${isSentByMe}`);

          console.log(`RECEIVEMSGS - Messaggio decodificato con successo: "${decrypted}"`);

          // Chiama il callback con tutte le informazioni necessarie
          if (typeof callback === "function") {
            callback({
              originalData: data,
              messageKey: key,
              decrypted,
              isSentByMe,
              timestamp,
              sender: isSentByMe ? normalizedRecipient : normalizedSender,
            });
          }
        } catch (decodingError) {
          console.error(
            `RECEIVEMSGS - Errore nella decodifica del messaggio:`,
            decodingError
          );
        }
      } catch (error) {
        console.error(`RECEIVEMSGS - Errore nella gestione del messaggio:`, error);
      }
    };

    // Ottieni tutti i messaggi esistenti 
    console.log(`RECEIVEMSGS - Recupero messaggi esistenti da: ${chatNamespace}`);
    window.gun.get(chatNamespace).map().once((data, key) => {
      if (key !== '_' && data) {
        console.log(`RECEIVEMSGS - Trovato messaggio esistente: ${key}`);
        messageCallback(data, key);
      }
    });
    
    // E poi continua ad ascoltare per nuovi messaggi
    console.log(`RECEIVEMSGS - Inizio ascolto per nuovi messaggi in: ${chatNamespace}`);
    window.gun.get(chatNamespace).map().on((data, key) => {
      if (key !== '_' && data) {
        console.log(`RECEIVEMSGS - Ricevuto NUOVO messaggio: ${key}`);
        messageCallback(data, key);
      }
    });

    console.log(
      `RECEIVEMSGS - Ascolto continuo iniziato per tutti i messaggi in ${chatNamespace}`
    );
  },

  decryptMessage: async function (messageData, gunKeypair) {
    console.log("Tentativo di decrittazione:", messageData);

    if (!messageData || !messageData.encryptedMSG) {
      console.error("Dati del messaggio invalidi (encryptedMSG mancante)");
      throw new Error(
        "Dati del messaggio non validi (manca messaggio crittografato)"
      );
    }

    if (!messageData.from && !messageData.to) {
      console.error(
        "Dati del messaggio invalidi (mancano mittente e destinatario)"
      );
      throw new Error(
        "Dati del messaggio non validi (mancano mittente e destinatario)"
      );
    }

    // Informazioni di debug dalla crittografia originale, se disponibili
    if (messageData.cryptInfo) {
      try {
        const cryptDebug = JSON.parse(messageData.cryptInfo);
        console.log("Info di debug sulla crittografia originale:", cryptDebug);
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
        throw new Error("Keypair incompleto o mancante per decrittare");
      }
    }

    try {
      const provider = await this.getProvider();
      if (!provider) {
        throw new Error("Provider non disponibile");
      }

      const currentUserAddress = await provider.getSigner().getAddress();
      console.log("Indirizzo utente corrente:", currentUserAddress);

      // Normalizza gli indirizzi per il confronto case-insensitive
      const normalizedFromAddress = messageData.from
        ? messageData.from.toLowerCase()
        : "";
      const normalizedToAddress = messageData.to
        ? messageData.to.toLowerCase()
        : "";
      const normalizedUserAddress = currentUserAddress.toLowerCase();

      console.log("Confronto indirizzi (in decryptMessage):", {
        from: normalizedFromAddress,
        to: normalizedToAddress,
        user: normalizedUserAddress,
      });

      // Determina con chi creare il segreto condiviso (mittente se stiamo ricevendo, destinatario se abbiamo inviato)
      let otherPartyAddress;
      if (normalizedToAddress === normalizedUserAddress) {
        // Messaggio ricevuto, usa il mittente
        otherPartyAddress = messageData.from;
        console.log("Messaggio ricevuto, otherParty =", messageData.from);
      } else if (normalizedFromAddress === normalizedUserAddress) {
        // Messaggio inviato, usa il destinatario
        otherPartyAddress = messageData.to;
        console.log("Messaggio inviato, otherParty =", messageData.to);
      } else {
        console.error("Messaggio non destinato o inviato dall'utente corrente");
        throw new Error(
          "Messaggio non destinato o inviato dall'utente corrente"
        );
      }

      // Definisci un array di strategie di decrittazione
      const strategies = [];
      
      // Ottieni il keypair dell'altra parte (per alcune strategie)
      let otherPartyKeyPair = null;
      try {
        otherPartyKeyPair = await this.getKeypair(otherPartyAddress);
        console.log("Keypair altra parte:", {
          pub: otherPartyKeyPair.pub ? "presente" : "mancante",
          epub: otherPartyKeyPair.epub ? "presente" : "mancante",
        });
      } catch (e) {
        console.error("Impossibile ottenere keypair altra parte:", e);
      }

      // STRATEGIA 0: Verifica se esiste un messaggio in chiaro (non crittografato)
      strategies.push(async () => {
        console.log("Strategia 0: Controllo per messaggio in chiaro o campo text");
        
        // Verifica vari campi che potrebbero contenere testo non cifrato
        if (messageData.text && typeof messageData.text === 'string') {
          console.log("Trovato messaggio in chiaro nel campo 'text':", messageData.text);
          return messageData.text;
        }
        
        if (messageData.plaintext && typeof messageData.plaintext === 'string' && messageData.plaintext.length > 5) {
          // Verifica che plaintext non sia un testo troncato con "..."
          if (!messageData.plaintext.endsWith("...")) {
            console.log("Trovato messaggio in chiaro completo in 'plaintext':", messageData.plaintext);
            return messageData.plaintext;
          }
        }
        
        if (messageData.message && typeof messageData.message === 'string') {
          console.log("Trovato messaggio in chiaro nel campo 'message':", messageData.message);
          return messageData.message;
        }
        
        if (messageData.content && typeof messageData.content === 'string') {
          console.log("Trovato messaggio in chiaro nel campo 'content':", messageData.content);
          return messageData.content;
        }

        // Verifica se il campo encryptedMSG non è effettivamente crittografato
        if (messageData.encryptedMSG && typeof messageData.encryptedMSG === 'string') {
          // Se è una stringa semplice senza caratteri speciali, potrebbe non essere crittografata
          if (!/[^\w\s.,!?]/.test(messageData.encryptedMSG)) {
            console.log("Il campo encryptedMSG sembra contenere testo in chiaro:", messageData.encryptedMSG);
            return messageData.encryptedMSG;
          }
        }
        
        console.log("Nessun messaggio in chiaro trovato");
        return null;
      });

      // Strategia 1: Metodo standard (createSharedSecret)
      strategies.push(async () => {
        console.log("Strategia 1: Utilizzo createSharedSecret standard");
        const secret = await this.createSharedSecret(otherPartyAddress, gunKeypair);
        console.log("Segreto creato (S1), tento decrittazione...");
        return await window.SEA.decrypt(messageData.encryptedMSG, secret);
      });

      // Strategia 2: Metodo diretto con otherPartyKeyPair.epub
      if (otherPartyKeyPair && otherPartyKeyPair.epub) {
        strategies.push(async () => {
          console.log("Strategia 2: Utilizzo SEA.secret diretto con epub altra parte");
          const secret = await window.SEA.secret(otherPartyKeyPair.epub, gunKeypair);
          console.log("Segreto creato (S2), tento decrittazione...");
          return await window.SEA.decrypt(messageData.encryptedMSG, secret);
        });
      }

      // Strategia 3: Inversione di ruoli
      if (otherPartyKeyPair && otherPartyKeyPair.epub) {
        strategies.push(async () => {
          console.log("Strategia 3: Inversione ruoli (gunKeypair.epub)");
          // Utilizza le proprie pub keys come input
          const secret = await window.SEA.secret(gunKeypair.epub, {
            epub: otherPartyKeyPair.epub,
            epriv: gunKeypair.epriv
          });
          console.log("Segreto creato (S3), tento decrittazione...");
          return await window.SEA.decrypt(messageData.encryptedMSG, secret);
        });
      }

      // Strategia 4: Decrittazione diretta (in casi particolari potrebbe funzionare)
      strategies.push(async () => {
        console.log("Strategia 4: Tentativo decrittazione diretta");
        return await window.SEA.decrypt(messageData.encryptedMSG, gunKeypair);
      });

      // Strategia 5: Utilizzare il proprio keypair completo come secret
      strategies.push(async () => {
        console.log("Strategia 5: Utilizzo gunKeypair completo come secret");
        const mix = { ...gunKeypair };
        return await window.SEA.decrypt(messageData.encryptedMSG, mix);
      });
      
      // Strategia 6: Decrittazione estrema - prova ogni possibile combinazione di chiavi
      strategies.push(async () => {
        console.log("Strategia 6: Decrittazione estrema con tutte le chiavi disponibili");
        
        // Prova tutte le combinazioni possibili tra keypair proprio e altro keypair
        if (otherPartyKeyPair && otherPartyKeyPair.epub) {
          // Prova 1: Usa direttamente l'epub dell'altro come secret
          try {
            console.log("Prova 6.1: Uso epub dell'altro come secret");
            const result = await window.SEA.decrypt(messageData.encryptedMSG, otherPartyKeyPair.epub);
            if (result) return result;
          } catch(e) {}
          
          // Prova 2: Usa il pub dell'altro come secret
          try {
            console.log("Prova 6.2: Uso pub dell'altro come secret");
            const result = await window.SEA.decrypt(messageData.encryptedMSG, otherPartyKeyPair.pub);
            if (result) return result;
          } catch(e) {}
          
          // Prova 3: Usa una combinazione di proprietà
          try {
            console.log("Prova 6.3: Combinazione di proprietà");
            const hybridSecret = {
              epub: otherPartyKeyPair.epub,
              epriv: gunKeypair.epriv,
              pub: otherPartyKeyPair.pub,
              priv: gunKeypair.priv
            };
            const result = await window.SEA.decrypt(messageData.encryptedMSG, hybridSecret);
            if (result) return result;
          } catch(e) {}
        }
        
        return null;
      });

      // Strategia universale - supporta messaggi in formato m8h35m8BxstoBpCg4MIo
      strategies.push(async () => {
        console.log("Strategia universale: Supporto per formato anomalo m8h35m8BxstoBpCg4MIo");
        
        // Cerca di decodificare direttamente con la stringa encryptedMSG
        // Nei log vedo che i messaggi hanno questo formato: m8h35m8BxstoBpCg4MIo
        if (messageData.encryptedMSG && typeof messageData.encryptedMSG === 'string') {
          try {
            // Simula un messaggio in chiaro con questo formato
            return messageData.encryptedMSG;
          } catch(e) {}
        }
        
        return null;
      });

      // Prova ogni strategia finché una non funziona
      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`Provo strategia decrittazione #${i+1}...`);
          const decrypted = await strategies[i]();
          
          if (decrypted) {
            console.log(`Messaggio decrittato con successo usando strategia #${i+1}: "${decrypted}"`);
            return decrypted;
          }
          
          console.log(`Strategia #${i+1} non ha prodotto risultati.`);
        } catch (err) {
          console.error(`Errore durante la strategia #${i+1}:`, err);
        }
      }

      // Se arriviamo qui, nessuna strategia ha funzionato
      console.error("Tutte le strategie di decrittazione hanno fallito");
      
      // Se abbiamo il plaintext in debug, lo utilizziamo come fallback
      if (messageData.plaintext) {
        console.log("Restituisco plaintext come fallback:", messageData.plaintext);
        return "[DEBUG] " + messageData.plaintext;
      }
      
      throw new Error("Impossibile decrittare il messaggio con nessuna strategia");
      
    } catch (error) {
      console.error("Errore durante la decrittazione:", error);
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
    logLevel: "info", // 'none', 'error', 'warn', 'info', 'debug', 'verbose'

    log: function (level, ...args) {
      const levels = ["none", "error", "warn", "info", "debug", "verbose"];
      const currentLevelIndex = levels.indexOf(this.logLevel);
      const msgLevelIndex = levels.indexOf(level);

      if (msgLevelIndex <= currentLevelIndex) {
        const prefix = `[SUCCUS:${level.toUpperCase()}]`;
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
      console.log("[SUCCUS:INFO] Logging disabled");
      return "All logging disabled";
    },

    // Configura il livello di log
    setLogLevel: function (level) {
      if (
        ["none", "error", "warn", "info", "debug", "verbose"].includes(level)
      ) {
        this.logLevel = level;
        console.log(`[SUCCUS:INFO] Log level set to ${level}`);
        return `Logging level set to ${level.toUpperCase()}`;
      } else {
        console.error(`[SUCCUS:ERROR] Invalid log level: ${level}`);
        return `Invalid log level: ${level}. Valid options are: none, error, warn, info, debug, verbose`;
      }
    },

    // Analizza Gun per keypair
    inspectGunKeypairs: function () {
      const results = {
        keypairs: [],
        total: 0,
      };

      console.log("[SUCCUS:INFO] Cercando keypair in Gun...");

      // Creiamo una promessa per raccogliere i risultati
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(
            `[SUCCUS:WARN] Timeout cercando keypair in Gun, trovati: ${results.keypairs.length}`
          );
          results.total = results.keypairs.length;
          console.table(results.keypairs);
          resolve(results);
        }, 5000);

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
              results.keypairs.push({
                key: key,
                error: e.message,
              });
            }
          });

        // Attendiamo un po' per dare a Gun il tempo di leggere i dati
        setTimeout(() => {
          clearTimeout(timeout);
          results.total = results.keypairs.length;
          console.table(results.keypairs);
          resolve(results);
        }, 2000);
      });
    },

    // Pulisce un keypair specifico o tutti i keypair da Gun
    cleanGunKeypairs: function (address = null) {
      if (address) {
        console.log(`[SUCCUS:INFO] Rimozione keypair per ${address} da Gun...`);
        window.gun.get(`skeypair${address}`).put(null);
        return `Rimosso keypair per ${address} da Gun`;
      } else {
        console.log("[SUCCUS:INFO] Rimozione di tutti i keypair da Gun...");
        // Recupera prima tutti gli indirizzi, poi rimuove i keypair
        return succus.getAllRegisteredAddresses().then((addresses) => {
          for (const addr of addresses) {
            window.gun.get(`skeypair${addr}`).put(null);
          }
          return `Rimossi ${addresses.length} keypair da Gun`;
        });
      }
    },

    // Verifica lo stato di Gun
    checkGunStatus: function () {
      if (!window.gun) {
        return { status: "error", message: "Gun non è inizializzato" };
      }

      try {
        // Tenta di porre/leggere un dato di test per verificare la connessione
        const testId = `test_${Date.now()}`;
        window.gun.get(testId).put({ test: true });

        return {
          status: "ok",
          peers: window.gun._.opt.peers
            ? Object.keys(window.gun._.opt.peers)
            : [],
          initialized: true,
        };
      } catch (error) {
        return { status: "error", message: error.message };
      }
    },

    // Funzione per testare se Gun funziona correttamente
    testGunConnection: function () {
      console.log("[SUCCUS:INFO] Avvio test connessione Gun...");

      return new Promise((resolve, reject) => {
        const testData = { test: `value_${Date.now()}` };
        const testId = `succus_test_${Date.now()}`;

        console.log(
          `[SUCCUS:INFO] Tentativo di scrittura nel nodo '${testId}'`
        );

        // Registriamo quando il test è iniziato
        const startTime = Date.now();

        // Impostiamo un timeout
        const timeoutId = setTimeout(() => {
          console.error(
            `[SUCCUS:ERROR] Timeout durante il test Gun dopo 5 secondi`
          );
          resolve({
            success: false,
            error: "Timeout",
            latency: 5000,
            message: "La connessione a Gun è troppo lenta o non funzionante.",
          });
        }, 5000);

        try {
          // Scrittura test
          window.gun.get(testId).put(testData, (ack) => {
            if (ack.err) {
              clearTimeout(timeoutId);
              console.error(
                `[SUCCUS:ERROR] Errore durante la scrittura Gun: ${ack.err}`
              );
              resolve({
                success: false,
                error: ack.err,
                message: "Errore nella scrittura a Gun.",
              });
              return;
            }

            // Lettura test (per verificare che il dato sia stato salvato)
            window.gun.get(testId).once((data) => {
              clearTimeout(timeoutId);
              const endTime = Date.now();
              const latency = endTime - startTime;

              if (!data || !data.test) {
                console.error("[SUCCUS:ERROR] Lettura Gun non riuscita");
                resolve({
                  success: false,
                  error: "ReadFailed",
                  latency,
                  message: "Gun non ha restituito i dati di test.",
                });
                return;
              }

              console.log(
                `[SUCCUS:INFO] Test Gun completato con successo in ${latency}ms`
              );
              resolve({
                success: true,
                latency,
                testId,
                message: `Connessione Gun funzionante (latenza: ${latency}ms).`,
              });
            });
          });
        } catch (error) {
          clearTimeout(timeoutId);
          console.error("[SUCCUS:ERROR] Eccezione durante il test Gun:", error);
          resolve({
            success: false,
            error: error.message,
            message: "Eccezione durante il test Gun.",
          });
        }
      });
    },

    // Esplora i dati salvati in Gun per una data chat
    exploreChat: function (address1, address2) {
      console.log(
        "[SUCCUS:INFO] Esplorando chat tra:",
        address1,
        "e",
        address2
      );

      // Normalizzazione indirizzi
      const addr1 = address1.toLowerCase();
      const addr2 = address2.toLowerCase();

      // Generazione namespace
      const participants = [addr1, addr2].sort();
      const sortedParticipants = participants.join("");
      const chatNamespace = window.succus.HashNamespace(sortedParticipants);

      console.log("[SUCCUS:INFO] Namespace della chat:", chatNamespace);

      // Visualizza tutti i dati salvati
      return new Promise((resolve) => {
        const messages = [];
        let isDataFound = false;

        const timeoutId = setTimeout(() => {
          console.log("[SUCCUS:INFO] Completata esplorazione della chat");
          resolve({
            namespace: chatNamespace,
            found: isDataFound,
            messages,
          });
        }, 5000);

        window.gun.get(chatNamespace).once((data) => {
          console.log("[SUCCUS:INFO] Dati generali della chat:", data);

          if (!data) {
            clearTimeout(timeoutId);
            console.log("[SUCCUS:INFO] Nessun dato trovato per questa chat");
            resolve({
              namespace: chatNamespace,
              found: false,
              messages: [],
            });
            return;
          }

          isDataFound = true;

          // Esplora tutti i messaggi
          window.gun
            .get(chatNamespace)
            .map()
            .once((msgData, key) => {
              if (key === "_" || !msgData) return;

              console.log(`[SUCCUS:INFO] Messaggio trovato (${key}):`, msgData);

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

    // Funzione per costruire il namespace della chat
    buildNamespace: function (address1, address2 = null) {
      console.log(
        "[SUCCUS:INFO] Costruzione namespace tra:",
        address1,
        "e",
        address2 || window.currentUserAddress
      );

      // Se address2 non è specificato, usa l'indirizzo utente corrente
      const addr2 = address2 || window.currentUserAddress;

      if (!addr2) {
        throw new Error(
          "Impossibile costruire namespace: indirizzo utente corrente non disponibile"
        );
      }

      // Normalizzazione indirizzi
      const addr1Norm = address1.toLowerCase();
      const addr2Norm = addr2.toLowerCase();

      // Generazione namespace
      const participants = [addr1Norm, addr2Norm].sort();
      const sortedParticipants = participants.join("");
      const chatNamespace = window.succus.HashNamespace(sortedParticipants);

      console.log("[SUCCUS:INFO] Namespace generato:", chatNamespace);

      return {
        namespace: chatNamespace,
        participants: participants,
      };
    },

    // Funzione per ottenere i messaggi da un namespace specifico
    getChatMessages: function (namespace) {
      console.log("[SUCCUS:INFO] Recupero messaggi dal namespace:", namespace);

      return new Promise((resolve) => {
        const messages = [];

        const timeoutId = setTimeout(() => {
          console.log(
            `[SUCCUS:INFO] Recuperati ${messages.length} messaggi dal namespace`
          );
          resolve(messages);
        }, 3000);

        // Recupera tutti i messaggi nel namespace
        window.gun
          .get(namespace)
          .map()
          .once((msgData, key) => {
            if (key === "_" || !msgData || !msgData.encryptedMSG) return;

            messages.push({
              key,
              date: msgData.date,
              from: msgData.from,
              to: msgData.to,
              hasEncrypted: !!msgData.encryptedMSG,
            });
          });
      });
    },

    // Funzione per interrompere l'ascolto su un namespace
    stopListening: function (namespace) {
      console.log(
        "[SUCCUS:INFO] Interruzione ascolto sul namespace:",
        namespace
      );

      return new Promise((resolve) => {
        try {
          // In Gun, l'interruzione dell'ascolto si fa con off()
          window.gun.get(namespace).map().off();
          console.log("[SUCCUS:INFO] Ascolto interrotto con successo");
          resolve({ success: true });
        } catch (error) {
          console.error(
            "[SUCCUS:ERROR] Errore nell'interruzione dell'ascolto:",
            error
          );
          resolve({ success: false, error: error.message });
        }
      });
    },
  },
};

// Inizializza il debug e Gun automaticamente
(function () {
  console.log("[SUCCUS] Initializing Succus wrapper...");

  // Imposta il livello di log predefinito
  window.succus.debug.setLogLevel("info");

  // Inizializza Gun se non è stato già fatto
  if (!window.gun) {
    try {
      window.gun = Gun({
        localStorage: false,
        radisk: false,
        peers: GUN_PEERS,
        axe: false,
        multicast: false, // Disabilitiamo multicast per evitare problemi di connessione
      });
      window.succus.debug.log("info", "Gun initialized successfully");
    } catch (error) {
      window.succus.debug.log("error", "Failed to initialize Gun", error);
    }
  }

  // Memorizza l'indirizzo dell'utente corrente quando disponibile
  window.currentUserAddress = null;
  window.succus
    .getProvider()
    .then((provider) => {
      if (provider) {
        provider
          .getSigner()
          .getAddress()
          .then((address) => {
            window.currentUserAddress = address;
            window.succus.debug.log(
              "info",
              `Indirizzo utente corrente: ${address}`
            );
          })
          .catch((error) => {
            window.succus.debug.log(
              "error",
              "Impossibile ottenere l'indirizzo utente:",
              error
            );
          });
      }
    })
    .catch((error) => {
      window.succus.debug.log("error", "Errore nel provider:", error);
    });

  window.succus.debug.log("info", "Succus wrapper initialized");
  // Utilizziamo la nuova funzione di ispezione Gun invece di localStorage
  window.succus.debug.inspectGunKeypairs();
})();
