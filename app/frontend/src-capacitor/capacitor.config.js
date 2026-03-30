// Capacitor configuration
// In production builds, the server.url and cleartext are omitted
// so the app uses bundled web assets instead of connecting to a dev server

const isDev = process.env.NODE_ENV === 'development';
// Enable web debugging in production for troubleshooting
// Set ENABLE_WEB_DEBUG=true to enable Chrome DevTools in production
const enableWebDebug = process.env.ENABLE_WEB_DEBUG === 'true' || isDev;

const serverConfig = {
  androidScheme: 'https',
  iosScheme: 'https',
  hostname: 'localhost', // todo: does this need to be hrdao.matou.nz?
  allowNavigation: [
    'https://hrdao.matou.nz/*'
  ]
};

// Only add dev server URL in development mode
if (isDev) {
  serverConfig.url = process.env.CAPACITOR_DEV_URL || 'http://192.168.1.158:9000'; // TODO: address needs to be changed
  serverConfig.cleartext = true;
}

module.exports = {
  appId: 'nz.matou.hrdao',
  appName: 'HRDAO',
  webDir: '../dist/spa',
  bundledWebRuntime: false, // TODO: this wasnt in bens changes but was in mine...
  server: serverConfig,
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: enableWebDebug // Enable via ENABLE_WEB_DEBUG=true env var
  },
  ios: {
    allowsLinkPreview: true,
    contentInset: 'always'
  },
  plugins: {
    SecureStoragePlugin: {},
    // CapacitorNativeBiometric: {},
    // TODO: add back in when we configure notifications
    // PushNotifications: {
    //   presentationOptions: ["badge", "sound", "alert"]
    // }
  }
}
