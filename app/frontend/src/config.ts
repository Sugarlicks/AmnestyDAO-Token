import { Capacitor } from '@capacitor/core';

interface Config {
  wsUrl: string;
  hasuraUrl: string;
  hasuraWsUrl: string;
  authUrl: string;
  POLICY_ID?: string;
  TOKEN_NAME?: string;
  TREASURY_SCRIPT_ADDRESS?: string;
  NETWORK?: string;
}

const isDev = process.env.NODE_ENV === 'development';

// Helper function to get the appropriate Auth URL based on platform
const getAuthBaseUrl = () => {
  if (!isDev) {
    return 'hrdao.matou.nz';
  }

  const platform = Capacitor.getPlatform();
  
  switch (platform) {
    case 'android':
      return '10.0.2.2:4000';
    case 'ios':
      return 'localhost:4000';
    case 'web':
    default:
      return 'localhost:4000';
  }
};

// Helper function to get the appropriate Hasura URL based on platform
const getHasuraBaseUrl = () => {
  if (!isDev) {
    return 'hrdao.matou.nz';
  }

  const platform = Capacitor.getPlatform();
  
  switch (platform) {
    case 'android':
      return '10.0.2.2:8080';
    case 'ios':
      return 'localhost:8080';
    case 'web':
    default:
      return 'localhost:8080';
  }
};

const authBaseUrl = getAuthBaseUrl();
const hasuraBaseUrl = getHasuraBaseUrl();
// Note: Using console.log here to avoid circular dependency with logger.ts
if (process.env.NODE_ENV === 'development') {
  console.log('Configuration initialized', { authBaseUrl, hasuraBaseUrl, isDev });
}

const config: Config = {
  authUrl: isDev ? `http://${authBaseUrl}` : `https://${authBaseUrl}`,
  wsUrl: isDev ? `ws://${authBaseUrl}` : `wss://${authBaseUrl}`,
  hasuraUrl: isDev ? `http://${hasuraBaseUrl}/v1/graphql` : `https://${hasuraBaseUrl}/v1/graphql`,
  hasuraWsUrl: isDev ? `ws://${hasuraBaseUrl}/v1/graphql` : `wss://${hasuraBaseUrl}/v1/graphql`,
  // Blockchain configuration - these should be set via environment variables
  POLICY_ID: import.meta.env.VITE_POLICY_ID || '',
  TOKEN_NAME: import.meta.env.VITE_TOKEN_NAME || '',
  TREASURY_SCRIPT_ADDRESS: import.meta.env.VITE_TREASURY_SCRIPT_ADDRESS || '',
  NETWORK: import.meta.env.VITE_NETWORK || 'testnet',
};

export default config; 