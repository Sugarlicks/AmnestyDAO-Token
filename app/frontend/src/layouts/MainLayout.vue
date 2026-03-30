<template>
  <q-layout view="hHh Lpr lff">
    <q-header v-if="auth.jwt && !isMobileChatRoom && !isSplashScreen" class="bg-white text-black">
      <q-toolbar>
        <q-toolbar-title class="row items-center">
          <q-avatar size="30px" class="q-ml-sm" color="primary" @click="goHome()">
            <img src="../assets/icon-logo.svg" alt="HRDAO" />
          </q-avatar>
          <div class="column q-ml-md">
            <div class="text-h6 text-weight-bold" style="margin-bottom: -5px;">{{ $t('hrDao') }}</div>
            <div class="text-caption title-caption">{{ $t('poweredByAmnesty') }}</div>
          </div>
          <q-space />
          <!-- <q-btn size="small" flat round dense icon="chat_bubble_outline" class="q-mr-sm" @click="router.push('/chat')" />
          <q-btn size="small" flat round dense icon="notifications_none" class="q-mr-sm">
            <q-badge color="pink-5" floating rounded />
          </q-btn> -->
          <q-avatar 
            v-if="auth.user.profileImage" 
            size="30px" 
            class="cursor-pointer q-ml-sm"
            @click="accountPanel?.open()"
          >
            <img :src="getFullImageUrl(auth.user.profileImage)">
          </q-avatar>
          <q-avatar 
            v-else 
            size="30px" 
            color="primary" 
            text-color="black"
            class="cursor-pointer q-ml-sm"
            @click="accountPanel?.open()"
          >
            <q-icon name="person" size="20px" />
          </q-avatar>
        </q-toolbar-title>
      </q-toolbar>
      <q-card flat>
        <q-card-section class="q-card__section--vert">
          <WalletBalance @open-wallet="handleOpenWallet" />
        </q-card-section>
      </q-card>
      <HorizontalNavBar v-if="auth.jwt && !isMobileChatRoom" />
    </q-header>
    <ChatPanel :isChatPanelOpen="isChatPanelOpen" />
    <q-page-container 
      :class="{ 'chat-panel-open': isChatPanelOpen }" 
      :style="{ backgroundColor: isSplashScreen ? '#fff000' : '#f5f5f5' }"
      ref="mainPageContainer"
    >
      <router-view />
    </q-page-container>

    <!-- <MobileNavigationFooter v-if="auth.jwt && isMobile && !isChatRoom" class="mobile-footer" /> -->
    <AccountPanel ref="accountPanel" />
    <MobileWallet
      v-if="isMobile"
      v-model="showMobileWallet"
      :user-balance="tokenStore.getUserBalance"
      :treasury-balance="tokenStore.getTreasuryBalance"
      :user-transactions="tokenStore.getUserTransactions"
      :treasury-transactions="tokenStore.getTreasuryTransactions"
      :loading="tokenStore.isLoading"
      @refresh="handleWalletRefresh"
      @close="showMobileWallet = false"
    />
  </q-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import HorizontalNavBar from '../components/HorizontalNavBar.vue';
// import MobileNavigationFooter from '../components/MobileNavigationFooter.vue';
import AccountPanel from '../components/AccountPanel.vue';
import ChatPanel from '../components/ChatPanel.vue';
import WalletBalance from '../components/WalletBalance.vue';
import MobileWallet from '../components/MobileWallet.vue';
import { useAuthStore } from '../stores/auth';
import { useTokenStore } from '../stores/token';
import { useBlockchainStore } from '../stores/blockchain';
import { useQuasar } from 'quasar';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getImageUrl } from '../utils/imageUtils';
import { logger } from '../utils/logger';

const { t } = useI18n();

defineOptions({
  name: 'MainLayout'
});

const router = useRouter()
const auth = useAuthStore();
const tokenStore = useTokenStore();
const blockchainStore = useBlockchainStore();
const $q = useQuasar();
const route = useRoute();

const isMobile = computed(() => $q.screen.lt.md);
const isChatRoom = computed(() => route.params.id !== undefined);
const isMobileChatRoom = computed(() => isMobile.value && isChatRoom.value);
const isSplashScreen = computed(() => route.path === '/' || route.path === '/register');

const userInitials = computed(() => {
  const display = auth.user.preferredName || '';
  return display.slice(0, 2).toUpperCase();
});

const accountPanel = ref<InstanceType<typeof AccountPanel> | null>(null);
const showMobileWallet = ref(false);
const isChatPanelOpen = ref(false);
const mainPageContainer = ref<HTMLElement | null>(null);

// Add computed property for scroll height
const currentScrollHeight = computed(() => {
  return mainPageContainer.value?.scrollHeight || 0;
});

// Watch scroll height changes (removed verbose logging)
watch(currentScrollHeight, () => {
  // Scroll height tracking for UI purposes only
});


// Watch for route changes to open chat panel
watch(() => router.currentRoute.value, (route) => {
  if (isMobile.value && route.params.id) {
    isChatPanelOpen.value = false;
  } else {
    isChatPanelOpen.value = route.path.startsWith('/chat');
  }
}, { immediate: true });

function getFullImageUrl(path: string | { data: number[], type: string } | null) {
  if (!path) return null;
  // Use the unified image utility which handles all formats correctly
  if (typeof path === 'string') {
    const result = getImageUrl(path);
    return result.url;
  }
  if (typeof path === 'object' && path.data) {
    // Convert object format to base64 string first
    const base64 = btoa(String.fromCharCode(...path.data));
    const result = getImageUrl(base64);
    return result.url;
  }
  return null;
}

function goHome() {
  router.replace('/')
}

function handleOpenWallet() {
  if (isMobile.value) {
    // Initialize token data if not already loaded
    if (auth.jwt && tokenStore.getUserBalance === 0 && !tokenStore.isLoading) {
      initializeTokenData();
    }
    showMobileWallet.value = true;
  } else {
    // On desktop, navigate to wallet page
    router.push('/wallet');
  }
}

async function initializeTokenData() {
  try {
    await Promise.all([
      tokenStore.refreshBalances(),
      tokenStore.fetchUserTransactions(),
      auth.user.status === 'admin' ? tokenStore.fetchTreasuryTransactions() : Promise.resolve()
    ]);
  } catch (error) {
    logger.error('Failed to initialize token data', error);
  }
}

async function handleWalletRefresh() {
  await initializeTokenData();
}

// Watch for pending transactions completing and refresh balance
watch(
  () => blockchainStore.pendingTxHashes.length,
  (newCount, oldCount) => {
    if (oldCount !== undefined && newCount < oldCount && newCount === 0) {
      tokenStore.refreshBalances().catch(err => {
        logger.error('Failed to refresh balance after transaction completion', err);
      });
    }
  }
);

// Subscriptions removed - balances now come from blockchain

</script>

<style scoped>
.logo {
  height: 20px; 
  margin-right: 10px; 
  margin-left: 10px;
}

.brand-square {
  width: 40px;
  height: 40px;
  background: #FFFF00;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-icon {
  width: 24px;
  height: 24px;
}

.title-caption {
  font-size: 8px;
  opacity: 0.8;
  max-width: 100px;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: inherit;
}

.q-toolbar {
  justify-content: space-around;
}

.q-page-container {
  min-height: calc(100vh - 50px); /* Account for header height */
  padding-bottom: 60px; /* Space for mobile footer */
}

.q-page-container.chat-panel-open {
  padding-left: 300px !important;
}

.mobile-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: opacity 0.3s ease;
}

.mobile-footer.hidden {
  opacity: 0;
  pointer-events: none;
}

.q-page-container {
  background-color: #f5f5f5; /* Default, overridden by style binding */
}

.q-card__section--vert {
  padding: 8px !important;
}
</style>
