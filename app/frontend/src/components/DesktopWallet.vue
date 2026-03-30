<template>
  <div class="wallet-container">
    <div class="balance-cards">
      <!-- User Token Balance Card -->
      <q-card 
        class="wallet-card user-balance-card" 
        :class="{ 'active': activeCard === 'user' }"
        @click="setActiveCard('user')"
      >
        <q-card-section>
          <div class="custom-header">{{ $t('yourTokenBalance') }}</div>
          <div class="balance-display">
            <div class="balance-number">
              <q-spinner v-if="hasPendingTransactions" color="primary" size="24px" class="q-mr-sm" />
              <span v-if="hasPendingTransactions" class="text-h3 balance-loading">...</span>
              <template v-else>
                <span class="text-h3">{{ formatNumber(userBalance).whole }}</span>
                <span class="decimal">.{{ formatNumber(userBalance).decimal }}</span>
              </template>
            </div>
            <span class="token-label">{{ $t('tokens') }}</span>
          </div>
        </q-card-section>
      </q-card>

      <!-- Community Treasury Card -->
      <q-card 
        class="wallet-card treasury-card"
        :class="{ 'active': activeCard === 'treasury' }"
        @click="setActiveCard('treasury')"
      >
        <q-card-section>
          <div class="custom-header">{{ $t('communityTreasury') }}</div>
          <div class="balance-display">
            <div class="balance-number">
              <span class="text-h3">{{ formatNumber(treasuryBalance).whole }}</span>
              <span class="decimal">.{{ formatNumber(treasuryBalance).decimal }}</span>
            </div>
            <span class="token-label">{{ $t('tokens') }}</span>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Transaction Cards -->
    <div class="transaction-cards">
      <!-- User Transactions -->
      <div v-show="activeCard === 'user'" class="transaction-section">
        <div class="label-title">{{ $t('yourTransactions') }}</div>
        <div v-if="loading" class="text-center q-pa-md">
          <q-spinner color="primary" size="3em" />
          <div class="q-mt-md">{{ $t('loadingTransactions') }}</div>
        </div>
        <div v-else-if="userTransactions.length === 0" class="text-center q-pa-md text-grey-6">
          {{ $t('noTransactionsFound') }}
        </div>
        <div v-else class="transaction-list">
          <q-card 
            v-for="transaction in userTransactions" 
            :key="transaction.id"
            class="transaction-item-card"
            :class="{ 'received': isPositiveAmount(transaction), 'sent': !isPositiveAmount(transaction) }"
          >
            <q-card-section>
              <div class="transaction-content">
                <div class="content-item description">{{ transaction.description }}</div>
                <div class="content-item amount" :class="isPositiveAmount(transaction) ? 'text-info' : 'text-negative'">
                  {{ isPositiveAmount(transaction) ? '+' : '' }}{{ Math.abs(transaction.amount) }}
                </div>
                <div class="content-item icon">
                  <q-icon 
                    :name="isPositiveAmount(transaction) ? 'arrow_circle_down' : 'arrow_circle_up'"
                    :color="isPositiveAmount(transaction) ? 'info' : 'negative'"
                    size="24px"
                  />
                </div>
              </div>
              <div class="transaction-content">
                <div class="transaction-sublabel">{{ formatDate(transaction.timestamp) }}</div>
                <div class="transaction-sublabel text-end justify-end">{{ $t('tkns') }}</div>
                <div class="transaction-sublabel text-end justify-end">{{ isPositiveAmount(transaction) ? $t('received') : $t('sent') }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Treasury Transactions -->
      <div v-show="activeCard === 'treasury'" class="transaction-section">
        <div class="label-title">{{ $t('treasuryTransactions') }}</div>
        <div class="transaction-list">
          <q-card 
            v-for="transaction in treasuryTransactions" 
            :key="transaction.id"
            class="transaction-item-card"
            :class="{ 'received': isPositiveAmount(transaction), 'sent': !isPositiveAmount(transaction) }"
          >
            <q-card-section>
              <div class="transaction-content">
                <div class="content-item description">{{ transaction.description }}</div>
                <div class="content-item amount" :class="isPositiveAmount(transaction) ? 'text-info' : 'text-negative'">
                  {{ isPositiveAmount(transaction) ? '+' : '' }}{{ Math.abs(transaction.amount) }}
                </div>
                <div class="content-item icon">
                  <q-icon 
                    :name="isPositiveAmount(transaction) ? 'arrow_circle_down' : 'arrow_circle_up'"
                    :color="isPositiveAmount(transaction) ? 'info' : 'negative'"
                    size="24px"
                  />
                </div>
              </div>
              <div class="transaction-content">
                <div class="transaction-sublabel">{{ formatDate(transaction.timestamp) }}</div>
                <div class="transaction-sublabel text-end justify-end">{{ $t('tkns') }}</div>
                <div class="transaction-sublabel text-end justify-end">{{ isPositiveAmount(transaction) ? $t('received') : $t('sent') }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue'
import { useBlockchainStore } from '../stores/blockchain'
import { useI18n } from 'vue-i18n'
import { isPositiveTransaction, formatTransactionTime } from '../utils/transactionUtils'
import type { TokenTransaction } from '../stores/token'

export default defineComponent({
  name: 'DesktopWallet',
  props: {
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
  setup() {
    const { t } = useI18n();
    const blockchainStore = useBlockchainStore();
    const activeCard = ref('user') // Default to user card being active
    const hasPendingTransactions = computed(() => blockchainStore.hasPendingTransactions);

    const setActiveCard = (card: string) => {
      activeCard.value = card
    }

    const formatNumber = (num: number) => {
      const [whole, decimal] = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).split('.');
      return { whole, decimal };
    }

    const formatDate = (timestamp: string) => {
      return formatTransactionTime(timestamp, t);
    }

    const isPositiveAmount = (transaction: TokenTransaction): boolean => {
      // Use context-aware function: 'user' for user transactions, 'treasury' for treasury transactions
      const context = activeCard.value === 'user' ? 'user' : 'treasury';
      return isPositiveTransaction(transaction, context);
    }

    return {
      formatNumber,
      formatDate,
      activeCard,
      setActiveCard,
      isPositiveAmount,
      hasPendingTransactions
    }
  }
})
</script>

<style lang="scss" scoped>
.wallet-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.balance-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;

  .wallet-card {
    flex: 1;
    min-width: 280px;
    max-width: 400px;
  }
}

.transaction-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.transaction-section {
  width: 100%;

  .label-title {
    font-size: 1.2rem;
    font-weight: 500;
    margin-bottom: 16px;
    color: var(--q-primary);
  }
}

.wallet-card {
  height: 100%;
  border-radius: 16px !important;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
  cursor: pointer;
  transition: all 0.3s ease;
  
  .text-h3 {
    font-weight: bold;
  }

  .q-card-section {
    padding: 20px;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15) !important;
  }

  &.active {
    transform: translateY(-8px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25) !important;
    
    &::after {
      opacity: 0.4;
    }

    .custom-header {
      transform: scale(1.05);
      transition: transform 0.3s ease;
    }

    .balance-number {
      transform: scale(1.05);
      transition: transform 0.3s ease;
    }
  }
}

.user-balance-card {
  background: var(--q-secondary);
  color: white;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, transparent 0%, rgba(0, 0, 0, 0.2) 100%);
  }

  &.active {
    box-shadow: 0 12px 24px rgba(38, 166, 154, 0.3) !important;
  }
}

.treasury-card {
  background: var(--q-accent);
  color: white;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, transparent 0%, rgba(0, 0, 0, 0.2) 100%);
  }

  &.active {
    box-shadow: 0 12px 24px rgba(38, 166, 154, 0.3) !important;
  }
}

.transaction-item-card {
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
  transition: all 0.3s ease;
  height: 100px;
  max-width: 815px;

  &.received {
    border-left: 4px solid var(--q-info);
  }

  &.sent {
    border-right: 4px solid var(--q-negative);
  }

  .transaction-content {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 8px;
    align-items: center;
    height: 48px;
  }

  .header-item, .content-item {
    padding: 2px;
  }

  .content-item {
    &.description {
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    &.amount {
      font-size: 1.1rem;
      font-weight: 600;
      text-align: right;
    }

    &.icon {
      display: flex;
      justify-content: end;
      align-items: end;
    }
  }

  .transaction-date {
    margin-top: 4px;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .q-card__section {
    padding: 0px 12px;
  }
}

.balance-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 16px;

  .token-label {
    font-size: 1rem;
    opacity: 0.9;
  }
}

.text-positive {
  color: $positive;
}

.text-negative {
  color: $negative;
}

.balance-number {
  display: flex;
  align-items: flex-start;
  line-height: 1;

  .decimal {
    font-size: 1.5em;
    margin-top: 0.3em;
    opacity: 0.9;
  }

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

.user-transaction-card {
  border: 2px solid var(--q-secondary);
  .custom-header {
    color: var(--q-secondary);
  }
}

.treasury-transaction-card {
  border: 2px solid var(--q-accent);
  .custom-header {
    color: var(--q-accent);
  }
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.text-end {
  text-align: end;
}
</style> 