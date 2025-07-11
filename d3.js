// Shogun-D3: Decentralized Messaging Library
// Browser-compatible version

(function() {
  'use strict';

  // Configuration
  const GUN_PEERS = [
    "wss://ruling-mastodon-improved.ngrok-free.app/gun",
    "https://gun-manhattan.herokuapp.com/gun",
    "https://peer.wallie.io/gun",
  ];
  
  const GUN_TIMEOUT = 10000;

  // Utility functions
  function checkVersion(current, required) {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);
    
    const currMajor = currentParts[0] || 0;
    const currMinor = currentParts[1] || 0;
    const currPatch = currentParts[2] || 0;
    
    const reqMajor = requiredParts[0] || 0;
    const reqMinor = requiredParts[1] || 0;
    const reqPatch = requiredParts[2] || 0;
    
    if (currMajor !== reqMajor) return currMajor > reqMajor;
    if (currMinor !== reqMinor) return currMinor > reqMinor;
    return currPatch >= reqPatch;
  }

  function waitForShogunCore() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 20;
      
      function checkShogunCore() {
        attempts++;
        
        if (typeof window.ShogunCore !== 'undefined') {
          const CoreClass = window.ShogunCore.default || window.ShogunCore.ShogunCore || window.ShogunCore;
          
          if (typeof CoreClass === 'function') {
            console.log("✓ ShogunCore trovato:", CoreClass);
            resolve(CoreClass);
          } else {
            console.warn("⚠️ ShogunCore trovato ma non è una classe valida:", window.ShogunCore);
            if (attempts >= maxAttempts) {
              reject(new Error("ShogunCore non è una classe valida"));
            } else {
              setTimeout(checkShogunCore, 500);
            }
          }
        } else if (attempts >= maxAttempts) {
          console.error("✗ Timeout: ShogunCore non trovato dopo", maxAttempts * 500, "ms");
          reject(new Error("ShogunCore non disponibile dopo timeout"));
        } else {
          console.log("⏳ Attesa ShogunCore... tentativo " + attempts + "/" + maxAttempts);
          setTimeout(checkShogunCore, 500);
        }
      }
      
      checkShogunCore();
    });
  }



  // Initialize SEA
  function initializeSEA() {
    if (!window.SEA && window.Gun && window.Gun.SEA) {
      window.SEA = window.Gun.SEA;
      console.log("✓ SEA inizializzato");
    }
  }

  // Main initialization function
  async function initializeShogunD3() {
    console.log("Initializing Shogun-D3...");
    
    try {
      // Initialize SEA (only if needed)
      initializeSEA();
      
      // Create the d3 object without a shogun instance initially.
      // The instance will be provided via the init() method from outside.
      createD3Object(null);
      console.log("✓ d3 object created. Waiting for shogun instance via init()...");
      
    } catch (error) {
      console.error("Errore nell'inizializzazione di ShogunD3:", error);
      // Create a minimal d3 object even if initialization fails
      createMinimalD3Object();
    }
  }

  function createD3Object(shogunInstance) {
    window.d3 = {
      // Core reference
      shogun: shogunInstance, // Initially null
      
      // Initialization method
      init: function(shogunInstance) {
        if (shogunInstance) {
          this.shogun = shogunInstance;
          
          if (this.shogun.gun) {
            window.gun = this.shogun.gun.get("shogun").get("d3");
            console.log("✓ Gun reference obtained from provided ShogunCore instance");
          } else {
            console.error("✗ Shogun instance provided to d3.init() has no gun reference!");
          }
          console.log("✓ D3 inizializzato con istanza Shogun fornita");
        }
        return this;
      },
    
      // Core functions
      getProvider: async function () {
        if (!window.ethereum) {
          alert("MetaMask non è installato! Per favore installa MetaMask per utilizzare questa applicazione.");
          return null;
        }
        const ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
        await ethersProvider.send("eth_requestAccounts", []);
        return ethersProvider;
      },
    
      HashNamespace: function (string) {
        return window.btoa(string);
      },
    
      // References (getter functions to always get current values)
      get gun() { return window.gun; },
      get SEA() { return window.SEA; },
      activeListeners: new Map(),
    
      // Configuration
      dbConf: {
        peers: GUN_PEERS,
        localStorage: false,
        radisk: false,
        axe: false,
        multicast: false,
      },
      
      // Debug utilities
      debug: {
        logLevel: 'info',
        
        testGunConnection: async function() {
          try {
            const startTime = Date.now();
            const result = await new Promise((resolve) => {
              const timeoutId = setTimeout(() => {
                resolve({ success: false, message: "Timeout durante il test di connessione" });
              }, 5000);
              
              window.gun.get("connection_test").once((data) => {
                clearTimeout(timeoutId);
                resolve({ success: true });
              });
            });
            
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            return { ...result, latency };
          } catch (error) {
            return { success: false, message: error.message || "Errore durante il test di connessione" };
          }
        },
    
        setLogLevel: function(level) {
          this.logLevel = level;
          console.log("Log level impostato a: " + level);
        }
      },
    
      // Authentication
      connectWithMetaMask: async function() {
        try {
          const provider = await this.getProvider();
          if (!provider) return null;
          
          const address = await provider.getSigner().getAddress();
          
          const web3Plugin = this.shogun.getPlugin("web3");
          if (!web3Plugin) {
            throw new Error("Plugin Web3 non disponibile");
          }
          
          let authResult = await web3Plugin.login(address);
          
          if (!authResult.success) {
            console.log("Utente non trovato, eseguo registrazione con MetaMask");
            authResult = await web3Plugin.signUp(address);
            
            if (!authResult.success) {
              throw new Error("Errore durante l'autenticazione: " + authResult.error);
            }
          }
          
          console.log("Autenticazione completata con ShogunCore:", authResult);
          
          window.currentUserAddress = address;
          const gunUser = this.shogun.user;
          window.gunKeyPair = gunUser && gunUser._ && gunUser._.sea;
          
          if (window.gunKeyPair && window.gunKeyPair.pub && window.gunKeyPair.epub) {
            this.registerKeypair(address, {
              pub: window.gunKeyPair.pub,
              epub: window.gunKeyPair.epub
            });
          }
          
          return { address: address, keypair: window.gunKeyPair };
        } catch (error) {
          console.error("Errore durante la connessione con MetaMask:", error);
          throw error;
        }
      },

      // Key management
      registerKeypair: function (address, keypair) {
        const epub = keypair.epub;
        const pub = keypair.pub;
    
        if (!epub || !pub) {
          console.error("Keypair mancante di chiavi pubbliche:", keypair);
          throw new Error("Non è possibile registrare un keypair senza chiavi pubbliche");
        }
    
        try {
          window.gun.get("skeypair" + address).put({ epub: epub, pub: pub });
          console.log("Chiavi pubbliche registrate per l'indirizzo:", address);
          return true;
        } catch (error) {
          console.error("Errore durante la registrazione del keypair:", error);
          throw error;
        }
      },

      getKeypair: async function (address) {
        try {
          if (!address) {
            console.error("Indirizzo non valido in getKeypair:", address);
            return null; 
          }
          
          const normalizedAddress = address.toLowerCase();
          
          // Check if current user
          let isCurrentUser = false;
          try {
            const provider = await this.getProvider();
            if (provider) {
              const currentUserAddress = await provider.getSigner().getAddress();
              isCurrentUser = currentUserAddress.toLowerCase() === normalizedAddress;
            }
          } catch (error) {
            console.warn("Impossibile determinare se è l'indirizzo dell'utente corrente:", error);
          }
    
          if (window.gunKeyPair && isCurrentUser) {
            return window.gunKeyPair;
          }
    
          return new Promise((resolve) => {
            let timeoutId = setTimeout(() => {
              console.warn("Timeout cercando keypair per " + address + " in Gun");
              resolve(null);
            }, GUN_TIMEOUT);
    
            window.gun.get("skeypair" + address).once((data) => {
              clearTimeout(timeoutId);
    
              if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
                console.warn("Nessun keypair trovato per " + address + " in Gun");
                resolve(null);
                return;
              }
    
              console.log("Keypair pubblico da Gun per:", address);
              resolve(data);
            });
          });
        } catch (error) {
          console.error("Errore durante la ricerca del keypair:", error);
          return null;
        }
      },

      // Message functions
      sendmessage: async function (payload, to, gunKeypair) {
        if (!payload || payload.trim() === "") {
          return { sent: false, why: new Error("Il messaggio è vuoto") };
        }
    
        if (!Array.isArray(to) || to.length === 0) {
          return { sent: false, why: new Error("Nessun destinatario valido specificato") };
        }
    
        if (!gunKeypair || !gunKeypair.priv || !gunKeypair.epub) {
          return { sent: false, why: new Error("Keypair mittente non valido") };
        }
    
        try {
          const provider = await this.getProvider();
          if (!provider) {
            throw new Error("Provider non disponibile");
          }
          
          const sender_address = await provider.getSigner().getAddress();
          const recipientAddress = to[0];
          
          const recipientPubKey = await this.getKeypair(recipientAddress);
          
          if (!recipientPubKey || !recipientPubKey.pub || !recipientPubKey.epub) {
            return { sent: false, why: new Error("Il destinatario " + recipientAddress + " non ha un keypair valido") };
          }
          
          // Create shared secret
          let shared_secret = null;
          try {
            shared_secret = await window.SEA.secret(recipientPubKey.epub, gunKeypair);
          } catch (secretError) {
            shared_secret = "fallback_key_" + sender_address + "_" + recipientAddress;
          }
    
          // Encrypt message
          let encrypted_data = null;
          try {
            encrypted_data = await window.SEA.encrypt(payload, shared_secret);
          } catch (encryptError) {
            encrypted_data = "ENCRYPT_FAILED_USE_PLAINTEXT";
          }
    
          // Create namespace
          const normalizedRecipient = recipientAddress.toLowerCase();
          const normalizedSender = sender_address.toLowerCase();
          const participants = [normalizedSender, normalizedRecipient].sort();
          const sortedParticipants = participants.join("");
          const chatNamespace = this.HashNamespace(sortedParticipants);
    
          const chat = window.gun.get(chatNamespace);
          const messageKey = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    
          const messageData = {
            date: Date.now(),
            encryptedMSG: encrypted_data,
            from: sender_address,
            to: recipientAddress,
            msg_id: messageKey,
            text: payload,
            encrypted: !!(encrypted_data && encrypted_data !== "ENCRYPT_FAILED_USE_PLAINTEXT")
          };
    
          // Save message
          let storageSuccess = false;
          await new Promise((resolve) => {
            try {
              const timeoutId = setTimeout(() => {
                resolve({ ok: 0, timeout: true });
              }, 5000);
    
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

      receiveMessage: async function (recipientAddress, callback) {
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
        const participants = [normalizedSender, normalizedRecipient].sort();
        const sortedParticipants = participants.join("");
        const chatNamespace = this.HashNamespace(sortedParticipants);
    
        console.log("Inizializzato ascolto su " + chatNamespace);
    
        if (!window.processedMessagesMap) {
          window.processedMessagesMap = new Map();
        }
    
        const processedMessagesMap = window.processedMessagesMap;
        const self = this;
    
        const processMessage = async function(data, key) {
          try {
            if (key === '_' || key === '#' || !data) return;
            
            const messageIdentifier = key + "_" + (data.date || 0);
            
            if (processedMessagesMap.has(messageIdentifier)) {
              return;
            }
            
            const messageFrom = data.from && data.from.toLowerCase();
            const isSentByMe = messageFrom === normalizedRecipient;
            
            if (key.startsWith('sent_')) {
              return;
            }
            
            processedMessagesMap.set(messageIdentifier, Date.now());
            
            if (!data.encryptedMSG && !data.text && !data.message && !data.content && !data.raw_payload) {
              return;
            }

            let decrypted = null;
            try {
              decrypted = await self.decryptMessage(data, window.gunKeyPair);
            } catch (error) {
              console.warn("Errore decrittazione messaggio " + key + ":", error.message);
              return;
            }

            if (!decrypted) {
              console.warn("Impossibile decifrare il messaggio " + key);
              return;
            }

            const timestamp = data.date || data.sent_timestamp || Date.now();

            if (typeof callback === "function") {
              callback({
                originalData: data,
                messageKey: key,
                decrypted: decrypted,
                isSentByMe: isSentByMe,
                timestamp: timestamp,
                sender: isSentByMe ? normalizedRecipient : normalizedSender
              });
            }
          } catch (error) {
            console.error("Errore nella gestione del messaggio:", error);
          }
        };
    
        const chatRef = window.gun.get(chatNamespace);
        chatRef.map().on(processMessage);
        
        const cleanupInterval = setInterval(() => {
          const now = Date.now();
          processedMessagesMap.forEach((timestamp, msgId) => {
            if (now - timestamp > 30 * 60 * 1000) {
              processedMessagesMap.delete(msgId);
            }
          });
        }, 30 * 60 * 1000);
        
        const cleanupListener = function() {
          chatRef.off();
          clearInterval(cleanupInterval);
          console.log("Ascolto interrotto per " + chatNamespace);
        };
        
        this.activeListeners.set(chatNamespace, { cleanup: cleanupListener });
        
        return cleanupListener;
      },

      stopReceiveMessage: function(recipientAddress) {
        try {
          if (!recipientAddress) return false;
          
          const userAddress = window.currentUserAddress ? window.currentUserAddress.toLowerCase() : "";
          const recipientAddr = recipientAddress.toLowerCase();
          
          if (!userAddress || !recipientAddr) return false;
          
          const participants = [recipientAddr, userAddress].sort();
          const chatNamespace = this.HashNamespace(participants.join(""));
          
          if (this.activeListeners.has(chatNamespace)) {
            const listenerInfo = this.activeListeners.get(chatNamespace);
            if (listenerInfo && listenerInfo.cleanup) {
              listenerInfo.cleanup();
              this.activeListeners.delete(chatNamespace);
              console.log("Ascolto interrotto per namespace " + chatNamespace);
              return true;
            }
          }
          
          return false;
        } catch (error) {
          console.error("Errore nell'interruzione dell'ascolto:", error);
          return false;
        }
      },

      decryptMessage: async function (messageData, gunKeypair) {
        if (!messageData) {
          console.error("Dati del messaggio non presenti");
          throw new Error("Dati del messaggio mancanti");
        }
    
        if (!messageData.encryptedMSG) {
          if (messageData.text) return messageData.text;
          if (messageData.message) return messageData.message;
          if (messageData.content) return messageData.content;
          if (messageData.raw_payload) return messageData.raw_payload;
          throw new Error("Messaggio non decifrabile (nessun contenuto trovato)");
        }
    
        if (messageData.encryptedMSG === "ENCRYPT_FAILED_USE_PLAINTEXT") {
          if (messageData.text) return messageData.text;
          if (messageData.message) return messageData.message;
          if (messageData.content) return messageData.content;
          if (messageData.raw_payload) return messageData.raw_payload;
          throw new Error("Indicatore di fallback presente ma nessun testo in chiaro trovato");
        }
    
        if (!gunKeypair || !gunKeypair.epriv || !gunKeypair.priv) {
          if (window.gunKeyPair && window.gunKeyPair.epriv && window.gunKeyPair.priv) {
            gunKeypair = window.gunKeyPair;
          } else {
            if (messageData.text) return messageData.text;
            if (messageData.message) return messageData.message;
            if (messageData.content) return messageData.content;
            if (messageData.raw_payload) return messageData.raw_payload;
            throw new Error("Keypair incompleto o mancante per decrittare");
          }
        }
    
        try {
          let currentUserAddress = null;
          try {
            const provider = await this.getProvider();
            if (provider) {
              currentUserAddress = await provider.getSigner().getAddress();
            }
          } catch (providerError) {
            console.warn("Impossibile ottenere l'indirizzo utente:", providerError);
          }
    
          const normalizedFromAddress = messageData.from ? messageData.from.toLowerCase() : "";
          const normalizedToAddress = messageData.to ? messageData.to.toLowerCase() : "";
          const normalizedUserAddress = currentUserAddress ? currentUserAddress.toLowerCase() : "";
    
          let otherPartyAddress = null;
          let isSentByMe = false;
          
          if (normalizedUserAddress) {
            if (normalizedToAddress === normalizedUserAddress) {
              otherPartyAddress = messageData.from;
              isSentByMe = false;
            } else if (normalizedFromAddress === normalizedUserAddress) {
              otherPartyAddress = messageData.to;
              isSentByMe = true;
            }
          }
    
          const strategies = [];
          
          let otherPartyKeyPair = null;
          if (otherPartyAddress) {
            try {
              otherPartyKeyPair = await this.getKeypair(otherPartyAddress);
            } catch (keyPairError) {
              console.warn("Errore nel recupero keypair per " + otherPartyAddress + ":", keyPairError);
            }
          }
    
          if (otherPartyAddress && otherPartyKeyPair && otherPartyKeyPair.epub) {
            try {
              const secret1 = await window.SEA.secret(otherPartyKeyPair.epub, gunKeypair);
              if (secret1) {
                strategies.push({
                  name: "direct_epub_secret",
                  decrypt: async function() {
                    return await window.SEA.decrypt(messageData.encryptedMSG, secret1);
                  }
                });
              }
            } catch (error1) {
              console.warn("Errore nella creazione del secret diretto:", error1);
            }
          }
    
          if (otherPartyAddress) {
            const fallbackSecret = "fallback_key_" + 
              (isSentByMe ? normalizedUserAddress : normalizedFromAddress) + 
              "_" + 
              (isSentByMe ? normalizedToAddress : normalizedUserAddress);
            strategies.push({
              name: "fallback_static_secret",
              decrypt: async function() {
                return await window.SEA.decrypt(messageData.encryptedMSG, fallbackSecret);
              }
            });
          }
    
          strategies.push({
            name: "keypair_only",
            decrypt: async function() {
              return await window.SEA.decrypt(messageData.encryptedMSG, gunKeypair);
            }
          });
    
          let lastError = null;
          for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i];
            try {
              const decrypted = await strategy.decrypt();
              
              if (decrypted) {
                console.log("Decifratura riuscita con strategia " + strategy.name);
                return decrypted;
              }
            } catch (err) {
              lastError = err;
              console.warn("Strategia " + strategy.name + " fallita:", err.message);
            }
          }
    
          // Last resort: try plaintext fields
          if (messageData.text) return messageData.text;
          if (messageData.message) return messageData.message;
          if (messageData.content) return messageData.content;
          if (messageData.raw_payload) return messageData.raw_payload;
    
          throw new Error("Impossibile decrittare il messaggio con alcuna strategia: " + (lastError ? lastError.message : "errore sconosciuto"));
        } catch (error) {
          console.error("Errore durante la decrittazione del messaggio:", error);
          throw error;
        }
      },

      // Utility functions
      logout: function() {
        this.shogun.logout();
        window.gunKeyPair = null;
        window.currentUserAddress = null;
      },
      
      isLoggedIn: function() {
        return this.shogun.isLoggedIn();
      }
    };

    console.log("✓ window.d3 object created successfully");
  }

  function createMinimalD3Object() {
    if (window.d3) return; // Don't overwrite if already exists
    
    window.d3 = {
      // Minimal implementation for when ShogunCore fails
      init: function() { return this; },
      HashNamespace: function(string) { return window.btoa(string); },
      debug: {
        logLevel: 'info',
        setLogLevel: function(level) {
          this.logLevel = level;
          console.log("Log level impostato a: " + level);
        }
      },
      getProvider: async function() {
        if (!window.ethereum) {
          alert("MetaMask non è installato!");
          return null;
        }
        const ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
        await ethersProvider.send("eth_requestAccounts", []);
        return ethersProvider;
      }
    };
    
    console.log("✓ Minimal window.d3 object created");
  }

  // Initialize when dependencies are ready
  function checkDependencies() {
    if (typeof Gun !== 'undefined' && typeof ethers !== 'undefined') {
      initializeShogunD3();
    } else {
      console.log("Waiting for dependencies (Gun, ethers)...");
      setTimeout(checkDependencies, 100);
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkDependencies);
  } else {
    checkDependencies();
  }

})();
