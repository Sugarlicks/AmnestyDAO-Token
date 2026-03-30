import { defineStore } from 'pinia';
import axios from 'axios';
import { useAuthStore } from './auth';
import { useApolloStore } from './apollo';
// import { inject, getCurrentInstance } from 'vue';
import { gql } from '@apollo/client/core';
import { ApolloClient, NormalizedCacheObject } from '@apollo/client/core';
import config from '../config';

// what we get from the backend
interface ChatObj {
  id: string;
  name: string;
  last_message: string | null;
  image: string | null;
  created_at: string;
  member_count: number;
  is_private: boolean;
}

// what we store in the store
export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  messages: Message[];
  image: string | null;
  createdAt: string;
  memberCount: number;
  isPrivate: boolean;
  unreadCount: number;
  lastReadTimestamp?: string;
}

interface Message {
  id: number;
  content: string;
  senderId: string;
  timestamp: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  profileImage: string | null;
  sent: boolean;
}

interface GraphQLMessage {
  id: number;
  content: string;
  sender_id: string;
  sent_at: string;
}

interface SubscriptionData {
  messages: GraphQLMessage[];
}

interface ChatStoreState {
  chats: Chat[];
  currentChat: Chat | null;
  loading: boolean;
  error: string | null;
  _unsubscribe?: () => void;
  _chatSubscriptions: Record<string, () => void>;  // Track subscriptions for each chat
  lastReadTimestamps: Record<string, string>;
  _lastActiveChat: string | null;
}

export const useChatStore = defineStore('chat', {
  state: (): ChatStoreState => ({
    chats: [],
    currentChat: null,
    loading: false,
    error: null,
    lastReadTimestamps: {},
    _lastActiveChat: null,
    _chatSubscriptions: {} as Record<string, () => void>
  }),

  actions: {
    async fetchChats() {
      const authStore = useAuthStore();
      if (!authStore.jwt) {
        throw new Error('Not authenticated');
      }

      this.loading = true;
      this.error = null;

      try {
        // Fetch chats and read timestamps in parallel
        const [chatsResponse, timestampsResponse] = await Promise.all([
          axios.get(`${config.authUrl}/api/chats`, {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }),
          axios.get(`${config.authUrl}/api/chats/read-timestamps`, {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          })
        ]);
        
        // Store the read timestamps
        this.lastReadTimestamps = timestampsResponse.data;
        
        // Transform the response to match our interface
        this.chats = chatsResponse.data.map((chat: ChatObj) => {
          // Calculate member count for public chats
          let memberCount = chat.member_count;
          if (!chat.is_private) {
            memberCount = authStore.users.filter(user => 
              user.status === 'approved' || user.status === 'admin'
            ).length;
          }

          return {
            id: chat.id,
            name: chat.name,
            lastMessage: chat.last_message || '',
            messages: [],
            image: chat.image,
            createdAt: chat.created_at,
            memberCount,
            isPrivate: chat.is_private,
            unreadCount: 0,
            lastReadTimestamp: this.lastReadTimestamps[chat.id]
          };
        });

        // Set up subscriptions for all chats
        await this.setupChatSubscriptions();

        // Update unread counts after loading chats
        this.updateUnreadCounts();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to fetch chats';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async setupChatSubscriptions() {
      const authStore = useAuthStore();
      const apolloStore = useApolloStore();
      const apollo = apolloStore.client;
      if (!apollo) {
        console.error('Apollo client not available');
        return;
      }

      // Clean up existing subscriptions
      Object.values(this._chatSubscriptions).forEach((unsubscribe: () => void) => unsubscribe());
      this._chatSubscriptions = {};

      // Set up new subscriptions for each chat
      for (const chat of this.chats) {
        const observable = apollo.subscribe({
          query: gql`
            subscription OnNewMessage($chatId: uuid!) {
              messages(where:{chat_id:{_eq:$chatId}}, order_by:{sent_at:asc}) {
                id
                content
                sender_id
                sent_at
              }
            }
          `,
          variables: { chatId: chat.id },
          fetchPolicy: 'no-cache'
        });

        const subscription = observable.subscribe({
          next: ({ data }: { data: SubscriptionData }) => {
            // Transform messages using the users list from auth store
            const messages = data.messages.map((m: GraphQLMessage) => {
              const user = authStore.users.find(u => u.id === m.sender_id);
              return {
                id: m.id,
                content: m.content,
                senderId: m.sender_id,
                timestamp: m.sent_at,
                firstName: user?.firstName || '',
                lastName: user?.lastName || '',
                preferredName: user?.preferredName || null,
                profileImage: user?.profileImage || null,
                sent: m.sender_id === authStore.userId
              };
            });

            // Update chat messages
            const chatIndex = this.chats.findIndex(c => c.id === chat.id);
            if (chatIndex !== -1) {
              // Create a new chat object to avoid proxy issues
              const updatedChat = {
                ...this.chats[chatIndex],
                messages: [...messages],
                lastMessage: messages.length > 0 ? messages[messages.length - 1].content : ''
              };
              
              // Replace the chat in the array
              this.chats[chatIndex] = updatedChat;
              
              // Update current chat if this is the active chat
              if (this.currentChat?.id === chat.id) {
                this.currentChat = updatedChat;
              }

              // Update unread counts
              this.updateUnreadCounts();
            }
          },
          error(error: Error) {
            console.error(`Subscription error for chat ${chat.id}:`, error);
          }
        });

        this._chatSubscriptions[chat.id] = () => subscription.unsubscribe();
      }
    },

    async fetchChatMessages(chatId: string, apollo: ApolloClient<NormalizedCacheObject>) {
      const authStore = useAuthStore();
      this.loading = true;
      this.error = null;

      try {
        // If we're switching chats, mark the previous chat as read
        if (this._lastActiveChat && this._lastActiveChat !== chatId) {
          await this.markChatAsRead(this._lastActiveChat);
        }

        // Update the last active chat
        this._lastActiveChat = chatId;

        // 1) Fetch initial messages via a GraphQL query
        const { data: initial } = await apollo.query({
          query: gql`
            query FetchMessages($chatId: uuid!) {
              messages(where:{chat_id:{_eq:$chatId}}, order_by:{sent_at:asc}) {
                id
                content
                sender_id
                sent_at
              }
            }
          `,
          variables: { chatId }
        });

        // Transform messages using the users list from auth store
        const msgs: Message[] = initial.messages.map((m: GraphQLMessage) => {
          const user = authStore.users.find(u => u.id === m.sender_id);
          return {
            id: m.id,
            content: m.content,
            senderId: m.sender_id,
            timestamp: m.sent_at,
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            preferredName: user?.preferredName || null,
            profileImage: user?.profileImage || null,
            sent: m.sender_id === authStore.userId
          };
        });

        // attach to the correct Chat object
        const idx = this.chats.findIndex(c => c.id === chatId);
        if (idx !== -1) {
          // Create a new chat object to avoid proxy issues
          const updatedChat = {
            ...this.chats[idx],
            messages: [...msgs]
          };
          
          // Replace the chat in the array
          this.chats[idx] = updatedChat;
          this.currentChat = updatedChat;
        }

        // Update unread counts
        this.updateUnreadCounts();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to fetch messages';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async sendMessage(chatId: string, content: string) {
      const authStore = useAuthStore();
      if (!authStore.jwt) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await axios.post(
          `${config.authUrl}/api/chats/${chatId}/messages`,
          { content },
          {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        );

        // Update the chat's messages
        const chatIndex = this.chats.findIndex(chat => chat.id === chatId);
        if (chatIndex !== -1) {
          // Create a new chat object to avoid proxy issues
          const updatedChat = {
            ...this.chats[chatIndex],
            messages: [...this.chats[chatIndex].messages, response.data],
            lastMessage: content
          };
          
          // Replace the chat in the array
          this.chats[chatIndex] = updatedChat;
          
          if (this.currentChat?.id === chatId) {
            this.currentChat = updatedChat;
          }
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to send message';
        throw error;
      }
    },

    async markChatAsRead(chatId: string) {
      const authStore = useAuthStore();
      if (!authStore.jwt) {
        throw new Error('Not authenticated');
      }

      try {
        // Update the read timestamp in the database
        const response = await axios.post(
          `${config.authUrl}/api/chats/${chatId}/read`,
          {},
          {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        );

        // Update local state
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
          this.lastReadTimestamps[chatId] = response.data.lastReadAt;
          chat.lastReadTimestamp = response.data.lastReadAt;
          chat.unreadCount = 0;
        }
      } catch (error) {
        console.error('Failed to mark chat as read:', error);
        // Still update local state even if the server request fails
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
          const lastMessage = chat.messages[chat.messages.length - 1];
          if (lastMessage) {
            this.lastReadTimestamps[chatId] = lastMessage.timestamp;
            chat.lastReadTimestamp = lastMessage.timestamp;
            chat.unreadCount = 0;
          }
        }
      }
    },

    updateUnreadCounts() {
      this.chats.forEach(chat => {
        if (!chat.messages.length) return;
        
        // Don't count unread messages for the current chat
        if (this.currentChat?.id === chat.id) {
          chat.unreadCount = 0;
          return;
        }
        
        const lastReadTimestamp = this.lastReadTimestamps[chat.id];
        if (!lastReadTimestamp) {
          chat.unreadCount = chat.messages.length;
          return;
        }

        const lastReadDate = new Date(lastReadTimestamp);
        chat.unreadCount = chat.messages.filter(msg => 
          new Date(msg.timestamp) > lastReadDate && !msg.sent
        ).length;
      });
    },

    // Add a new method to handle app closing
    async handleAppClosing() {
      if (this._lastActiveChat) {
        await this.markChatAsRead(this._lastActiveChat);
      }
    },

    // Add cleanup method
    cleanup() {
      // Unsubscribe from all chat subscriptions
      // TODO test subscription fix
      // Previously: Object.values(this._chatSubscriptions).forEach(unsubscribe => unsubscribe()); incase subscriptions stop working
      Object.values(this._chatSubscriptions).forEach((unsubscribe: () => void) => unsubscribe());
      this._chatSubscriptions = {};
    },

    async updateChat(chatId: string, updates: { name: string; isPrivate: boolean; image?: string | null }) {
      const authStore = useAuthStore();
      if (!authStore.jwt) {
        throw new Error('Not authenticated');
      }

      try {
        // Use FormData to match backend's upload.none() middleware
        const formData = new FormData();
        formData.append('name', updates.name);
        formData.append('isPrivate', String(updates.isPrivate));
        if (updates.image) {
          formData.append('image', updates.image);
        }

        const response = await axios.put(
          `${config.authUrl}/api/chats/${chatId}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        // Refresh chats list to get updated data
        await this.fetchChats();

        return response.data;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update chat';
        throw error;
      }
    },

    async createChat(chatData: { name: string; isPrivate: boolean; image?: string | null }) {
      const authStore = useAuthStore();
      if (!authStore.jwt) {
        throw new Error('Not authenticated');
      }

      try {
        // Use FormData to match backend's upload.none() middleware
        const formData = new FormData();
        formData.append('name', chatData.name);
        formData.append('isPrivate', String(chatData.isPrivate));
        if (chatData.image) {
          formData.append('image', chatData.image);
        }

        const response = await axios.post(
          `${config.authUrl}/api/chats`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        // Refresh chats list to include the new chat
        await this.fetchChats();
        
        return response.data;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to create chat';
        throw error;
      }
    }
  },
  persist: true
}); 