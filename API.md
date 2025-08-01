# Shogun-D3 JavaScript API Documentation

## Overview

Shogun-D3 is a decentralized chat application powered by GunDB and blockchain technology. This API provides end-to-end encrypted, peer-to-peer messaging capabilities without central servers.

## Table of Contents

- [Installation & Setup](#installation--setup)
- [Authentication](#authentication)
- [Key Management](#key-management)
- [Messaging](#messaging)
- [Utilities](#utilities)
- [Debug Functions](#debug-functions)
- [Error Handling](#error-handling)

## Installation & Setup

### Prerequisites

```html
<!-- Include required dependencies -->
<script src="https://cdn.ethers.io/lib/ethers-5.2.umd.min.js"></script>
<script src="https://gun.eco/gun.js"></script>
<script src="https://gun.eco/sea.js"></script>
<script src="path/to/shogun-core.js"></script>
<script src="path/to/d3.js"></script>
```

### Initialization

The library automatically initializes when loaded. Access the API through the global `window.d3` object.

```javascript
// Wait for initialization
await window.d3.waitForInit();
```

## Authentication

### connectWithMetaMask()

Connects and authenticates a user using MetaMask wallet.

**Syntax:**
```javascript
const result = await window.d3.connectWithMetaMask();
```

**Returns:**
- `Promise<Object>` - Authentication result
  - `address` (string) - User's Ethereum address
  - `keypair` (Object) - User's GunDB keypair

**Example:**
```javascript
try {
  const auth = await window.d3.connectWithMetaMask();
  console.log('Connected:', auth.address);
  console.log('Keypair:', auth.keypair);
} catch (error) {
  console.error('Authentication failed:', error);
}
```

### backupKeypair(password)

Creates a backup of the user's keypair.

**Parameters:**
- `password` (string) - Password to encrypt the backup

**Returns:**
- `Promise<Object>` - Encrypted backup data

**Example:**
```javascript
const backup = await window.d3.backupKeypair('mySecurePassword');
```

### restoreKeypair(backupData, password)

Restores a keypair from backup data.

**Parameters:**
- `backupData` (Object) - Previously backed up keypair data
- `password` (string) - Password used to encrypt the backup

**Returns:**
- `Promise<boolean>` - Success status

**Example:**
```javascript
const success = await window.d3.restoreKeypair(backupData, 'mySecurePassword');
```

### logout()

Logs out the current user and clears session data.

**Syntax:**
```javascript
window.d3.logout();
```

### isLoggedIn()

Checks if a user is currently logged in.

**Returns:**
- `boolean` - Login status

**Example:**
```javascript
if (window.d3.isLoggedIn()) {
  console.log('User is logged in');
}
```

## Key Management

### registerKeypair(address, keypair)

Registers a public keypair for an Ethereum address.

**Parameters:**
- `address` (string) - Ethereum address
- `keypair` (Object) - Keypair containing public keys
  - `pub` (string) - Public key
  - `epub` (string) - Encryption public key

**Returns:**
- `boolean` - Success status

**Example:**
```javascript
const success = window.d3.registerKeypair('0x123...', {
  pub: 'publicKey...',
  epub: 'encryptionPublicKey...'
});
```

### getKeypair(address)

Retrieves a keypair for the specified address.

**Parameters:**
- `address` (string) - Ethereum address

**Returns:**
- `Promise<Object|null>` - Keypair or null if not found

**Example:**
```javascript
const keypair = await window.d3.getKeypair('0x123...');
if (keypair) {
  console.log('Found keypair:', keypair);
}
```

### hasKeypair(address)

Checks if a keypair exists for the specified address.

**Parameters:**
- `address` (string) - Ethereum address

**Returns:**
- `Promise<boolean>` - Whether keypair exists

**Example:**
```javascript
const exists = await window.d3.hasKeypair('0x123...');
```

### storeKeypair(address, keypair)

Stores a keypair for an address.

**Parameters:**
- `address` (string) - Ethereum address
- `keypair` (Object) - Complete or public-only keypair

**Returns:**
- `boolean` - Success status

## Messaging

### sendmessage(payload, to, gunKeypair)

Sends an encrypted message to specified recipients.

**Parameters:**
- `payload` (string) - Message content
- `to` (Array<string>) - Array of recipient addresses
- `gunKeypair` (Object) - Sender's keypair

**Returns:**
- `Promise<Object>` - Send result
  - `sent` (boolean) - Success status
  - `encrypted` (string) - Encrypted message data
  - `key` (string) - Message key
  - `namespace` (string) - Chat namespace
  - `why` (Error) - Error if failed

**Example:**
```javascript
const result = await window.d3.sendmessage(
  'Hello, world!',
  ['0x456...'],
  window.gunKeyPair
);

if (result.sent) {
  console.log('Message sent successfully');
} else {
  console.error('Failed to send:', result.why);
}
```

### receiveMessage(recipientAddress, callback)

Listens for incoming messages from a specific address.

**Parameters:**
- `recipientAddress` (string) - Address to listen for messages from
- `callback` (Function) - Callback function for new messages
  - `messageData` (Object) - Message information
    - `originalData` (Object) - Raw message data
    - `messageKey` (string) - Message identifier
    - `decrypted` (string) - Decrypted message content
    - `isSentByMe` (boolean) - Whether message was sent by current user
    - `timestamp` (number) - Message timestamp
    - `sender` (string) - Sender address

**Returns:**
- `Promise<Function>` - Cleanup function to stop listening

**Example:**
```javascript
const cleanup = await window.d3.receiveMessage('0x456...', (message) => {
  console.log('New message:', message.decrypted);
  console.log('From:', message.sender);
  console.log('Sent by me:', message.isSentByMe);
});

// Stop listening
cleanup();
```

### stopReceiveMessage(recipientAddress)

Stops listening for messages from a specific address.

**Parameters:**
- `recipientAddress` (string) - Address to stop listening from

**Returns:**
- `boolean` - Whether a listener was stopped

**Example:**
```javascript
const stopped = window.d3.stopReceiveMessage('0x456...');
```

### decryptMessage(messageData, gunKeypair)

Decrypts a received message.

**Parameters:**
- `messageData` (Object) - Encrypted message data
- `gunKeypair` (Object) - Recipient's keypair

**Returns:**
- `Promise<string>` - Decrypted message content

**Example:**
```javascript
const decrypted = await window.d3.decryptMessage(messageData, window.gunKeyPair);
```

## Utilities

### getProvider()

Gets the Web3 provider (MetaMask).

**Returns:**
- `Promise<Object|null>` - Ethers provider or null

**Example:**
```javascript
const provider = await window.d3.getProvider();
if (provider) {
  const address = await provider.getSigner().getAddress();
}
```

### HashNamespace(string)

Creates a base64 hash of a string for namespace generation.

**Parameters:**
- `string` (string) - String to hash

**Returns:**
- `string` - Base64 encoded hash

**Example:**
```javascript
const namespace = window.d3.HashNamespace('chat_identifier');
```

### createSharedSecret(recipientAddress, gunKeypair)

Creates a shared secret for encryption between two parties.

**Parameters:**
- `recipientAddress` (string) - Recipient's address or epub key
- `gunKeypair` (Object) - Sender's keypair

**Returns:**
- `Promise<string>` - Shared secret

**Example:**
```javascript
const secret = await window.d3.createSharedSecret('0x456...', window.gunKeyPair);
```

### encryptMessage(message, secret)

Encrypts a message using a shared secret.

**Parameters:**
- `message` (string) - Message to encrypt
- `secret` (string) - Shared secret

**Returns:**
- `Promise<string>` - Encrypted message

**Example:**
```javascript
const encrypted = await window.d3.encryptMessage('Hello!', secret);
```

### getAllRegisteredAddresses()

Gets all addresses that have registered keypairs.

**Returns:**
- `Promise<Array<string>>` - Array of addresses

**Example:**
```javascript
const addresses = await window.d3.getAllRegisteredAddresses();
```

### getActivePlugins()

Gets information about active Shogun plugins.

**Returns:**
- `Object` - Plugin status
  - `web3` (boolean) - Web3 plugin active
  - `webauthn` (boolean) - WebAuthn plugin active
  - `nostr` (boolean) - Nostr plugin active
  - `oauth` (boolean) - OAuth plugin active

**Example:**
```javascript
const plugins = window.d3.getActivePlugins();
console.log('Web3 plugin:', plugins.web3);
```

## Debug Functions

### debug.setLogLevel(level)

Sets the logging level for debugging.

**Parameters:**
- `level` (string) - Log level: 'none', 'error', 'warn', 'info', 'debug', 'verbose'

**Example:**
```javascript
window.d3.debug.setLogLevel('debug');
```

### debug.testGunConnection()

Tests the connection to Gun peers.

**Returns:**
- `Promise<Object>` - Connection test result
  - `success` (boolean) - Connection status
  - `latency` (number) - Connection latency in ms
  - `message` (string) - Error message if failed

**Example:**
```javascript
const result = await window.d3.debug.testGunConnection();
console.log('Connection successful:', result.success);
console.log('Latency:', result.latency, 'ms');
```

### debug.inspectGunKeypairs()

Inspects all keypairs stored in Gun.

**Returns:**
- `Promise<Object>` - Keypair information
  - `keypairs` (Array) - Array of keypair info
  - `total` (number) - Total count

**Example:**
```javascript
const inspection = await window.d3.debug.inspectGunKeypairs();
console.log('Found', inspection.total, 'keypairs');
```

### debug.exploreChat(address1, address2)

Explores messages in a chat between two addresses.

**Parameters:**
- `address1` (string) - First participant address
- `address2` (string) - Second participant address

**Returns:**
- `Promise<Object>` - Chat exploration result
  - `namespace` (string) - Chat namespace
  - `found` (boolean) - Whether chat exists
  - `messages` (Array) - Array of message info

**Example:**
```javascript
const chat = await window.d3.debug.exploreChat('0x123...', '0x456...');
console.log('Chat namespace:', chat.namespace);
console.log('Messages found:', chat.messages.length);
```

### debug.cleanGunKeypairs(address)

Removes keypairs from Gun storage.

**Parameters:**
- `address` (string, optional) - Specific address to clean, or null for all

**Returns:**
- `Promise<string>` - Cleanup result message

**Example:**
```javascript
// Clean specific address
await window.d3.debug.cleanGunKeypairs('0x123...');

// Clean all keypairs
await window.d3.debug.cleanGunKeypairs();
```

### debugConversations()

Debug function to analyze all active conversations.

**Returns:**
- `Promise<Array>` - Array of conversation info

**Example:**
```javascript
const conversations = await window.d3.debugConversations();
console.log('Active conversations:', conversations);
```

## Error Handling

Most functions return promises that may reject with errors. Always use try-catch blocks:

```javascript
try {
  const result = await window.d3.sendmessage('Hello', ['0x456...'], window.gunKeyPair);
  if (!result.sent) {
    console.error('Send failed:', result.why);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Global Variables

The library sets several global variables:

- `window.gun` - Gun database instance
- `window.SEA` - Gun SEA cryptography
- `window.gunKeyPair` - Current user's keypair
- `window.currentUserAddress` - Current user's Ethereum address
- `window.d3.activeListeners` - Map of active message listeners

## Configuration

The library uses these default Gun peers:
- `https://peer.wallie.io/gun`
- `wss://ruling-mastodon-improved.ngrok-free.app/gun`

Timeout settings:
- Gun operations: 10 seconds
- Login/signup: 30 seconds
- General operations: 60 seconds

## Notes

- All addresses are normalized to lowercase for consistency
- Messages are automatically encrypted using shared secrets
- The library handles both encrypted and fallback plaintext messages
- Chat namespaces are generated by sorting participant addresses and hashing
- Message listeners automatically handle deduplication and cleanup 