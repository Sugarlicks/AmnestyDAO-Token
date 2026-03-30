<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { versionService } from './services/version';
import { useQuasar } from 'quasar';
import { logger } from './utils/logger';
import { useLocaleStore } from './stores/locale';
import { useAuthStore } from './stores/auth';

const $q = useQuasar();
const localeStore = useLocaleStore();
const authStore = useAuthStore();

defineOptions({
  name: 'App'
});

onMounted(async () => {
  // Initialize locale from user profile or detect from browser
  if (authStore.user && (authStore.user as any).language) {
    localeStore.syncFromUserProfile();
  } else {
    localeStore.detectLocale();
  }

  // Check version
  try {
    const versionInfo = await versionService.checkVersion();
    logger.info('App version checked', { version: versionInfo });
  } catch (error) {
    logger.error('Failed to check version', error);
    $q.notify({
      type: 'warning',
      message: 'Unable to verify app version. Please check your connection.',
      position: 'top'
    });
  }
});
</script>
