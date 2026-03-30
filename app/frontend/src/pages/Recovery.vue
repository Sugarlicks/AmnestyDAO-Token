<template>
  <q-page padding>
    <q-card class="my-card">
      <q-card-section>
        <h6>{{ $t('recoverFromSeedPhrase') }}</h6>
        <q-input
          v-model="mnemonicIn"
          :label="$t('enterYour12WordPhrase')"
          type="textarea"
          autogrow
          class="q-mb-md"
        />
        <q-btn
          :label="$t('recover')"
          color="primary"
          :loading="loading"
          @click="doRecover"
          class="full-width"
        />
      </q-card-section>

      <q-card-section v-if="error">
        <q-banner type="negative">{{ error }}</q-banner>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineOptions({
  name: 'RecoveryPage'
});

const auth = useAuthStore();
const router = useRouter();
const mnemonicIn = ref('');
const loading = ref(false);
const error = ref('');

async function doRecover() {
  loading.value = true;
  error.value = '';
  try {
    // await auth.recoverFromMnemonic(mnemonicIn.value.trim());
    router.push('/login');
  } catch (err) {
    console.error(err);
    error.value = t('recoveryFailed');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.my-card {
  max-width: 400px;
  margin: 2rem auto;
}
</style> 