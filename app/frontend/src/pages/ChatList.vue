<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <div class="col-12">
        <h4 class="text-h4 q-mb-lg">{{ $t('chats') }}</h4>
      </div>
      
      <div v-if="chatStore.loading" class="col-12">
        <div class="row q-col-gutter-md">
          <div v-for="n in 3" :key="n" class="col-12 col-sm-6 col-md-4">
            <q-card flat bordered>
              <q-skeleton height="200px" square />
              <q-card-section>
                <q-skeleton type="text" class="text-subtitle2" />
                <q-skeleton type="text" width="50%" class="text-subtitle2" />
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <div v-else-if="chatStore.error" class="col-12">
        <q-banner rounded class="bg-negative text-white">
          {{ chatStore.error }}
        </q-banner>
      </div>

      <div v-else class="col-12">
        <div class="row q-col-gutter-md">
          <div v-for="chat in chatStore.chats" :key="chat.id" class="col-12 col-sm-6 col-md-4">
            <q-card 
              class="cursor-pointer"
              @click="openChat(chat.id)"
            >
              <q-img
                :src="iconLogo"
                :ratio="16/9"
                class="rounded-borders"
                :style="{ backgroundColor: getChatBg(chat.id, chat.name) }"
              >
                <template v-slot:loading>
                  <div class="absolute-full flex flex-center">
                    <q-spinner color="primary" size="3em" />
                  </div>
                </template>
                <div class="absolute-bottom text-subtitle2">
                  {{ chat.memberCount }} {{ $t('members') }}
                </div>
              </q-img>

              <q-card-section>
                <div class="text-h6">{{ chat.name }}</div>
                <div class="text-caption text-grey">
                  {{ $t('created') }} {{ formatDate(chat.createdAt) }}
                </div>
              </q-card-section>

              <q-card-section class="q-pt-none">
                <div class="text-body2">
                  {{ chat.lastMessage || $t('noMessagesYet') }}
                </div>
                <div class="text-caption text-grey">
                  {{ chat.memberCount }} {{ $t('members') }}
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useChatStore } from '../stores/chat';
import { format } from 'date-fns';
import iconLogo from '../assets/icon-logo.svg';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineOptions({
  name: 'ChatList'
});

const router = useRouter();
const chatStore = useChatStore();

const chatBgColors = [
  '#FFFF00',
  '#FFE082',
  '#C5E1A5',
  '#B3E5FC',
  '#FFCDD2'
];

const getChatBg = (chatId: string | number, name?: string) => {
  const key = String(chatId || name || '0');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % chatBgColors.length;
  return chatBgColors[index];
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return t('invalidDate');
    }
    return format(date, 'dd MMM yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return t('invalidDate');
  }
};

onMounted(async () => {
  try {
    await chatStore.fetchChats();
  } catch (error) {
    console.error('Failed to fetch chats:', error);
  }
});

const openChat = (chatId: string) => {
  router.push(`/chat/${chatId}`);
};
</script>

<style scoped>
.q-card {
  transition: transform 0.2s;
}

.q-card:hover {
  transform: translateY(-5px);
}
</style> 