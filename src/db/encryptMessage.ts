import { SEA, ISEAPair } from ".";

/**
 * Encrypts a message using a shared secret
 * @param msg - The message to encrypt
 * @param secret - The shared secret generated with SEA.secret()
 * @returns The encrypted message
 */
async function encryptMessage(msg: string, secret: string): Promise<string> {
    const encrypted = await SEA.encrypt(msg, secret);
    return encrypted;
}

export default encryptMessage;