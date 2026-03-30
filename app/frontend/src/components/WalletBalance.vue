<template>
  <div class="balance-card bg-yellow-4 rounded-borders text-black row items-center justify-between">
    <div class="row items-center q-gutter-sm">
      <div class="column">
        <div class="balance-label text-grey-7">{{ $t('yourBalance') }}</div>
        <div class="balance-amount text-weight-bold">
          <q-spinner-dots v-if="isLoading" size="16px" color="black" class="q-mr-xs" />
          <template v-else>
            {{ formatBalance(walletBalance) }} {{ $t('hrTokens') }}
          </template>
        </div>
      </div>
    </div>
    <q-btn 
      v-if="!isLoading"
      class="active-button text-black text-weight-bold"
      flat
      icon="account_balance_wallet"
      @click="$emit('open-wallet')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useTokenStore } from '../stores/token';
import { useAuthStore } from '../stores/auth';
import { useBlockchainStore } from '../stores/blockchain';
import { logger } from '../utils/logger';

defineEmits<{
  'open-wallet': [];
}>();

const tokenStore = useTokenStore();
const auth = useAuthStore();
const blockchainStore = useBlockchainStore();

const walletBalance = computed(() => tokenStore.getUserBalance);
const userBalanceLoading = computed(() => tokenStore.loading.userBalance);
const hasPendingTransactions = computed(() => blockchainStore.hasPendingTransactions);
const isLoading = computed(() => userBalanceLoading.value || hasPendingTransactions.value);

const formatBalance = (balance: number) => {
  return balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

// Fetch user balance when component mounts
onMounted(async () => {
  if (auth.jwt) {
    try {
      await tokenStore.fetchUserBalance();
    } catch (error) {
      logger.error('Failed to fetch user balance', error);
    }
  }
});

</script>

<style lang="scss" scoped>
.balance-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
}

.rounded-borders {
  border-radius: 12px;
}

.icon-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.badge-number {
  position: absolute;
  top: -6px;
  left: -2px;
  font-size: 9px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  z-index: 1;
}

.balance-label {
  font-size: 11px;
  line-height: 1.2;
}

.balance-amount {
  font-size: 14px;
  line-height: 1.3;
  display: flex;
  align-items: center;

  .balance-loading {
    opacity: 0.7;
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

</style>


