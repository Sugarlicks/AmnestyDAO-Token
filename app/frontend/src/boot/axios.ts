// src/boot/axios.ts
import { boot } from 'quasar/wrappers';
import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import config from '../config';
import { useAuthStore } from '../stores/auth';
import { logger } from '../utils/logger';


export default boot(({ router }) => {
  // Set default axios configuration
  axios.defaults.baseURL = config.authUrl;
  axios.defaults.withCredentials = true;
  axios.defaults.headers.common['Accept'] = 'application/json';
  axios.defaults.headers.common['Content-Type'] = 'application/json';

  axios.interceptors.request.use(
    async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
      // Make sure headers exist
      if (!config.headers) {
        config.headers = {} as InternalAxiosRequestConfig['headers'];
      }

      try {
        const result = await SecureStoragePlugin.get({ key: 'jwt' });
        if (result && result.value) {
          config.headers['Authorization'] = `Bearer ${result.value}`;
        }
      } catch (error: unknown) {
        // If the key doesn't exist yet, that's okay - we'll just proceed without a token
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response interceptor for JWT expiration handling
  axios.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      logger.error('Request failed', {
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method,
        message: error.message
      });

      // Check if error is due to JWT expiration
      if (error.response?.status === 401 && 
          (error.response?.data?.message?.includes('jwt expired') || 
           error.response?.data?.error?.includes('jwt expired'))) {
        logger.warn('JWT expired, logging out and redirecting to root');
        
        // Clear JWT from storage
        await SecureStoragePlugin.remove({ key: 'jwt' });
        
        // Clear auth store
        const authStore = useAuthStore();
        authStore.jwt = '';
        authStore.accountStatus = '';
        
        // Redirect to root
        router.push('/');
      }
      
      return Promise.reject(error);
    }
  );
});
 