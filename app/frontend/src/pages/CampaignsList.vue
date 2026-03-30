<template>
  <q-page class="campaigns-page">
    <!-- Header Section -->
    <div class="q-pa-md">
      <div class="ls-1 q-mb-sm">{{ $t('campaigns') }}</div>
      <p class="text-caption text-grey-7 q-mb-md">
        {{ $t('sendTokensToCampaign') }}
      </p>

      <!-- Metric Cards -->
      <div class="row q-col-gutter-md q-mb-sm">
        <div class="col-6">
          <q-card class="metric-card" flat>
            <q-card-section class="q-pa-md" style="height: 120px;">
              <div class="row items-center justify-between">
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ $t('campaignsSupported') }}</div>
                  <div class="text-h4 text-weight-bold">{{ campaignsSupported }}</div>
                </div>
                <div class="metric-icon">
                  <q-avatar size="30px" color="yellow-5" class="text-yellow-5">
                    <q-icon name="gps_fixed" size="20px" color="black"/>
                  </q-avatar>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-6">
          <q-card class="metric-card" flat>
            <q-card-section class="q-pa-md" style="height: 120px;">
              <div class="row items-center justify-between">
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ $t('tokensDonated') }}</div>
                  <div class="text-h4 text-weight-bold">{{ totalDonated }}</div>
                </div>  
                <div class="metric-icon">
                  <q-avatar size="30px" color="yellow-5" class="text-yellow-5">
                    <q-icon name="mdi-circle-multiple-outline" size="20px" color="black"/>
                  </q-avatar>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Available Campaigns Section -->
    <div class="q-px-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="ls-1">{{ $t('availableCampaigns') }}</div>
        <q-btn
          v-if="isAdmin"
          flat
          round
          icon="edit"
          color="grey-7"
          size="sm"
          @click="goToManageCampaigns"
        >
          <q-tooltip>{{ $t('manageCampaigns') }}</q-tooltip>
        </q-btn>
      </div>

      <!-- Loading State -->
      <div v-if="campaignsStore.loading" class="row q-col-gutter-md">
        <div v-for="n in 3" :key="n" class="col-12">
          <q-card flat bordered>
            <q-skeleton height="200px" square />
            <q-card-section>
              <q-skeleton type="text" class="text-subtitle2" />
              <q-skeleton type="text" width="60%" class="text-subtitle2" />
              <q-skeleton type="rect" width="120px" height="32px" class="q-mt-md" />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Error State -->
      <q-banner v-else-if="campaignsStore.error" rounded class="bg-negative text-white q-mb-md">
        {{ campaignsStore.error }}
      </q-banner>

      <!-- Campaigns List -->
      <div v-else class="row q-col-gutter-md">
        <div
          v-for="campaign in campaignsStore.activeCampaigns"
          :key="campaign.id"
          class="col-12"
        >
          <q-card
            class="campaign-card cursor-pointer"
            flat
            bordered
            @click="viewCampaign(campaign.id)"
          >
            <!-- Image Section -->
            <q-img
              v-if="getImageUrl(campaign)"
              :src="getImageUrl(campaign)"
              :ratio="16/9"
              class="campaign-image"
            >
              <template v-slot:loading>
                <div class="absolute-full flex flex-center">
                  <q-spinner color="primary" size="3em" />
                </div>
              </template>
              <template v-slot:error>
                <div class="absolute-full flex flex-center bg-grey-3">
                  <q-icon name="image" size="48px" color="grey-5" />
                </div>
              </template>
              <!-- Category Badge -->
              <span v-if="campaign.category" class="absolute-top-left q-ma-xs">
                <q-chip
                  :label="campaign.category"
                  color="accent"
                  text-color="white"
                  size="sm"
                />
              </span>
              <!-- Active Badge -->
              <span class="absolute-top-right q-ma-xs">
                <q-chip
                  :label="$t('active')"
                  color="primary"
                  text-color="black"
                  size="sm"
                />
              </span>
            </q-img>
            <div v-else class="campaign-image-placeholder bg-grey-3 flex flex-center">
              <q-icon name="image" size="48px" color="grey-5" />
            </div>

            <q-card-section>
              <!-- Title and Description -->
              <div class="text-h6 q-mb-sm">{{ campaign.title }}</div>
              <div class="text-body2 text-grey-7 q-mb-md">
                {{ campaign.description }}
              </div>

              <!-- Progress Section -->
              <div class="q-mb-md">
                <div class="row items-center justify-between q-mb-xs">
                  <div class="row items-center q-gutter-xs">
                    <q-icon name="mdi-circle-multiple-outline" size="20px" color="black" />
                    <span class="text-body2 text-weight-medium">
                      {{ campaign.tokensRaised.toLocaleString() }} {{ $t('hrTokens') }}
                    </span>
                  </div>
                  <span class="text-body2 text-weight-medium">
                    {{ Math.round((campaign.tokensRaised / campaign.goalTokens) * 100) }}%
                  </span>
                </div>
                <q-linear-progress
                  :value="campaign.goalTokens > 0 ? campaign.tokensRaised / campaign.goalTokens : 0"
                  color="secondary"
                  size="8px"
                  rounded
                  class="q-mb-xs"
                />
                <div class="row items-center justify-between text-caption text-grey-6">
                  <span>{{ $t('goal') }}: {{ campaign.goalTokens.toLocaleString() }} {{ $t('tokens') }}</span>
                  <span v-if="campaign.deadline" class="row items-center q-gutter-xs">
                    <q-icon name="schedule" size="14px" />
                    <span>{{ daysRemaining(campaign.deadline) }} {{ $t('daysLeft') }}</span>
                  </span>
                </div>
                <div class="row items-center q-gutter-xs q-mt-xs">
                  <q-icon name="people" size="16px" color="grey-6" />
                  <span class="text-caption text-grey-6">
                    {{ campaign.supporterCount }} {{ $t('supporters') }}
                  </span>
                </div>
              </div>

              <!-- View Details Button -->
              <div class="row d-flex justify-center q-mt-md">
                <q-btn
                  :label="$t('viewDetails')"
                  color="primary"
                  unelevated
                  rounded
                  class="text-black full-width"
                  @click.stop="viewCampaign(campaign.id)"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Empty State -->
        <div v-if="campaignsStore.activeCampaigns.length === 0" class="col-12">
          <q-card flat class="text-center q-pa-xl">
            <q-icon name="inbox" size="64px" color="grey-4" class="q-mb-md" />
            <div class="text-h6 text-grey-6">{{ $t('noCampaignsAvailable') }}</div>
            <div class="text-body2 text-grey-5 q-mt-sm">
              {{ $t('checkBackLaterCampaigns') }}
            </div>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useCampaignsStore } from '../stores/campaigns';
import { useAuthStore } from '../stores/auth';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { logger } from '../utils/logger';

const { t } = useI18n();

defineOptions({
  name: 'CampaignsList'
});

const router = useRouter();
const $q = useQuasar();
const campaignsStore = useCampaignsStore();
const authStore = useAuthStore();

const isAdmin = computed(() => authStore.user?.status === 'admin');

const totalDonated = computed(() => {
  return campaignsStore.userDonations.reduce((sum, d) => sum + d.amount, 0);
});

const campaignsSupported = computed(() => {
  const uniqueCampaignIds = new Set(
    campaignsStore.userDonations.map(d => d.campaignId)
  );
  return uniqueCampaignIds.size;
});

// Cache image URLs to avoid recalculating
const imageUrlCache = new Map<string, string | null>();

const getImageUrl = (campaign: any): string | null => {
  if (!campaign) return null;
  
  // Check cache first
  if (imageUrlCache.has(campaign.id)) {
    const cached = imageUrlCache.get(campaign.id);
    return cached || null;
  }
  
  // Get image URL from store
  const imageUrl = campaignsStore.getCampaignImageUrl(campaign);
  
  // Only cache valid URLs (non-empty strings)
  const validUrl = imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '' ? imageUrl : null;
  imageUrlCache.set(campaign.id, validUrl);
  
  return validUrl;
};

const daysRemaining = (deadline: string): number => {
  if (!deadline) return 0;
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const viewCampaign = (id: string) => {
  router.push(`/campaigns/${id}`);
};

const goToManageCampaigns = () => {
  router.push('/admin/campaigns');
};

onMounted(async () => {
  // Performance monitoring: Page mount to data ready
  const pageStart = performance.now();
  const pagePerfId = `CampaignsList-mount-${Date.now()}`;
  performance.mark(`${pagePerfId}-start`);
  console.log(`[PERF] CampaignsList: Page mount started`);

  try {
    // Only fetch if campaigns aren't already in the store
    if (campaignsStore.campaigns.length === 0) {
      await campaignsStore.fetchCampaigns();
    }
    
    const pageTotalTime = performance.now() - pageStart;
    performance.mark(`${pagePerfId}-end`);
    performance.measure(`${pagePerfId}-total`, `${pagePerfId}-start`, `${pagePerfId}-end`);
    console.log(`[PERF] CampaignsList: Page ready in ${pageTotalTime.toFixed(2)}ms`);
  } catch (error) {
    const pageTotalTime = performance.now() - pageStart;
    console.error(`[PERF] CampaignsList: FAILED after ${pageTotalTime.toFixed(2)}ms`);
    logger.error('Failed to load campaigns', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadCampaigns'),
      position: 'top'
    });
  }
});
</script>

<style scoped lang="scss">
.campaigns-page {
  background-color: #f5f5f5;
}

.metric-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.metric-icon {
  flex-shrink: 0;
}

.campaign-card {
  background-color: white;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
}

.campaign-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.campaign-image-placeholder {
  width: 100%;
  height: 200px;
}
</style>

