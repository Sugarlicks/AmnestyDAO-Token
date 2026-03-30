// src/boot/apollo.ts
import { boot } from 'quasar/wrappers';
import { ApolloClient, InMemoryCache, HttpLink, split, from } from '@apollo/client/core';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient }  from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { useAuthStore } from '../stores/auth';
import { useApolloStore } from '../stores/apollo';
import config from '../config';
import { logger } from '../utils/logger';

export default boot(async ({ app }) => {
  logger.info('Initializing Apollo client');

  const authLink = setContext((_, { headers }) => {
    const authStore = useAuthStore();
    const token = authStore.jwt;
    const userId = authStore.userId;
    
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
        'x-hasura-user-id': userId || '',
      }
    };
  });

  const httpLink = new HttpLink({
    uri: config.hasuraUrl,
  });

  const wsLink = new GraphQLWsLink(createClient({
    url: config.hasuraWsUrl,
    connectionParams: () => {
      const authStore = useAuthStore();
      const token = authStore.jwt;
      const userId = authStore.userId;
      return {
        headers: {
          authorization: token ? `Bearer ${token}` : '',
          'x-hasura-user-id': userId || '',
        }
      };
    }
  }));

  const link = split(
    ({ query }) => {
      const def = getMainDefinition(query);
      return def.kind === 'OperationDefinition' && def.operation === 'subscription';
    },
    wsLink,
    from([authLink, httpLink])
  );

  const apollo = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      },
    }
  });

  // Set the Apollo client in the Apollo store
  const apolloStore = useApolloStore();
  apolloStore.setClient(apollo);

  app.provide('apollo', apollo);
});
