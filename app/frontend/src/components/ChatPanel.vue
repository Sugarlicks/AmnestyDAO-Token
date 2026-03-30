<template>
  <div 
    class="chat-panel"
    :class="{ 
      'chat-panel-open': props.isChatPanelOpen,
      'mobile': isMobile
    }"
  >
    <div class="panel-content">
      <!-- Header Section -->
      <div class="header-section">
        <div class="header-row">
          <div>
            <p class="ls-1">{{ $t('chatChannels') }}</p>
            <p class="panel-subtitle">{{ $t('chatChannelsSubtitle') }}</p>
          </div>
          <q-btn
            v-if="isAdmin"
            flat
            round
            icon="edit"
            size="sm"
            class="create-channel-btn"
            @click="goToAdminChat"
          />
        </div>
      </div>

      <!-- Chat Channels List -->
      <div class="channels-list">
        <div v-if="chatStore.loading" class="loading-state">
          <q-skeleton type="rect" height="80px" class="q-mb-md" v-for="n in 3" :key="n" />
        </div>
        <div v-else-if="chatStore.error" class="error-state">
          <q-icon name="error" color="negative" />
          <span class="text-negative">{{ chatStore.error }}</span>
        </div>
        <div v-else-if="chatStore.chats.length === 0" class="empty-state">
          <q-icon name="chat_bubble_outline" size="48px" color="grey-5" />
          <p class="empty-state-title">{{ $t('noChannelsYet') }}</p>
          <p class="empty-state-message">
            <span v-if="isAdmin">{{ $t('createFirstChannel') }}</span>
            <span v-else>{{ $t('channelsWillAppear') }}</span>
          </p>
        </div>
        <div 
          v-else
          v-for="chat in chatStore.chats" 
          :key="chat.id" 
          class="channel-card"
          @click="openChat(chat.id)"
        >
          <!-- Channel Icon/Image -->
          <div class="channel-icon">
            <q-img
              v-if="getChatImageUrl(chat)"
              :src="getChatImageUrl(chat)"
              class="channel-image"
              fit="cover"
            />
            <q-icon v-else name="chat_bubble_outline" size="24px" color="black" />
          </div>
          
          <!-- Channel Content -->
          <div class="channel-content">
            <div class="channel-header">
              <span class="channel-title">{{ chat.name }}</span>
            </div>
            
            <div class="channel-meta">
              <div class="participants-info">
                <q-icon name="people" size="16px" color="grey-7" />
                <span class="participants-count">{{ chat.memberCount }} {{ $t('participants') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useChatStore } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { getImageUrl } from '../utils/imageUtils';

const { t } = useI18n();

const router = useRouter();
const $q = useQuasar();
const chatStore = useChatStore();
const authStore = useAuthStore();
const isMobile = computed(() => $q.screen.lt.md);

const props = defineProps<{
  isChatPanelOpen: boolean;
}>();

const isAdmin = computed(() => authStore.user.status === 'admin');

const getChatImageUrl = (chat: any): string | null => {
  if (!chat.image) return null;
  // Use unified image utility for consistent handling
  const result = getImageUrl(chat.image);
  return result.url;
};

const openChat = (chatId: string) => {
  router.push(`/chat/${chatId}`);
};

const goToAdminChat = () => {
  router.push('/admin/chats');
};

onMounted(async () => {
  try {
    await chatStore.fetchChats();
  } catch (error) {
    console.error('Failed to fetch chats:', error);
  }
});
</script>

<style scoped lang="scss">
.chat-panel {
  position: fixed;
  left: 56px;
  top: 0;
  width: 350px;
  height: 100vh;
  background: #f5f5f5; // Light grey background
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 100;
  border-right: 1px solid rgba(0,0,0,0.12);
  overflow-y: auto;
}

.chat-panel-open {
  transform: translateX(0);
}

.chat-panel.mobile {
  left: 0;
  width: 100%;
}

.panel-content {
  position: absolute;
  top: 150px;
  padding: 24px 16px;
}

.header-section {
  margin-bottom: 24px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding-top: 12px;
}


.panel-subtitle {
  font-size: 0.875rem;
  color: #666;
  margin: 0;
  line-height: 1.4;
}

.create-channel-btn {
  color: #000;
  margin-top: 4px;
}

.channels-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.channel-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
  position: relative;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.channel-icon {
  width: 48px;
  height: 48px;
  min-width: 48px;
  background: #FFFF00; // Light yellow background
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.channel-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.channel-content {
  flex: 1;
  min-width: 0;
}

.channel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.channel-title {
  font-size: 0.875rem;
  color: #000;
  margin: 0;
  flex: 1;
  line-height: 1.3;
  font-weight: 500;
}

.channel-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.participants-info {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
  font-size: 0.875rem;
}

.participants-count {
  color: #666;
}

.loading-state,
.error-state,
.empty-state {
  padding: 16px;
  text-align: center;
}

.error-state {
  color: #C10015;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 12px;
}

.empty-state-title {
  font-size: 1rem;
  font-weight: 600;
  color: #000;
  margin: 0;
}

.empty-state-message {
  font-size: 0.875rem;
  color: #666;
  margin: 0;
  line-height: 1.4;
  max-width: 250px;
}
</style>
