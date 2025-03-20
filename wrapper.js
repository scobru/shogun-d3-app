// Funzione per ricevere tutti i messaggi da un indirizzo specifico
receiveMessage: async function (address, callback) {
  if (!address) {
    console.error("Indirizzo mittente non specificato per ricevere i messaggi");
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
  
  console.log(`Ascolto messaggi in: ${chatNamespace}`);
  
  // Ottieni il keypair del mittente
  const senderKeypair = await this.getKeypair(address);
  if (!senderKeypair || !senderKeypair.epub) {
    console.warn(`Impossibile ricevere messaggi da ${address}: keypair del mittente non trovato o incompleto`, senderKeypair);
    return;
  }
  
  console.log(`✓ Keypair del mittente ${address} trovato, possiamo ricevere messaggi`);
  
  // Creiamo un shared secret per decifrare i messaggi
  let sharedSecret = null;
  try {
    sharedSecret = await this.createSharedSecret(address, window.gunKeyPair);
    console.log(`✓ Shared secret creato per mittente ${address}`);
  } catch (error) {
    console.error(`Errore nella creazione dello shared secret per mittente ${address}:`, error);
    return;
  }
  
  // Funzione helper per gestire i messaggi ricevuti
  const messageCallback = async (data, key) => {
    try {
      if (!data || !data.encryptedMSG) {
        return;
      }
      
      // Decodifica il messaggio
      const decrypted = await this.decryptMessage(data, sharedSecret);
      
      // Aggiungi il timestamp se non presente (per compatibilità con vecchi messaggi)
      const timestamp = data.date || Date.now();
      
      // Determina la direzione del messaggio
      const messageAddr = data.from && data.from.toLowerCase();
      const isSentByMe = messageAddr === normalizedRecipient;
      
      // Chiama il callback con tutte le informazioni necessarie
      if (typeof callback === 'function') {
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
      console.error(`Errore nella decodifica o nel callback per un messaggio:`, error);
    }
  };
  
  // Ascolta tutti i messaggi esistenti (eseguito una sola volta)
  window.gun.get(chatNamespace).map().once(messageCallback);
  
  console.log(`Ascolto continuo iniziato per nuovi messaggi in ${chatNamespace}`);
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
    console.error("Impossibile determinare l'indirizzo dell'utente per il debug delle conversazioni");
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
          hasMessages
        });
      });
    } catch (e) {
      console.error(`Errore nel verificare i messaggi per ${address}:`, e);
    }
  }
  
  // Diamo un po' di tempo a Gun per completare le operazioni
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log(`Trovate ${conversations.length} possibili conversazioni:`, conversations);
  return conversations;
},

decryptMessage: async function (messageData, gunKeypair) {
  console.log("Tentativo di decrittazione:", messageData);
  
  if (!messageData || !messageData.encryptedMSG) {
    console.error("Dati del messaggio invalidi (encryptedMSG mancante)");
    throw new Error("Dati del messaggio non validi (manca messaggio crittografato)");
  }
  
  if (!messageData.from && !messageData.to) {
    console.error("Dati del messaggio invalidi (mancano mittente e destinatario)");
    throw new Error("Dati del messaggio non validi (mancano mittente e destinatario)");
  }
  
  if (!gunKeypair || !gunKeypair.epriv || !gunKeypair.priv) {
    console.error("Keypair incompleto o mancante per decrittare");
    throw new Error("Keypair incompleto o mancante per decrittare");
  }

  try {
    const provider = await this.getProvider();
    if (!provider) {
      throw new Error("Provider non disponibile");
    }

    const currentUserAddress = await provider.getSigner().getAddress();
    console.log("Indirizzo utente corrente:", currentUserAddress);

    // Normalizza gli indirizzi per il confronto case-insensitive
    const normalizedFromAddress = messageData.from ? messageData.from.toLowerCase() : '';
    const normalizedToAddress = messageData.to ? messageData.to.toLowerCase() : '';
    const normalizedUserAddress = currentUserAddress.toLowerCase();

    console.log("Confronto indirizzi (in decryptMessage):", {
      from: normalizedFromAddress,
      to: normalizedToAddress,
      user: normalizedUserAddress
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
      throw new Error("Messaggio non destinato o inviato dall'utente corrente");
    }

    // Crea lo stesso segreto condiviso
    console.log("Creazione segreto condiviso con:", otherPartyAddress);
    const secret = await this.createSharedSecret(otherPartyAddress, gunKeypair);

    // Decrittografa il messaggio
    console.log("Decrittazione messaggio usando segreto condiviso...");
    const decrypted = await window.SEA.decrypt(
      messageData.encryptedMSG,
      secret
    );

    if (!decrypted) {
      console.error("Impossibile decrittare il messaggio (risultato vuoto)");
      throw new Error("Impossibile decrittare il messaggio");
    }

    console.log("Messaggio decrittato con successo:", decrypted);
    return decrypted;
  } catch (error) {
    console.error("Errore durante la decrittazione:", error);
    throw error;
  }
}, 