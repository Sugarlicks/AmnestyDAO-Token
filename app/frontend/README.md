# HRDAO MVP

HRDAO MVP is a cross-platform application built with Quasar Framework (Vue.js). Its a protoype app built for a DAO. Current features include chat and tokens (mocked with postgresDB). The application is designed to work across multiple platforms including web, desktop (Electron), and mobile (iOS/Android).

This is a prototype only for community testing. It does not use blockchain .....yet.

## Features

- Cross-platform support (Web, Desktop, Mobile)
- GraphQL integration for blockchain interactions
- Modern UI with Quasar Framework

## Prerequisites

- Node.js (v16, v18, or v20)
- npm (>= 6.13.4) or yarn (>= 1.21.1)
- For mobile development:
  - iOS: Xcode and CocoaPods
  - Android: Android Studio and Android SDK

## Installation

1. Clone the repository
2. Install dependencies:
```bash
yarn
# or
npm install
```

## Development

### Web Development
```bash
yarn dev
# or
npm run dev
```

### Desktop Development (Electron)
```bash
yarn dev:electron
# or
npm run dev:electron
```

### Mobile Development

#### iOS
```bash
yarn dev:ios
# or
npm run dev:ios
```

#### Android
```bash
yarn dev:android
# or
npm run dev:android
```

## Building for Production

### Web Build
```bash
yarn build
# or
npm run build
```

### Desktop Build (Electron)
```bash
yarn build:electron
# or
npm run build:electron
```

### Mobile Builds

#### Android Debug Build
```bash
yarn build:android:debug
# or
npm run build:android:debug
```

#### Android Production Build
```bash
yarn build:android:prod
# or
npm run build:android:prod
```

## Code Quality

### Linting
```bash
yarn lint
# or
npm run lint
```

### Formatting
```bash
yarn format
# or
npm run format
```

## Project Structure

- `src/` - Main source code
- `src-capacitor/` - Capacitor-specific code for mobile builds
- `src-electron/` - Electron-specific code for desktop builds
- `public/` - Static assets
- `quasar.config.js` - Quasar framework configuration

## Dependencies

Key dependencies include:
- Vue 3
- Quasar Framework
- Apollo Client (GraphQL)
- Capacitor (Mobile)
- Electron (Desktop)
- Pinia (State Management)

## Configuration

For detailed configuration options, see [Quasar Configuration](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).

## License

[Add your license information here]
