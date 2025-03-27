![Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green)
[![package](https://img.shields.io/npm/v/shogun-d3)](https://npmjs.com/package/shogun-d3)
![Contributors](https://img.shields.io/github/contributors/noctisatrae/shogun-d3)

# Shogun-D3: Decentralized Messaging for Ethereum ⏳

Shogun-D3 is a powerful library that enables you to easily create **your own decentralized chat applications** for the Ethereum ecosystem and integrate them into any web application.

## Features

- **End-to-End Encryption**: All messages are encrypted using Gun's SEA (Security, Encryption, Authorization)
- **Ethereum Authentication**: Users are identified by their Ethereum addresses
- **MetaMask Integration**: Easy authentication using MetaMask
- **Persistent Storage**: Messages are stored in decentralized GunDB storage
- **Key Management**: Backup and restore cryptographic keys
- **Caching System**: Efficient handling of duplicate messages
- **Flexible API**: Simple to integrate into existing applications

## Installation

```bash
npm install shogun-d3
# or
yarn add shogun-d3
```

## Quick Start

To use Shogun-D3 in your application, you need to include it along with its dependencies:

```html
<!-- Include required dependencies -->
<script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
<script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
<script src="path/to/shogun-core.js"></script>
<script src="path/to/d3.js"></script>

<script>
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
    const result = await window.d3.sendMessage(
      messageText,
      [recipientAddress],
      window.gunKeyPair
    );

    if (result.sent) {
      console.log("Message sent successfully!");
    } else {
      console.error("Error sending message:", result.why);
    }
  }

  // Receive messages
  async function listenForMessages(recipientAddress) {
    const cleanupFn = await window.d3.receiveMessage(
      recipientAddress,
      (messageData) => {
        const { decrypted, isSentByMe, timestamp, sender } = messageData;
        console.log(`New message from ${sender}: ${decrypted}`);
        console.log(`Sent by me: ${isSentByMe}`);
        console.log(`Time: ${new Date(timestamp).toLocaleString()}`);
      }
    );

    // To stop listening later:
    // cleanupFn();
    // or: window.d3.stopReceiveMessage(recipientAddress);
  }
</script>
```

## [Complete Documentation](https://github.com/noctisatrae/shogun-d3/blob/master/docs/docs.md)

For a complete reference of all available methods and options, check out the [documentation](https://github.com/noctisatrae/shogun-d3/blob/master/docs/docs.md).

## Demo Application

Check out the `app` directory in the repository for a complete demo chat application that showcases the features of Shogun-D3.

## Future Improvements

- Support for group conversations
- Message read receipts
- File sharing capabilities
- Config file with default settings for SEA keys and peers
- Offline mode with better synchronization
- Additional authentication methods

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache 2.0