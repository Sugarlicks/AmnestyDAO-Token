<template>
  <div :class="['wallet-page', { 'mobile-wallet-page': !$q.screen.gt.sm }]">
    <DesktopWallet
      v-if="$q.screen.gt.sm"
      :user-balance="tokenStore.getUserBalance"
      :treasury-balance="tokenStore.getTreasuryBalance"
      :user-transactions="tokenStore.getUserTransactions"
      :treasury-transactions="tokenStore.getTreasuryTransactions"
      :loading="tokenStore.isLoading"
    />
    <div v-else>
      <MobileWallet
        v-model="showMobileWallet"
        :user-balance="tokenStore.getUserBalance"
        :treasury-balance="tokenStore.getTreasuryBalance"
        :user-transactions="tokenStore.getUserTransactions"
        :treasury-transactions="tokenStore.getTreasuryTransactions"
        :loading="tokenStore.isLoading"
        @refresh="handleRefresh"
        @close="showMobileWallet = false"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DesktopWallet from 'components/DesktopWallet.vue'
import MobileWallet from 'components/MobileWallet.vue'
import { useTokenStore } from 'stores/token'
import { useAuthStore } from 'stores/auth'
import { useBlockchainStore } from 'stores/blockchain'
import { useI18n } from 'vue-i18n'
import { logger } from '../utils/logger'

export default defineComponent({
  name: 'WalletPage',
  components: {
    DesktopWallet,
    MobileWallet
  },
  setup() {
    const $q = useQuasar()
    const tokenStore = useTokenStore()
    const authStore = useAuthStore()
    const blockchainStore = useBlockchainStore()
    const { t } = useI18n()
    const showMobileWallet = ref(true) // Auto-open on mobile
    let previousPendingCount = 0

    const initializeTokenData = async () => {
      try {
        await Promise.all([
          tokenStore.refreshBalances(), // Unified method handles both user and treasury (if admin)
          tokenStore.fetchUserTransactions(),
          tokenStore.fetchTreasuryTransactions()
        ])
      } catch (error) {
        console.error('Failed to initialize token data:', error)
        $q.notify({
          type: 'negative',
          message: t('failedToLoadWalletData')
        })
      }
    }

    const handleRefresh = async () => {
      await initializeTokenData()
    }

    // Watch for pending transactions completing and refresh balance
    watch(
      () => blockchainStore.pendingTxHashes.length,
      (newCount, oldCount) => {
        // If pending count decreased (transaction completed), refresh balance
        if (oldCount !== undefined && newCount < oldCount && newCount === 0) {
          tokenStore.refreshBalances().catch(err => {
            logger.error('Failed to refresh balance after transaction completion', err)
          })
        }
      }
    )

    onMounted(() => {
      if (authStore.jwt) {
        initializeTokenData()
        previousPendingCount = blockchainStore.pendingTxHashes.length
      }
    })

    return {
      tokenStore,
      showMobileWallet,
      handleRefresh
    }
  }
})
</script>

<style lang="scss" scoped>
.wallet-page {
  min-height: 100vh;
  padding: 20px;
}

.mobile-wallet-page {
  padding: 0;
}

// .mobile-wallet-container {
//   width: 100%;
//   height: 100vh;
// }
</style> 