<template>
  <div class="splash-screen">
    <div class="logo-container">
      <img src="../assets/amnesty-text-logo.png" alt="Application Logo" class="application-logo" />
      
      <!-- Language Selection for New Users -->
      <div v-if="showLanguageSelector" class="language-selector-container">
        <q-select
          v-model="selectedLanguage"
          :options="languageOptions"
          option-value="code"
          option-label="name"
          emit-value
          map-options
          filled
          dense
          :label="$t('language')"
          class="language-select q-mb-md"
          style="min-width: 250px;"
          menu-anchor="bottom middle"
          menu-self="top middle"
          :menu-offset="[0, 8]"
          popup-content-class="language-select-popup"
        >
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>
        <q-btn
          :label="$t('continue')"
          unelevated
          class="continue-btn"
          @click="onLanguageSelected"
          :style="{ background: '#000', color: '#fff000', width: '250px' }"
        />
      </div>
      
      <!-- Loading/Status Message for Existing Users -->
      <div v-else-if="busy" class="status-message text-overline text-dark">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useLocaleStore } from '../stores/locale';
import { useContributionsStore } from '../stores/contributions';
import { useCampaignsStore } from '../stores/campaigns';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { SplashScreen } from '@capacitor/splash-screen';
import { logger } from '../utils/logger';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const auth = useAuthStore();
const localeStore = useLocaleStore();
const contributionsStore = useContributionsStore();
const campaignsStore = useCampaignsStore();
const busy = ref(false);
const showLanguageSelector = ref(false);
const selectedLanguage = ref<string>('en');

const languageOptions = computed(() => localeStore.availableLocales);

const message = computed(() => {
  return auth.accountStatus === 'pending' 
    ? t('accountPendingApproval') 
    : t('gettingAccountKeys');
});

async function clearAuthState() {
  // Clear JWT from secure storage
  try {
    await SecureStoragePlugin.remove({ key: 'jwt' });
  } catch (error) {
    logger.warn('Failed to remove JWT from secure storage', error);
  }
  // Clear auth store state (this will also clear persisted state)
  auth.jwt = '';
  auth.userId = '';
  auth.accountStatus = '';
  auth.user = {} as any;
}

async function checkAndLogin() {
  busy.value = true;
  let shouldContinue = true;
  
  try {
    // 1) Do we have a stored private key?
    let mnemonic: string | null = null;
    let userId: string | null = null;
    
    try {
      const mnemonicResult = await SecureStoragePlugin.get({ key: 'mnemonic' });
      mnemonic = mnemonicResult?.value || null;
    } catch (error) {
      logger.warn('Failed to get mnemonic from secure storage', error);
      mnemonic = null;
    }
    
    try {
      const userIdResult = await SecureStoragePlugin.get({ key: 'user-id' });
      userId = userIdResult?.value || null;
    } catch (error) {
      logger.warn('Failed to get userId from secure storage', error);
      userId = null;
    }
    
    if (!mnemonic || !userId) {
      // New user - show language selector first
      await clearAuthState();
      // Detect and set initial language
      localeStore.detectLocale();
      selectedLanguage.value = localeStore.currentLocale;
      busy.value = false; // Stop busy state so language selector can show
      showLanguageSelector.value = true;
      shouldContinue = false;
      return;
    }

    // 2) Verify JWT consistency - if persisted state has JWT but secure storage doesn't, clear it
    try {
      const { value: jwtInStorage } = await SecureStoragePlugin.get({ key: 'jwt' });
      if (!jwtInStorage && auth.jwt) {
        // JWT exists in persisted state but not in secure storage - clear persisted state
        logger.warn('JWT mismatch detected: clearing persisted auth state');
        auth.jwt = '';
        auth.user = {} as any;
      }
    } catch (error) {
      // No JWT in secure storage - clear persisted state if it exists
      if (auth.jwt) {
        logger.warn('No JWT in secure storage: clearing persisted auth state');
        auth.jwt = '';
        auth.user = {} as any;
      }
    }

    // 3) Double-check we still have credentials and we're still on the splash screen
    if (!shouldContinue || !mnemonic || !userId) {
      logger.warn('Credentials check failed, aborting login');
      return;
    }
    
    // 4) Verify we're still on the splash screen route (not register)
    if (route.path !== '/' && route.path !== '/splash') {
      logger.warn('Route changed during check, aborting login');
      return;
    }

    // 5) Attempt login
    auth.userId = userId;
    await auth.login();
    
    // 6) Double-check route again after async login (route might have changed)
    if (route.path !== '/' && route.path !== '/splash') {
      logger.warn('Route changed during login, aborting redirect');
      return;
    }
    
    // 7) If we get here and have a JWT, fetch contributions and campaigns, then redirect to dashboard
    if (auth.jwt) {
      try {
        // Fetch contributions and campaigns in parallel
        await Promise.all([
          contributionsStore.fetchContributions(),
          campaignsStore.fetchCampaigns()
        ]);
      } catch (error) {
        logger.warn('Failed to fetch contributions or campaigns on splash screen', error);
        // Continue with redirect even if fetch fails
      }
      router.replace('/contributions');
    }
  } catch (error) {
    logger.error('Login check failed', error);
    // Clear auth state on error before showing language selector
    await clearAuthState();
    // Detect and set initial language
    localeStore.detectLocale();
    selectedLanguage.value = localeStore.currentLocale;
    busy.value = false; // Stop busy state so language selector can show
    showLanguageSelector.value = true;
  } finally {
    if (!showLanguageSelector.value) {
      busy.value = false;
    }
  }
}

async function onLanguageSelected() {
  // Set the selected language in locale store
  localeStore.setLocale(selectedLanguage.value);
  // Route to registration page
  router.replace('/register');
}

onMounted(async () => {
  // try {
  //   // Hide the native splash screen immediately
  //   // await SplashScreen.hide();
  // } catch (error) {
  //   console.warn('Could not hide native splash screen:', error);
  // }
  checkAndLogin();

});
</script>

<style lang="scss" scoped>
.splash-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Primary app color #fff000 (RGB: 255, 240, 0) */
  background-color: #fff000;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
  animation: fadeIn 0.3s ease-in-out;
  overflow: visible;
}

.logo-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  overflow: visible;
}

.application-logo-container {
  position: relative;
  width: 130px;
  height: 112px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.application-logo {
  width: 200px;
  height: auto;
  opacity: 0;
  animation: fadeIn 1s ease-in-out forwards;
  animation-delay: 0.5s;
  position: absolute;
  top: -100px;
}

.status-message {
  position: absolute;
  bottom: -6rem;
  left: 50%;
  transform: translateX(-50%);
  color: $accent;
  text-align: center;
  opacity: 0;
  animation: fadeIn 0.5s ease-in-out forwards;
  width: 250px;
  text-transform: uppercase;
  animation-delay: 2s;
}

.language-selector-container {
  position: absolute;
  bottom: -10rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 1;
  width: 100%;
  max-width: 300px;
  padding: 0 1rem;
  z-index: 1000;
}

.language-select {
  background: white;
  border-radius: 4px;
}

.continue-btn {
  text-transform: uppercase;
  font-weight: bold;
  letter-spacing: 1px;
}

:deep(.language-select-popup) {
  z-index: 10000 !important;
}
</style> 


