<template>
  <q-page class="campaign-details-page">
    <!-- Loading State -->
    <div v-if="loading" class="q-pa-md">
      <q-skeleton height="300px" square class="q-mb-md" />
      <q-skeleton height="100px" class="q-mb-md" />
      <q-skeleton height="200px" />
    </div>

    <!-- Error State -->
    <q-banner v-else-if="error" rounded class="bg-negative text-white q-ma-md">
      {{ error }}
      <template v-slot:action>
        <q-btn flat :label="$t('goBack')" @click="goBack" />
      </template>
    </q-banner>

    <!-- Content -->
    <div v-else-if="campaign">
      <!-- Header -->
      <div class="row items-center q-mb-md">
        <q-btn
          flat
          round
          icon="arrow_back"
          @click="goBack"
          class="q-mr-sm"
        />
        <div class="ls-1">{{ $t('campaignDetails') }}</div>
      </div>

      <!-- Image Section -->
      <div class="campaign-header-image">
        <q-img
          v-if="campaignImageUrl"
          :src="campaignImageUrl"
          :ratio="16/9"
          class="full-width"
        >
          <template v-slot:loading>
            <div class="absolute-full flex flex-center">
              <q-spinner color="white" size="3em" />
            </div>
          </template>
        </q-img>
        <div v-else class="campaign-image-placeholder bg-grey-3 flex flex-center" style="height: 300px;">
          <q-icon name="image" size="64px" color="grey-5" />
        </div>
      </div>

      <!-- Progress Section -->
      <q-card flat class="progress-card q-mx-md q-mt-md">
        <q-card-section class="text-center">
          <div class="row items-center justify-center q-mb-sm">
            <q-icon name="mdi-circle-multiple-outline" size="24px" color="black" class="q-mr-xs"/>
            <span class="text-h6 text-weight-bold">
              {{ campaign.tokensRaised.toLocaleString() }} {{ $t('tokensRaised') }}
            </span>
          </div>
          <q-linear-progress
            :value="progressPercentage"
            color="secondary"
            size="12px"
            rounded
            class="q-mb-sm"
          />
          <div class="row items-center justify-between text-body2 text-grey-7">
            <span>{{ $t('goal') }}: {{ campaign.goalTokens.toLocaleString() }} {{ $t('tokens') }}</span>
            <span>{{ Math.round(progressPercentage * 100) }}%</span>
          </div>
          <div class="row items-center justify-center q-gutter-md q-mt-md">
            <div v-if="campaign.deadline" class="row items-center q-gutter-xs">
              <q-icon name="schedule" size="18px" color="grey-6" />
              <span class="text-body2 text-grey-7">{{ daysRemaining(campaign.deadline) }} {{ $t('daysLeft') }}</span>
            </div>
            <div class="row items-center q-gutter-xs">
              <q-icon name="people" size="18px" color="grey-6" />
              <span class="text-body2 text-grey-7">{{ campaign.supporterCount }} {{ $t('supporters') }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Campaign Details Card -->
      <q-card flat class="details-card q-mx-md q-mt-md">
        <q-card-section>
          <!-- Category Tag -->
          <div v-if="campaign.category" class="row items-center q-mb-md">
            <q-chip
              :label="campaign.category"
              color="warning"
              text-color="black"
              size="sm"
            />
          </div>

          <!-- Title -->
          <div class="text-h6 text-weight-bold q-mb-sm">
            {{ campaign.title }}
          </div>

          <!-- Description -->
          <div class="text-body2 text-grey-7 q-mb-md">
            {{ campaign.description }}
          </div>

          <!-- Full Details -->
          <div v-if="campaign.fullDetails" class="q-mt-lg">
            <div class="ls-1 q-mb-sm">{{ $t('aboutThisCampaign') }}</div>
            <div class="text-body2 text-grey-8">
              {{ campaign.fullDetails }}
            </div>
          </div>

          <!-- Campaign URL -->
          <div v-if="campaign.campaignUrl" class="q-mt-lg">
            <q-btn
              :label="$t('learnMore')"
              color="secondary"
              text-color="white"
              rounded
              icon="open_in_new"
              :href="campaign.campaignUrl"
              target="_blank"
              class="full-width"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Donation Section -->
      <q-card flat class="donation-card q-mx-md q-mt-md">
        <q-card-section>
          <div class="ls-1 q-mb-md">{{ $t('supportCampaign') }}</div>
          <div class="text-body2 text-grey-7 q-mb-md">
            {{ $t('sendTokensToCampaign') }}
          </div>

          <!-- Transaction Status Display -->
          <div v-if="pendingTxHash" class="q-mb-md">
            <q-banner 
              class="bg-primary text-black"
              rounded
            >
              <template v-slot:avatar>
                <q-spinner 
                  size="24px"
                  color="black"
                  class="q-ma-xs"
                />
              </template>
              <div class="text-caption">
                <div>
                  {{ $t('transactionPending') }}
                </div>
                <div v-if="pendingTxHash" class="q-mt-xs">
                  <a 
                    :href="`https://preview.cardanoscan.io/transaction/${pendingTxHash}`" 
                    target="_blank"
                    class="text-primary"
                  >
                    {{ $t('viewOnExplorer') }}: {{ pendingTxHash.substring(0, 16) }}...
                  </a>
                </div>
              </div>
            </q-banner>
          </div>
          <div v-else>
            <!-- Token Amount Input -->
            <div class="q-mb-md">
              <div class="text-subtitle2 q-mb-xs">{{ $t('tokenAmount') }}</div>
              <q-input
                v-model.number="donationAmount"
                :placeholder="$t('enterAmount')"
                filled
                type="number"
                min="0"
                :max="availableBalance"
                :rules="[
                  val => val > 0 || $t('amountMustBeGreaterThanZero'),
                  val => val <= availableBalance || $t('insufficientBalance')
                ]"
              >
                <template v-slot:append>
                  <q-icon name="keyboard_arrow_up" class="cursor-pointer" @click="incrementAmount" />
                  <q-icon name="keyboard_arrow_down" class="cursor-pointer" @click="decrementAmount" />
                </template>
              </q-input>
              <div class="row items-center justify-between q-mt-sm">
                <span class="text-caption text-grey-6">
                  {{ $t('available') }}: {{ availableBalance }} {{ $t('hrTokens') }}
                </span>
                <q-btn
                  unelevated
                  :label="$t('useAll')"
                  color="accent"
                  size="sm"
                  @click="useAllBalance"
                />
              </div>
            </div>

            <!-- Quick Amount Buttons -->
            <div class="row q-gutter-sm q-mb-md">
              <q-btn
                flat
                rounded
                :label="`+10`"
                color="primary"
                class="text-black"
                @click="addAmount(10)"
              />
              <q-btn
                flat
                rounded
                :label="`+50`"
                color="primary"
                class="text-black"
                @click="addAmount(50)"
              />
              <q-btn
                flat
                rounded
                :label="`+100`"
                color="primary"
                class="text-black"
                @click="addAmount(100)"
              />
            </div>

            <!-- Donate Button -->
            <q-btn
              :label="buildingTx ? $t('buildingTransaction') : signingTx ? $t('signingTransaction') : $t('sendTokens')"
              color="primary"
              text-color="black"
              unelevated
              rounded
              class="full-width"
              :loading="donating || buildingTx || signingTx"
              :disable="!donationAmount || donationAmount <= 0 || donationAmount > availableBalance || !!pendingTxHash"
              icon="mdi-circle-multiple-outline"
              @click="handleDonate"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCampaignsStore } from '../stores/campaigns';
import { useTokenStore } from '../stores/token';
import { useBlockchainStore } from '../stores/blockchain';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import config from '../config';

const { t } = useI18n();

defineOptions({
  name: 'CampaignDetails'
});

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const campaignsStore = useCampaignsStore();
const tokenStore = useTokenStore();
const blockchainStore = useBlockchainStore();

const loading = ref(true);
const error = ref<string | null>(null);
const donating = ref(false);
const buildingTx = ref(false);
const signingTx = ref(false);
const campaign = ref<any>(null);
const donationAmount = ref<number | null>(null);
const pendingTxHash = ref<string | null>(null);

const campaignId = computed(() => route.params.id as string);

const campaignImageUrl = computed(() => {
  if (!campaign.value) return null;
  return campaignsStore.getCampaignImageUrl(campaign.value);
});

const progressPercentage = computed(() => {
  if (!campaign.value || campaign.value.goalTokens === 0) return 0;
  return Math.min(campaign.value.tokensRaised / campaign.value.goalTokens, 1);
});

const availableBalance = computed(() => {
  return tokenStore.userBalance || 0;
});

const daysRemaining = (deadline: string): number => {
  if (!deadline) return 0;
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const goBack = () => {
  router.back();
};

const incrementAmount = () => {
  if (!donationAmount.value) {
    donationAmount.value = 1;
  } else {
    donationAmount.value = Math.min(donationAmount.value + 1, availableBalance.value);
  }
};

const decrementAmount = () => {
  if (donationAmount.value && donationAmount.value > 0) {
    donationAmount.value = Math.max(donationAmount.value - 1, 0);
  }
};

const addAmount = (amount: number) => {
  const current = donationAmount.value || 0;
  donationAmount.value = Math.min(current + amount, availableBalance.value);
};

const useAllBalance = () => {
  donationAmount.value = availableBalance.value;
};

const handleDonate = async () => {
  if (!campaign.value || !donationAmount.value || donationAmount.value <= 0) {
    return;
  }

  if (donationAmount.value > availableBalance.value) {
    $q.notify({
      type: 'negative',
      message: t('insufficientBalance'),
      position: 'top'
    });
    return;
  }

  donating.value = true;
  buildingTx.value = true;
  pendingTxHash.value = null;

  try {
    // Build and sign transaction on frontend, then send to backend
    const donation = await campaignsStore.donateToCampaign(
      campaign.value.id, 
      donationAmount.value,
      (stage) => {
        if (stage === 'building') {
          buildingTx.value = true;
          signingTx.value = false;
        } else if (stage === 'signing') {
          buildingTx.value = false;
          signingTx.value = true;
        } else {
          buildingTx.value = false;
          signingTx.value = false;
        }
      }
    );
    
    // Track transaction hash (confirmation handled asynchronously by blockchain store)
    if (donation.txHash) {
      pendingTxHash.value = donation.txHash;
      
      // Check periodically if transaction is still pending (removed from array when confirmed)
      const checkInterval = setInterval(() => {
        if (!blockchainStore.pendingTxHashes.includes(donation.txHash)) {
          // Transaction confirmed or failed - clear pending hash
          pendingTxHash.value = null;
          clearInterval(checkInterval);
          // Refresh balance and campaign
          tokenStore.fetchUserBalance();
          loadCampaign();
        }
      }, 2000);
      
      // Stop checking after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        // If still pending after 5 minutes, clear it anyway
        if (pendingTxHash.value === donation.txHash) {
          pendingTxHash.value = null;
        }
      }, 300000);
    }
    
    // Refresh token balance
    await tokenStore.fetchUserBalance();
    
    $q.notify({
      type: 'positive',
      message: t('donationSuccessful'),
      position: 'top',
      timeout: 3000
    });

    // Reset donation amount
    donationAmount.value = null;

    // Refresh the campaign data
    await loadCampaign();
  } catch (err: any) {
    console.error('Failed to donate to campaign:', err);
    pendingTxHash.value = null;
    $q.notify({
      type: 'negative',
      message: err.message || t('failedToDonate'),
      position: 'top'
    });
  } finally {
    donating.value = false;
    buildingTx.value = false;
    signingTx.value = false;
  }
};

const loadCampaign = async () => {
  // Performance monitoring: Campaign details load
  const loadStart = performance.now();
  const loadPerfId = `CampaignDetails-load-${campaignId.value}-${Date.now()}`;
  performance.mark(`${loadPerfId}-start`);
  console.log(`[PERF] CampaignDetails: Loading campaign ${campaignId.value}`);

  loading.value = true;
  error.value = null;
  
  try {
    const data = await campaignsStore.fetchCampaignById(campaignId.value);
    campaign.value = data;
    
    const loadTime = performance.now() - loadStart;
    performance.mark(`${loadPerfId}-end`);
    performance.measure(`${loadPerfId}-total`, `${loadPerfId}-start`, `${loadPerfId}-end`);
    console.log(`[PERF] CampaignDetails: Campaign loaded in ${loadTime.toFixed(2)}ms`);
  } catch (err: any) {
    const loadTime = performance.now() - loadStart;
    console.error(`[PERF] CampaignDetails: FAILED after ${loadTime.toFixed(2)}ms`);
    console.error('Failed to load campaign:', err);
    error.value = err.message || t('failedToLoadCampaign');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  // Performance monitoring: Page mount
  const pageStart = performance.now();
  const pagePerfId = `CampaignDetails-mount-${Date.now()}`;
  performance.mark(`${pagePerfId}-start`);
  console.log(`[PERF] CampaignDetails: Page mount started`);

  await loadCampaign();
  
  // Fetch user balance if not already loaded
  const balanceStart = performance.now();
  if (tokenStore.userBalance === 0) {
    await tokenStore.fetchUserBalance();
    const balanceTime = performance.now() - balanceStart;
    console.log(`[PERF] CampaignDetails: Balance fetch took ${balanceTime.toFixed(2)}ms`);
  }
  
  const pageTotalTime = performance.now() - pageStart;
  performance.mark(`${pagePerfId}-end`);
  performance.measure(`${pagePerfId}-total`, `${pagePerfId}-start`, `${pagePerfId}-end`);
  console.log(`[PERF] CampaignDetails: Page ready in ${pageTotalTime.toFixed(2)}ms`);
});
</script>

<style scoped lang="scss">
.campaign-details-page {
  background-color: #f5f5f5 !important;
  min-height: 100vh;
}

.campaign-header-image {
  width: 100%;
  overflow: hidden;
}

.progress-card {
  background-color: white;
  border-radius: 12px;
}

.details-card {
  background-color: white;
  border-radius: 12px;
}

.donation-card {
  background-color: white;
  border-radius: 12px;
}

.campaign-image-placeholder {
  width: 100%;
}
</style>

<style lang="scss">
.q-page-container {
  background-color: #f5f5f5 !important;
}
</style>

