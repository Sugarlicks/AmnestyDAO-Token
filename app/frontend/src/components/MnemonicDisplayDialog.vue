<template>
  <q-dialog :model-value="modelValue" @update:model-value="updateModelValue" :maximized="isMobile">
    <q-card :style="isMobile ? '' : 'min-width: 420px'" style="background: #f9f9f9;">
      <!-- Title -->
      <q-card-section class="q-pb-none group-options">
        <div class="row items-center no-wrap">
          <q-avatar class="title-icon" size="34px">
            <img src="iconLogo" alt="HRDAO" />
          </q-avatar>
          <div class="q-ml-sm text-h6 dialog-title">{{ $t('secureYourWallet') }}</div>
        </div>
      </q-card-section>

      <q-card-section>
        <!-- Warning Panel -->
        <div class="warning-panel q-pa-md q-mb-lg">
          <div class="row items-start">
            <q-icon name="warning_amber" size="24px" color="negative" class="q-mr-sm" />
            <div>
              <div class="text-weight-bold q-mb-sm">{{ $t('seedWarningHeading') }}</div>
              <ul class="q-mt-sm q-mb-none">
                <li>{{ $t('seedWarningNeverShare') }}</li>
                <li>{{ $t('seedWarningNeverAsk') }}</li>
                <li>{{ $t('seedWarningStoreOffline') }}</li>
                <li>{{ $t('seedWarningCannotRecover') }}</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Wallet Address -->
        <div class="q-mb-md group-options">
          <div class="row items-center q-mb-sm">
            <div class="q-mr-sm">
              <q-avatar color="yellow-3" text-color="black" size="44px">
                <q-icon name="shield" />
              </q-avatar>
            </div>
            <div class="text-weight-bold">{{ $t('yourWalletAddress') }}</div>
          </div>
          <div class="address-box">{{ walletAddress }}</div>
        </div>

        <!-- Seed Phrase -->
        <div class="q-mt-lg group-options">
          <div class="text-weight-bold q-mb-sm">{{ $t('recoverySeedPhrase') }}</div>
          <div class="seed-grid">
            <div v-for="(word, idx) in mnemonicWords" :key="idx" class="seed-word">
              <span class="seed-index">{{ idx + 1 }}</span>
              <span class="seed-text">{{ word }}</span>
            </div>
          </div>
          <div class="note-panel q-mt-md">{{ $t('seedNoteWriteOnPaper') }}</div>
        </div>
        
        <!-- Acknowledge Saved -->
        <div class="q-mt-lg group-options">
          <q-checkbox
            v-model="acknowledged"
            size="sm"
            class="ack-checkbox"
            :label="$t('seedAcknowledgeText')"
          />
        </div>
        
      </q-card-section>

      <q-card-actions align="right" class="q-pt-none q-px-md q-pb-md">
        <q-btn 
          unelevated
          :label="$t('continueToApp')"
          :disable="!acknowledged"
          :style="acknowledged ? 'background: #FFFF00; color: #000; font-weight: 700;' : 'background: #e0e0e0; color: #666; font-weight: 700;'"
          class="full-width"
          @click="handleContinue"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import iconLogo from '../assets/icon-logo.svg';

defineOptions({
  name: 'MnemonicDisplayDialog'
});

interface Props {
  modelValue: boolean;
  walletAddress: string;
  mnemonicWords: string[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'saved': [];
}>();

const $q = useQuasar();
const isMobile = computed(() => $q.screen.lt.md);

// acknowledgement for seed phrase safety
const acknowledged = ref(false);

const updateModelValue = (value: boolean) => {
  emit('update:modelValue', value);
};

const handleContinue = () => {
  if (acknowledged.value) {
    emit('saved');
    updateModelValue(false);
  }
};
</script>

<style lang="scss" scoped>
.dialog-title {
  font-weight: 800;
}

.title-icon {
  background: #FFFF00;
  border-radius: 8px;
}

.warning-panel {
  border: 2px solid #ff5a8b; /* pink/red border similar to screenshot */
  background: #ffe8f0;       /* very light pink background */
  border-radius: 16px;
}

.note-panel {
  background: #ffffe6; /* soft yellow */
  border: 1px solid #f1efb3;
  color: #4a5568;
  border-radius: 12px;
  padding: 12px 14px;
}

.address-box {
  background: #f5f7fa;
  border-radius: 10px;
  padding: 12px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  word-break: break-all;
}

.seed-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: 8px;
  margin-left: -5px;
}

@media (min-width: 600px) {
  .seed-grid { grid-template-columns: repeat(3, 1fr); }
}

.seed-word {
  display: flex;
  align-items: center;
  background: #fafafa;
  border: 1px solid #e6e6e6;
  border-radius: 10px;
  padding: 10px 12px;
}

.seed-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #000;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  margin-right: 8px;
}

.seed-text {
  font-weight: 600;
}

.group-options {
  background: white;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  padding: 10px;
}
</style>

