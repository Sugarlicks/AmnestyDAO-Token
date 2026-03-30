import axios from 'axios';

export interface VersionInfo {
  version: string;
  buildDate: string;
  buildNumber: number;
}

let currentVersion: VersionInfo | null = null;

export const versionService = {
  async checkVersion(): Promise<VersionInfo> {
    try {
      const response = await axios.get<VersionInfo>('/api/version');
      const versionInfo = response.data;
      currentVersion = versionInfo;
      return versionInfo;
    } catch (error) {
      console.error('Failed to fetch version:', error);
      throw error;
    }
  },

  getCurrentVersion(): VersionInfo | null {
    return currentVersion;
  }
}; 