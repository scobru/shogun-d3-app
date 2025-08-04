# Shogun-D3 Chat

A decentralized P2P chat application built with GUN database and ShogunCore.

## Recent Performance Improvements

### 🚀 Performance Optimizations

- **Reduced WebSocket Connections**: Updated to more reliable GUN peers
- **Optimized Sync Frequency**: Reduced data synchronization to prevent "1K+ records per second" warnings
- **Improved Message Deduplication**: Enhanced duplicate message filtering
- **Conditional Logging**: Reduced console noise with configurable log levels

### 🔧 Logging Controls

The application now includes a comprehensive logging system to help with debugging:

#### Log Levels

- **None**: No console output
- **Error**: Only error messages
- **Warning**: Errors and warnings
- **Info**: Errors, warnings, and info messages (default)
- **Debug**: Detailed debugging information
- **Verbose**: All messages including connection details

#### How to Use

1. Use the "Debug" dropdown in the top-right corner of the application
2. Or programmatically: `window.d3.debug.setLogLevel("verbose")`

#### Quick Methods

```javascript
// Enable verbose logging for debugging
window.d3.debug.enableVerboseLogging();

// Disable all logging
window.d3.debug.disableLogging();

// Show only errors
window.d3.debug.enableErrorOnly();
```

### 🌐 Network Improvements

- Updated GUN peer list with more reliable servers
- Increased connection timeout for better reliability
- Added fallback mechanisms for connection failures

### 📱 Message Processing

- Enhanced duplicate message detection
- Improved encryption/decryption performance
- Better error handling for network issues

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to the application
4. Connect your MetaMask wallet
5. Start chatting!

## Troubleshooting

### Console Too Noisy?

- Use the log level dropdown to reduce console output
- Set to "Error" for minimal output
- Set to "Verbose" for detailed debugging

### Connection Issues?

- The app will automatically retry connections
- Check your internet connection
- Try refreshing the page

### Messages Not Sending?

- Ensure MetaMask is connected
- Check the recipient address format
- Verify your wallet has some ETH for gas fees

## Features

- 🔐 End-to-end encryption
- 🌐 Decentralized P2P communication
- 💬 Real-time messaging
- 🔑 Web3 wallet integration
- 📱 Responsive design
- 🌙 Dark/Light theme support

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: GUN.js (decentralized)
- **Encryption**: SEA (Security, Encryption, Authorization)
- **Web3**: MetaMask integration
- **Build Tool**: Vite

## License

MIT License - see LICENSE file for details.
