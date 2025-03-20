import getProvider from "./web3/getProvider";
import HashNamespace from "./utils/hashNamespace";
import registerKeypair from "./utils/registerKeypair";
import getKeypair from "./utils/getKeypair";
//import { gun, dbConf, encryptMessage, SEA, ISEAPair } from "./db/index";
import {gun} from "./db/index";
import dbConf from "./db/dbConf";
import encryptMessage from "./db/encryptMessage";
import { SEA, ISEAPair } from "./db/index";
import { ethers } from "ethers";

/**
 * Creates a shared secret between current user and recipient
 * @async
 * @function
 * @param {string} recipientAddress The address of the recipient
 * @param {ISEAPair} gunKeypair Your keypair
 * @returns {Promise<string>} Shared secret that can be used for encryption
 */
const createSharedSecret = async (recipientAddress: string, gunKeypair: ISEAPair): Promise<string> => {
  // Get the recipient's public keypair
  const recipientPubKey = await getKeypair(recipientAddress);
  
  if (!recipientPubKey || !recipientPubKey.epub) {
    throw new Error(`Couldn't find public key for ${recipientAddress}`);
  }
  
  // Create a shared secret using recipient's epub and our keypair
  const secret = await SEA.secret(recipientPubKey.epub, gunKeypair);
  if (!secret) {
    throw new Error("Failed to create shared secret");
  }
  
  return secret as string;
}

/**
 * This function is used to send a message to someone or a group of persons.
 * @async
 * @function 
 * @param {string} payload The message to send.
 * @param {string[]} to The array containing the addresses of the persons you want to send the message to.  
 * @param {ISEAPair} gunKeypair The keypair used to decrypt messages. 
 * @returns {Promise<SendMessageConfirmationReturn>}  If the message was sent it returns an object containing: the date when the message was sent, the encrypted message, the reference to the chat for gun.
 * @example
 * await sendmessage("Hello stranger!", [<ETH addresses here>], <KeyPairForEncryption => generate it with SEA.pair()>)
 */
const sendmessage = async (payload:string, to: string[], gunKeypair:ISEAPair):Promise<SendMessageConfirmationReturn> => {
  const provider = await getProvider();
  if (!provider) {
    throw new Error("Provider not available");
  }
  
  const sender_address = await provider.getSigner().getAddress();
  
  // Validate there's only one recipient (for encryption purposes)
  if (to.length !== 1) {
    throw new Error("This implementation only supports sending to a single recipient");
  }
  
  const recipientAddress = to[0];
  // Include sender in conversation participants for namespacing
  const participants = [...to, sender_address];
  
  try {
    // Create a shared secret with the recipient
    const secret = await createSharedSecret(recipientAddress, gunKeypair);
    
    // Encrypt the message using the shared secret
    const encrypted_data = await encryptMessage(payload, secret);
    
    // Generate chat namespace from sorted participants
    const chat = gun.get(HashNamespace(participants.sort().join()));
    
    // Attempt to get ENS domain if available
    const ensDomain = await provider.lookupAddress(sender_address);
    
    // Store the encrypted message
    await chat.set({ 
      date: Date.now(), 
      encryptedMSG: encrypted_data, 
      from: sender_address, 
      to: recipientAddress,
      ensFrom: ensDomain 
    });

    return {sent: true, encrypted: encrypted_data, chat:chat};
  } catch (e:any) {
    console.log(e);
    return {sent: false, why: e};
  }
}

/**
 * This function retrieves the message (constant stream!!) for a certain conversation.
 * @async
 * @function
 * @param from Array of participants in conversation
 * @param gunKeypair Your keypair needed for decryption
 * @param callback The function allowing you to retrieve the message!
 * @returns {Promise<void>}
 * @example
 * await receiveMessage([address], myKeypair, async (data) => {
 *  if (data.to === myAddress) {
 *    const decrypted = await decryptMessage(data);
 *    console.log(`${decrypted} at ${data.date} from ${data.from}!`);
 *  }
 * });
 */
const receiveMessage = async (from: string[], gunKeypair: ISEAPair, callback: any): Promise<void> => {
  const provider = await getProvider();
  if (!provider) {
    throw new Error("Provider not available");
  }
  
  const sender_address = await provider.getSigner().getAddress();

  // Include current user in conversation participants
  const participants = [...from, sender_address];

  // Listen to messages in this conversation
  await gun.get(HashNamespace(participants.sort().join())).map().on(callback);
}

/**
 * Decrypt a message using the shared secret with the sender
 * @async
 * @function
 * @param {Object} messageData The message data from Gun
 * @param {ISEAPair} gunKeypair Your keypair
 * @returns {Promise<string>} Decrypted message
 */
const decryptMessage = async (messageData: any, gunKeypair: ISEAPair): Promise<string> => {
  if (!messageData || !messageData.encryptedMSG || (!messageData.from && !messageData.to)) {
    throw new Error("Invalid message data");
  }
  
  const provider = await getProvider();
  if (!provider) {
    throw new Error("Provider not available");
  }
  
  const currentUserAddress = await provider.getSigner().getAddress();
  
  // Determine who to create the shared secret with (sender if we're receiving, recipient if we sent)
  const otherPartyAddress = messageData.to === currentUserAddress 
    ? messageData.from 
    : messageData.to;
  
  // Create the same shared secret
  const secret = await createSharedSecret(otherPartyAddress, gunKeypair);
  
  // Decrypt the message
  const decrypted = await SEA.decrypt(messageData.encryptedMSG, secret);
  
  if (!decrypted) {
    throw new Error("Failed to decrypt message");
  }
  
  return decrypted as string;
}

export {
  sendmessage,
  getProvider,
  HashNamespace,
  receiveMessage,
  decryptMessage,
  createSharedSecret,
  dbConf,
  gun, 
  SEA,
  registerKeypair,
  getKeypair
}