import { defineStore } from 'pinia';
import axios from 'axios';

export interface VersionInfo {
  version: string;
  buildDate: string;
  buildNumber: string;
}

export const useVersionStore = defineStore('version', {
  state: () => {
    // Read env vars directly - these are embedded at build time by Vite
    const envVersion = import.meta.env.VITE_APP_VERSION;
    const envBuildNumber = import.meta.env.VITE_BUILD_NUMBER;
    
    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('Version store initialization:', {
        envVersion,
        envBuildNumber,
        allEnv: import.meta.env
      });
    }
    
    return {
      backendVersion: null as VersionInfo | null,
      frontendVersion: envVersion || '0.0.1',
      frontendBuildNumber: envBuildNumber || '0',
      isLoading: false,
      error: null as string | null
    };
  },

  actions: {
    async fetchBackendVersion() {
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.get<VersionInfo>('/api/version');
        this.backendVersion = response.data;
      } catch (error) {
        console.error('Failed to fetch backend version:', error);
        this.error = 'Failed to fetch backend version information';
      } finally {
        this.isLoading = false;
      }
    }
  },
  persist: {
    // Don't persist frontendVersion and frontendBuildNumber - always read from env vars
    pick: ['backendVersion']
  }
}); 