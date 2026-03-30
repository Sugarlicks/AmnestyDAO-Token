<template>
  <q-dialog
    v-model="isOpen"
    position="bottom"
    transition-show="slide-up"
    transition-hide="slide-down"
    :persistent="false"
    @hide="$emit('close')"
  >
    <q-card class="transaction-history-card">
      <!-- Header -->
      <q-card-section class="card-header">
        <div class="text-h6 text-weight-bold">{{ $t('transactionHistory') }}</div>
      </q-card-section>

      <!-- Balance Summary Section -->
      <q-card-section class="balance-summary-section">
        <div class="balance-header">
          <div class="balance-label">{{ $t('currentBalance') }}</div>
          <div class="balance-amount-row">
            <q-spinner v-if="hasPendingTransactions" color="primary" size="20px" class="q-mr-xs" />
            <span v-if="hasPendingTransactions" class="balance-amount balance-loading">...</span>
            <span v-else class="balance-amount">{{ formatTokenBalance(userBalance) }}</span> <span class="text-caption">{{ $t('hrTokens') }}</span>
            <q-icon name="cached" class="refresh-icon" @click="refreshBalance" />
          </div>
        </div>
        
        <div class="balance-stats">
          <div class="stat-box earned-box">
            <div class="stat-label">{{ $t('totalEarned') }}</div>
            <div class="stat-value positive">+{{ formatTokenBalance(totalEarned) }}</div>
          </div>
          <div class="stat-box sent-box">
            <div class="stat-label">{{ $t('totalSent') }}</div>
            <div class="stat-value negative">-{{ formatTokenBalance(totalSent) }}</div>
          </div>
        </div>
      </q-card-section>

      <!-- Transaction List -->
      <q-card-section class="transaction-list-section">
        <div v-if="loading" class="text-center q-pa-md">
          <q-spinner color="primary" size="2em" />
          <div class="q-mt-sm text-grey-6">{{ $t('loadingTransactions') }}</div>
        </div>
        <div v-else class="transaction-list">
          <div
            v-for="transaction in userTransactions"
            :key="transaction.id"
            class="transaction-item"
          >
            <div 
              class="transaction-icon"
              :class="{ 
                'icon-positive': isPositiveAmount(transaction), 
                'icon-negative': !isPositiveAmount(transaction),
                'icon-rotate-incoming': isPositiveAmount(transaction),
                'icon-rotate-outgoing': !isPositiveAmount(transaction)
              }"
            >
              <q-icon 
                :name="isPositiveAmount(transaction) ? 'arrow_downward' : 'arrow_upward'" 
                size="20px" 
                :color="isPositiveAmount(transaction) ? 'green' : 'red'"
              />
            </div>
            <div class="transaction-content">
              <div class="transaction-title">{{ getTransactionTitle(transaction, 'user', t) }}</div>
              <div class="transaction-subtitle">{{ getTransactionSubtitle(transaction, t) }}</div>
            </div>
            <div class="transaction-right">
              <div 
                class="transaction-amount"
                :class="{ 'amount-positive': isPositiveAmount(transaction), 'amount-negative': !isPositiveAmount(transaction) }"
              >
                {{ isPositiveAmount(transaction) ? '+' : '-' }}{{ formatTokenBalance(Math.abs(transaction.amount)) }}
              </div>
              <div class="transaction-time">{{ formatTransactionTime(transaction.timestamp, t) }}</div>
            </div>
          </div>
          
          <div v-if="userTransactions.length === 0" class="no-transactions">
            <div class="text-grey-6">{{ $t('noTransactionsYet') }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useBlockchainStore } from '../stores/blockchain'
import { useI18n } from 'vue-i18n'
import {
  isPositiveTransaction,
  formatTokenBalance,
  formatTransactionTime,
  getTransactionTitle,
  getTransactionSubtitle
} from '../utils/transactionUtils'
import type { TokenTransaction } from '../stores/token'

export default defineComponent({
  name: 'MobileWallet',
  props: {
    modelValue: {
      type: Boolean,
      default: true
    },
    userBalance: {
      type: Number,
      required: true
    },
    treasuryBalance: {
      type: Number,
      required: true
    },
    userTransactions: {
      type: Array as () => TokenTransaction[],
      required: true
    },
    treasuryTransactions: {
      type: Array as () => TokenTransaction[],
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'close', 'refresh'],
  setup(props, { emit, expose }) {
    const { t } = useI18n();
    const blockchainStore = useBlockchainStore();
    const hasPendingTransactions = computed(() => blockchainStore.hasPendingTransactions);
    
    const isOpen = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })

    // Calculate total earned (positive transactions)
    const totalEarned = computed(() => {
      return props.userTransactions
        .filter(t => isPositiveTransaction(t, 'user'))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    })

    // Calculate total sent (negative transactions)
    const totalSent = computed(() => {
      return props.userTransactions
        .filter(t => !isPositiveTransaction(t, 'user'))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    })

    const isPositiveAmount = (transaction: TokenTransaction): boolean => {
      return isPositiveTransaction(transaction, 'user');
    }

    const refreshBalance = () => {
      // Emit event to parent to refresh balance
      emit('refresh')
    }

    // Expose open/close methods
    expose({
      open: () => emit('update:modelValue', true),
      close: () => emit('update:modelValue', false)
    })

    return {
      isOpen,
      totalEarned,
      totalSent,
      isPositiveAmount,
      formatTokenBalance,
      getTransactionTitle,
      getTransactionSubtitle,
      formatTransactionTime,
      refreshBalance,
      hasPendingTransactions,
      t
    }
  }
})
</script>

<style lang="scss" scoped>
.transaction-history-card {
  border-radius: 24px 24px 0 0;
  max-height: 80vh;
  height: 80vh;
  display: flex;
  flex-direction: column;
  background: white;
}

.card-header {
  padding: 24px 20px 16px 20px;
  border-bottom: none;
  
  .text-h6 {
    font-size: 1.25rem;
    font-weight: bold;
    color: #000;
  }
}

.balance-summary-section {
  background: #FFF9C4; // Light yellow - matches image
  border-radius: 16px;
  margin: 0 16px 16px 16px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.balance-label {
  font-size: 0.875rem;
  color: #000;
  font-weight: 500;
}

.balance-amount-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-icon {
  font-size: 20px;
  color: #000;
  cursor: pointer;
  transition: transform 0.3s ease;
  
  &:hover {
    transform: rotate(180deg);
  }
}

.balance-amount {
  font-size: 1rem;
  font-weight: 600;
  color: #000;

  &.balance-loading {
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

.balance-stats {
  display: flex;
  gap: 12px;
}

.stat-box {
  flex: 1;
  background: white;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.75rem;
  color: #000;
  font-weight: 500;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  
  &.positive {
    color: #21BA45; // Green
  }
  
  &.negative {
    color: #C10015; // Red
  }
}

.transaction-list-section {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px 16px;
  min-height: 0;
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.transaction-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
}

.transaction-icon {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  &.icon-positive {
    background: #dfffe0; // Light green circle - matches image
  }
  
  &.icon-negative {
    background: #ffe7e7; // Red circle - matches image
  }
  
  &.icon-rotate-incoming {
    .q-icon {
      transform: rotate(45deg); // Rotate to point down-left
    }
  }
  
  &.icon-rotate-outgoing {
    .q-icon {
      transform: rotate(45deg); // Rotate to point up-right
    }
  }
  
  .q-icon {
    font-size: 20px;
  }
}

.transaction-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0; // Allow text truncation
}

.transaction-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #000;
  line-height: 1.3;
}

.transaction-subtitle {
  font-size: 0.75rem;
  color: #757575;
  line-height: 1.4;
}

.transaction-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.transaction-amount {
  font-size: 0.875rem;
  font-weight: 600;
  
  &.amount-positive {
    color: #21BA45; // Green
  }
  
  &.amount-negative {
    color: #C10015; // Red
  }
}

.transaction-time {
  font-size: 0.75rem;
  color: #757575;
}

.no-transactions {
  padding: 40px 20px;
  text-align: center;
  color: #9E9E9E;
}

// Handle scrollbar styling
.transaction-list-section {
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #BDBDBD;
    border-radius: 2px;
  }
}
</style>
