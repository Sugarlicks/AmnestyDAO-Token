import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { defineStore } from 'pinia';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import axios from 'axios';
import config from '../config';
import { MeshWallet } from '@meshsdk/core';
import { useTokenStore } from './token';
import { getImageUrl } from '../utils/imageUtils';
import { logger } from '../utils/logger';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  profileImage: string | null;
  affiliations: string | null;
  status: string;
  email: string | null;
  walletAddress: string | null;
  country: string | null;
  language: string | null;
}

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  preferredName?: string;
  reason: string;
  profileImage: string | null;
  affiliations?: string;
  country?: string;
  language?: string;
}

function getFullImageUrl(path: string | null) {
  if (!path) {
    // Return placeholder if no path
    const result = getImageUrl(null);
    return result.url;
  }
  
  // Ensure path is a string before processing
  if (typeof path !== 'string') {
    console.warn('getFullImageUrl received non-string path:', typeof path, path);
    const result = getImageUrl(null);
    return result.url;
  }
  
  // If it's a relative path (not http/data/blob), prepend auth URL
  if (!path.startsWith('http') && !path.startsWith('data:') && !path.startsWith('blob:')) {
    // Check if it's base64 - if so, use image utility
    if (/^[A-Za-z0-9+/=]+$/.test(path)) {
      const result = getImageUrl(path);
      return result.url;
    }
    // Otherwise, treat as relative path
    return `${config.authUrl}${path}`;
  }
  
  // Use unified image utility for all other cases
  const result = getImageUrl(path);
  return result.url;
}


export const useAuthStore = defineStore('auth', {
  state: () => ({
    userId: '',
    jwt: '',
    accountStatus: '',
    mnemonic: '',      // only used at registration time
    user: {} as User,
    users: [] as User[]
  }),

  getters: {
    usersList: (state) => state.users
  },

  actions: {

    async fetchAllUsers() {
      try {
        const response = await axios.get(`${config.authUrl}/api/users`, {
          headers: {
            Authorization: `Bearer ${this.jwt}`
          }
        });
        
        // Process profile images for all users
        this.users = response.data.map((user: User) => ({
          ...user,
          profileImage: user.profileImage && typeof user.profileImage === 'string' ? getFullImageUrl(user.profileImage) : null
        }));
        
      } catch (error) {
        logger.error('Failed to fetch users', error);
        throw error;
      }
    },

    async fetchAllUsersWithStatus() {
      try {
        const response = await axios.get(`${config.authUrl}/api/admin/users`, {
          headers: {
            Authorization: `Bearer ${this.jwt}`
          }
        });
        
        // Process profile images for all users
        this.users = response.data.map((user: User) => ({
          ...user,
          profileImage: user.profileImage && typeof user.profileImage === 'string' ? getFullImageUrl(user.profileImage) : null
        }));
        
      } catch (error) {
        logger.error('Failed to fetch all users', error);
        throw error;
      }
    },

    async registerWithSeed(data: RegisterFormData) {
      try {
        if (!data) {
          throw new Error('No registration data provided');
        }
        // 1. Generate mnemonic & derive keys (but don't store mnemonic yet)
        const mnemonicRaw = await MeshWallet.brew(); // 12 words
        // Normalize mnemonic to string (handle both string and string[] return types)
        const mnemonic = Array.isArray(mnemonicRaw) ? mnemonicRaw.join(' ') : mnemonicRaw;
        const mnemonicWords = Array.isArray(mnemonicRaw) ? mnemonicRaw : mnemonicRaw.split(' ');

        // Create wallet directly from the newly generated mnemonic
        const wallet = new MeshWallet({
          networkId: 0, // 0 for testnet, 1 for mainnet
          key: {
            type: 'mnemonic',
            words: mnemonicWords
          }
        });
        await wallet.init();
        const address = await wallet.getChangeAddress();
        const tokenStore = useTokenStore();
        tokenStore.walletAddress = address;
        tokenStore.wallet = wallet; // Store wallet instance

        const formData = new FormData();
        if (data.profileImage) {
          formData.append('profileImage', data.profileImage);
        }
        formData.append('publicKey', address); // wallet address
        formData.append('firstName', data.firstName);
        formData.append('lastName', data.lastName);
        formData.append('email', data.email);
        if (data.preferredName) {
          formData.append('preferredName', data.preferredName);
        }
        formData.append('reason', data.reason);
        if (data.affiliations) {
          formData.append('affiliations', data.affiliations); // advocacy interests
        }
        if (data.country) {
          formData.append('country', data.country);
        }
        if (data.language) {
          formData.append('language', data.language);
        }

        // 3. Register with server
        const response = await axios.post(`${config.authUrl}/api/register`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json'
          }
        });
        
        logger.info('User registration successful', { userId: response.data.userId });

        await SecureStoragePlugin.set({
          key: 'user-id',
          value: response.data.userId
        });
        
        // Save mnemonic to secure storage after successful registration
        await SecureStoragePlugin.set({
          key: 'mnemonic',
          value: mnemonic
        });
        
        // Transaction hash tracking handled by blockchain store
        
        // 4. Save mnemonic & userId after successful registration
        this.userId = response?.data?.userId;
        this.mnemonic = mnemonic;

      } catch (error) {
        logger.error('Registration failed', error);
        if (axios.isAxiosError(error)) {
          throw new Error(error.response?.data?.error || error.message);
        }
        throw error;
      }
    },

    async login() {
      try {
        let nonce: string;
        // 1. Fetch nonce (MeshJS flow)
        try {
          const response = await axios.post(
            `${config.authUrl}/api/login/options`,
            { userId: this.userId }
          );
          if (response.data.status === 'pending') {
            return this.accountStatus = 'pending';
          } else {
            nonce = response.data.nonce;
          }
        } catch (error: unknown) {
          if (axios.isAxiosError(error) && error.response) {
            switch (error.response.status) {
              default:
                throw new Error(error.response.data.error || 'Something went wrong  -_- ');
            }
          }
          throw error;
        }

        // 2. Load wallet from mnemonic and sign the nonce (CIP-8)
        const tokenStore = useTokenStore();
        await tokenStore.getWallet();
        const userAddress = tokenStore.walletAddress;
        // CIP-30 signature format via MeshWallet
        const signature = await tokenStore.wallet.signData(nonce, userAddress);

        // 3. Verify & get JWT
        const { data } = await axios.post(`${config.authUrl}/api/login/verify`, {
          userId: this.userId,
          signature
        });
        
        logger.info('User login successful', { userId: this.userId });

        if (data.jwt) {
          this.jwt = data.jwt;
          // Set all user properties including id
          this.user = {
            id: this.userId,
            firstName: data.firstName,
            lastName: data.lastName,
            preferredName: data.preferredName,
            profileImage: data.profileImage,
            affiliations: data.affiliations,
            status: data.status,
            email: data.email || null,
            walletAddress: data.walletAddress || null,
            country: data.country || null,
            language: data.language || null
          };
          await SecureStoragePlugin.set({ key: 'jwt', value: data.jwt });
          
          // Sync locale store with user preferences
          const { useLocaleStore } = await import('./locale');
          const localeStore = useLocaleStore();
          localeStore.syncFromUserProfile();
          
          await this.fetchAllUsers();
        }
      } catch (error: unknown) {
        logger.error('Login failed', error);
        throw new Error(error instanceof Error ? error.message : 'Login failed - please try again');
      }
    },

    async logout() {
      try {
        await SecureStoragePlugin.remove({ key: 'jwt' });
        this.jwt = '';
        this.accountStatus = '';
      } catch (error) {
        logger.error('Logout failed', error);
        throw error;
      }
    },

    async updateUserStatus(userId: string, status: string) {
      try {
        const response = await axios.put(
          `${config.authUrl}/api/users/${userId}/status`,
          { status },
          {
            headers: {
              Authorization: `Bearer ${this.jwt}`
            }
          }
        );
        
        // Update the user in the local state
        const userIndex = this.users.findIndex((u: User) => u.id === userId);
        if (userIndex !== -1) {
          this.users[userIndex] = {
            ...this.users[userIndex],
            status
          };
        }
        
        return response.data;
      } catch (error) {
        logger.error('Failed to update user status', error);
        throw error;
      }
    },

    async updateUserProfile(data: { firstName?: string; lastName?: string; preferredName?: string; email?: string; affiliations?: string; profileImage?: string | null; country?: string | null; language?: string | null }) {
      try {
        const response = await axios.put(
          `${config.authUrl}/api/users/${this.userId}/profile`,
          data,
          {
            headers: {
              Authorization: `Bearer ${this.jwt}`
            }
          }
        );
        
        // Store the base64 string directly (don't convert to blob URL here)
        // Blob URLs will be created on-the-fly when displaying via getImageUrl
        const updatedUser = {
          ...response.data,
          profileImage: response.data.profileImage || null
        };
        
        // Update the current user in the local state
        this.user = {
          ...this.user,
          ...updatedUser
        };
        
        // Sync locale store if language or country changed
        if (data.language !== undefined || data.country !== undefined) {
          const { useLocaleStore } = await import('./locale');
          const localeStore = useLocaleStore();
          if (data.language !== undefined) {
            localeStore.setLocale(data.language);
          }
          if (data.country !== undefined) {
            localeStore.setCountry(data.country);
          }
        }
        
        return updatedUser;
      } catch (error) {
        logger.error('Failed to update user profile', error);
        throw error;
      }
    }
  },
  persist: {
    pick: ['userId', 'jwt', 'accountStatus', 'user', 'users']
    // Exclude 'wallet' and 'mnemonic' from persistence - wallet can't be serialized, mnemonic is stored securely
  }
}); 