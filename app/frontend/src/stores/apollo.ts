import { defineStore } from 'pinia';
import { ApolloClient, NormalizedCacheObject } from '@apollo/client/core';

export const useApolloStore = defineStore('apollo', {
  state: () => ({
    client: null as ApolloClient<NormalizedCacheObject> | null
  }),

  actions: {
    setClient(client: ApolloClient<NormalizedCacheObject>) {
      this.client = client;
    }
  }
}); 