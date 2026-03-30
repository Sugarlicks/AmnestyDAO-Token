declare module '@capacitor-secure-storage-plugin'{
  export const SecureStoragePlugin: {
    get(options: { key: string }): Promise<{ value: string }>;
    set(options: { key: string, value: string }): Promise<void>;
    remove(options: { key: string }): Promise<void>;
  };
} 