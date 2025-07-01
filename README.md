![Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green)
[![package](https://img.shields.io/npm/v/shogun-d3-app)](https://npmjs.com/package/shogun-d3-app)
![Contributors](https://img.shields.io/github/contributors/scobru/shogun-d3-app)

# Shogun-D3: Decentralized Messaging for Ethereum ⏳

Shogun-D3 is a powerful library that enables you to easily create **your own decentralized chat applications** for the Ethereum ecosystem and integrate them into any web application.

## Features

- **End-to-End Encryption**: All messages are encrypted using Gun's SEA (Security, Encryption, Authorization)
- **Ethereum Authentication**: Users are identified by their Ethereum addresses
- **MetaMask Integration**: Easy authentication using MetaMask
- **Persistent Storage**: Messages are stored in decentralized GunDB storage
- **Key Management**: Backup and restore cryptographic keys
- **Caching System**: Efficient handling of duplicate messages with local storage support
- **Debug Levels**: Configurable logging levels for development and troubleshooting
- **Connection Status**: Real-time monitoring of Gun connection state
- **Flexible API**: Simple to integrate into existing applications

## Installation

```bash
npm install shogun-d3-app
# or
yarn add shogun-d3-app
```

## Quick Start

To use Shogun-D3 in your application, you need to include it along with its dependencies:

```html
<!-- Include required dependencies -->
<script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
<script src="https://cdn.jsdelivr.net/npm/ethers@5.7.0/dist/ethers.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/shogun-core@1.3.6/dist/browser/shogun-core.js"></script>
<script src="path/to/d3.js"></script>

<script>
  // Set debug level (optional)
  window.d3.debug.setLogLevel('info'); // Options: none, error, warn, info, debug, verbose

  // Connect user with MetaMask
  async function connect() {
    try {
      const { address, keypair } = await window.d3.connectWithMetaMask();
      console.log("User connected:", address);
      return { address, keypair };
    } catch (error) {
      console.error("Connection error:", error);
      return null;
    }
  }

  // Send a message
  async function sendMessage(recipientAddress, messageText) {
    const result = await window.d3.sendmessage(
      messageText,
      [recipientAddress],
      window.gunKeyPair
    );

    if (result.sent && result.key) {
      console.log("Message sent successfully! Key:", result.key);
    } else {
      console.error("Error sending message:", result.why);
    }
  }

  // Receive messages
  async function listenForMessages(recipientAddress) {
    window.d3.receiveMessage(recipientAddress, (messageData) => {
      const { decrypted, isSentByMe, timestamp, sender, messageKey } = messageData;
      console.log(`New message from ${sender}: ${decrypted}`);
      console.log(`Message ID: ${messageKey}`);
      console.log(`Sent by me: ${isSentByMe}`);
      console.log(`Time: ${new Date(timestamp).toLocaleString()}`);
    });

    // To stop listening:
    // window.d3.stopReceiveMessage(recipientAddress);
  }

  // Check Gun connection status
  async function checkGunStatus() {
    const status = await window.d3.debug.testGunConnection();
    console.log("Gun connection status:", status);
  }
</script>
```

## [Complete Documentation](https://github.com/scobru/shogun-d3-app/blob/master/docs/docs.md)

For a complete reference of all available methods and options, check out the [documentation](https://github.com/scobru/shogun-d3-app/blob/master/docs/docs.md).

## Demo Application

A complete demo chat application is included in the repository, showcasing:
- Theme switching (light/dark mode)
- Message persistence with local storage
- Real-time connection status
- Configurable debug levels
- Conversation management
- Encrypted messaging

## Future Improvements

- Support for group conversations
- Message read receipts
- File sharing capabilities
- Config file with default settings for SEA keys and peers
- Offline mode with better synchronization
- Additional authentication methods
- Message search and filtering
- Profile management
- Message deletion and editing

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache 2.0