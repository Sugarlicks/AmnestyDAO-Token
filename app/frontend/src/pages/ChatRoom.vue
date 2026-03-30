<template>
  <q-page style="background-color: white; min-height: 100%;">
    <!-- Header -->
    <div class="row items-center q-pa-sm chat-header-container">
      <q-btn
        flat
        round
        icon="arrow_back"
        @click="goBackToChatList"
        class="q-mr-sm"
      />
      <div class="ls-1">{{ chatName }}</div>
    </div>
    <div v-show="!isLoading" :class="isMobile ? 'mobile-chat-container' : 'chat-container'" ref="messagesContainer">
      <div class="messages">
        <template v-for="(item, index) in messagesWithDividers" :key="item.type === 'divider' ? `divider-${item.timestamp}` : item.data.id">
          <div v-if="item.type === 'divider'" class="date-divider">
            {{ formatDateDivider(item.timestamp) }}
          </div>
          <q-chat-message
            v-else
            :sent="item.data.sent"
            :avatar="item.data.sent ? undefined : (item.data.profileImage || undefined)"
            :bg-color="item.data.sent ? 'accent' : 'grey-2'"
            :text-color="item.data.sent ? 'white' : 'black'"
            :class="shouldAddTopPadding(index) ? 'message-top-padding' : ''"
          >
            <template v-slot:avatar v-if="!item.data.sent && !item.data.profileImage">
              <q-avatar color="secondary" text-color="white" size="40px" class="q-mr-sm">
                {{ item.data.firstName.charAt(0).toUpperCase() }}
              </q-avatar>
            </template>
            <template v-slot:default>
              <div class="message-content">
                <div v-if="!item.data.sent" class="message-name">{{ item.data.preferredName || item.data.firstName }}</div>
                <div v-html="`${item.data.content} <span class='message-timestamp'>${formatDate(item.data.timestamp)}</span>`"></div>
              </div>
            </template>
          </q-chat-message>
        </template>
      </div>
      <div class="message-input" :class="isMobile ? 'mobile-message-width' : 'message-width'">
        <q-input
          v-model="newMessage"
          :placeholder="$t('typeAMessage')"
          @keyup.enter="sendMessage"
          standout="bg-accent"
          rounded
          color="hrdao-light"
        >
          <template v-slot:after>
            <q-btn
              round
              dense
              flat
              icon="send"
              @click="sendMessage"
            />
          </template>
        </q-input>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, inject, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useChatStore } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { format, isSameDay } from 'date-fns';
import { ApolloClient, NormalizedCacheObject } from '@apollo/client/core';
import { App } from '@capacitor/app';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineOptions({
  name: 'ChatRoom'
});

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const chatStore = useChatStore();
const authStore = useAuthStore();

const apollo = inject('apollo') as ApolloClient<NormalizedCacheObject>;

const isMobile = computed(() => $q.screen.lt.md);
const chatId = computed(() => route.params.id);
const currentChat = computed(() => chatStore.currentChat);
const chatName = computed(() => currentChat.value?.name || '');

interface MessageItem {
  type: 'message';
  data: {
    id: number;
    sent: boolean;
    content: string;
    timestamp: string;
    profileImage: string | null;
    preferredName: string | null;
    firstName: string;
    lastName: string;
    senderId: string;
  };
}

interface DividerItem {
  type: 'divider';
  timestamp: string;
}

type ChatItem = MessageItem | DividerItem;

const messagesWithDividers = computed<ChatItem[]>(() => {
  if (!currentChat.value?.messages?.length) return [];
  
  const messages = currentChat.value.messages.filter(msg => msg && msg.timestamp);
  const result: ChatItem[] = [];
  
  messages.forEach((message, index) => {
    if (!message?.timestamp) return;
    
    const currentDate = new Date(message.timestamp);
    const prevDate = index > 0 && messages[index - 1]?.timestamp 
      ? new Date(messages[index - 1].timestamp) 
      : null;
    
    if (index === 0 || (prevDate && !isSameDay(currentDate, prevDate))) {
      result.push({
        type: 'divider',
        timestamp: message.timestamp
      });
    }
    result.push({
      type: 'message',
      data: message
    });
  });
  
  return result;
});

const shouldAddTopPadding = (index: number) => {
  if (index === 0) return false;
  const messages = currentChat.value?.messages || [];
  if (messages.length === 0) return false;
  if (index >= messages.length) return false;
  
  const currentMessage = messages[index];
  const previousMessage = messages[index - 1];
  if (!currentMessage || !previousMessage) return false;
  
  // Only add padding for received messages
  if (currentMessage.sent) return false;
  
  return currentMessage.senderId !== previousMessage.senderId;
};

const formatDateDivider = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return format(date, 'EEEE, MMMM d');
  } catch (e) {
    console.error('Invalid date:', timestamp);
    return '';
  }
};

const newMessage = ref('');
const isLoading = ref(true);
const messagesContainer = ref<HTMLElement | null>(null);

const scrollToBottom = async () => {
  await nextTick();
    const container = messagesContainer.value;
    const scrollHeight = container?.scrollHeight || document.body.scrollHeight;
    if (container) {
      setTimeout(() => {
        window.scrollTo(0, scrollHeight);
      }, 500);
    }
};

// Watch for chat ID changes to fetch messages
watch(chatId, async (newId) => {
  isLoading.value = true;
  $q.loading.show()
  if (newId) {
    try {
      await chatStore.fetchChatMessages(newId as string, apollo);
      isLoading.value = false;
      $q.loading.hide();
      // Ensure DOM is updated before scrolling
      await nextTick();
      // Try scrolling multiple times to ensure it works
      scrollToBottom();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      $q.notify({
        type: 'negative',
        message: t('failedToLoadMessages')
      });
      isLoading.value = false;
      $q.loading.hide();
    }
  }
}, { immediate: true });

// Watch for new messages and scroll to bottom
watch(
  () => currentChat.value?.messages,
  async (newMessages, oldMessages) => {
    if (!newMessages) return;
    
    // Scroll on initial load or when new messages are added
    if (!oldMessages || newMessages.length > oldMessages.length) {
      await nextTick();
      scrollToBottom();

    }
  },
  { deep: true }
);

onMounted(async () => {
  try {
    await authStore.fetchAllUsers();
    if (chatId.value) {
      await chatStore.fetchChatMessages(chatId.value as string, apollo);
      await nextTick();
      scrollToBottom();
    }
  } catch (error) {
    console.error('Failed to fetch users:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadUserData')
    });
  }
  
  // Add app state change listener for app closing/backgrounding
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      chatStore.handleAppClosing();
    }
  });
});

const sendMessage = async () => {
  if (!newMessage.value.trim() || !chatId.value) return;
  
  const messageContent = newMessage.value;
  newMessage.value = ''; // Clear input immediately
  
  // Optimistically add message to UI
  if (currentChat.value) {
    const optimisticMessage = {
      id: Date.now(), // Temporary ID
      content: messageContent,
      timestamp: new Date().toISOString(),
      sent: true,
      senderId: authStore.user?.id || '',
      firstName: authStore.user?.firstName || '',
      lastName: authStore.user?.lastName || '',
      preferredName: authStore.user?.preferredName || null,
      profileImage: authStore.user?.profileImage || null
    };
    
    currentChat.value.messages = [...currentChat.value.messages, optimisticMessage];
    nextTick(() => scrollToBottom());
  }
  
  try {
    await chatStore.sendMessage(chatId.value as string, messageContent);
  } catch (error) {
    console.error('Failed to send message:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToSendMessage')
    });
    // Optionally remove the optimistic message on error
    if (currentChat.value) {
      currentChat.value.messages = currentChat.value.messages.filter(m => m.id !== Date.now());
    }
  }
};

const goBackToChatList = () => {
  router.replace('/chat');
};

const formatDate = (timestamp: string) => {
  if (!timestamp) return format(new Date(), 'HH:mm');
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return format(date, 'HH:mm');
};

// Cleanup subscription and mark chat as read before component is unmounted
onBeforeUnmount(() => {
  if (chatStore._unsubscribe) {
    chatStore._unsubscribe();
  }
  // Mark chat as read when leaving the chat room
  if (chatId.value) {
    chatStore.markChatAsRead(chatId.value as string);
  }
  // Remove app state change listener
  App.removeAllListeners();
});
</script>

<style scoped>
::deep(.q-message-avatar) {
  width: 30px !important;
  height: 30px !important;
}

.chat-header-container {
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: #fff000;
}
.chat-container {
  display: flex;
  flex-direction: column;
  padding: 2rem;
  padding-bottom: 0px;
  padding-top: 10px;
}

.mobile-chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  padding-bottom: 0px;
  padding-top: 0px;
}

.messages {
  flex: 1;
  margin-bottom: 1rem;
  overflow-y: auto;
  padding-bottom: 1rem;
  overflow-x: hidden;
  min-height: 200px;
}

.message-input {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 5px 1rem 1rem;
  margin-top: auto;
}
.mobile-message-width {
  width: 100%;
}
.message-width {
  width: 100%;
  padding-right: 340px;
}

:deep(.q-message-stamp) {
  text-align: end;
  font-size: 10px;
}

:deep(.q-message-avatar) {
  width: 40px;
  height: 40px;
  min-width: 40px;
}

:deep(.message-timestamp) {
  font-size: 0.7em;
  opacity: 0.7;
  margin-left: 8px;
  display: inline-block;
  vertical-align: middle;
}

:deep(.q-message-text) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.message-content) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.message-name) {
  font-size: 0.8em;
  font-weight: 500;
  opacity: 0.8;
}

:deep(.q-message-text) {
  border-radius: 12px !important;
}

:deep(.q-message-text::before) {
  display: none !important;
}

:deep(.q-message-text::after) {
  display: none !important;
}

:deep(.message-top-padding) {
  margin-top: 1.5rem !important;
}

.date-divider {
  text-align: center;
  margin: 1.5rem 0;
  color: #666;
  font-size: 0.9rem;
  position: relative;
}

.date-divider::before,
.date-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30%;
  height: 1px;
  background-color: #ddd;
}

.date-divider::before {
  left: 0;
}

.date-divider::after {
  right: 0;
}

/* :deep(.q-message) {
  max-width: 70%;
}

:deep(.q-message-sent) {
  margin-left: auto;
}

:deep(.q-message-text) {
  background: var(--q-primary);
  color: white;
  border-radius: 1rem;
  padding: 0.5rem 1rem;
}

:deep(.q-message-text--sent) {
  background: var(--q-secondary);
  color: white;
}

:deep(.q-message-container) {
  flex-direction: row-reverse;
}

:deep(.q-message-sent .q-message-container) {
  flex-direction: row-reverse;
}

:deep(.q-message-received .q-message-container) {
  flex-direction: row;
} */
</style> 