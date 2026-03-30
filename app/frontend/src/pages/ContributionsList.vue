<template>
  <q-page class="contributions-page">
    <!-- Header Section -->
    <div class="q-pa-md">
      <div class="ls-1 q-mb-sm">{{ $t('earnHrTokens') }}</div>
      <p class="text-caption text-grey-7 q-mb-md">
        {{ $t('completeActionsToEarnTokens') }}
      </p>

      <!-- Metric Cards -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-6">
          <q-card class="metric-card" flat>
            <q-card-section class="q-pa-md" style="height: 120px;">
              <div class="row items-center justify-between">
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ $t('actionsDone') }}</div>
                  <div class="text-h4 text-weight-bold">{{ stats.actionsDone }}</div>
                </div>
                <div class="metric-icon">
                  <q-avatar size="30px" color="yellow-5" class="text-yellow-5">
                    <q-icon name="check" size="20px" color="black"/>
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
                  <div class="text-caption text-grey-7 q-mb-xs">{{ $t('tokensEarned') }}</div>
                  <div class="text-h4 text-weight-bold">{{ stats.tokensEarned }}</div>
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

    <!-- Available Actions Section -->
    <div class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="ls-1">{{ $t('availableActions') }}</div>
        <q-btn
          v-if="isAdmin"
          flat
          round
          icon="edit"
          color="grey-7"
          size="sm"
          @click="goToManageContributions"
        >
          <q-tooltip>{{ $t('manageContributions') }}</q-tooltip>
        </q-btn>
      </div>

      <!-- Loading State -->
      <div v-if="contributionsStore.loading" class="row q-col-gutter-md">
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
      <q-banner v-else-if="contributionsStore.error" rounded class="bg-negative text-white q-mb-md">
        {{ contributionsStore.error }}
      </q-banner>

      <!-- Contributions List -->
      <div v-else class="row q-col-gutter-md">
        <div
          v-for="contribution in contributionsStore.activeContributions"
          :key="contribution.id"
          class="col-12"
        >
          <q-card
            class="contribution-card cursor-pointer"
            flat
            bordered
            @click="viewContribution(contribution.id)"
          >
            <!-- Image Section -->
            <div class="contribution-image-container">
              <img
                :src="getImageUrl(contribution) || ''"
                class="contribution-image"
                loading="lazy"
                @error="handleImageError"
                @load="handleImageLoad"
                @loadstart="handleImageStartLoad"
                :alt="contribution.title || 'Contribution image'"
              />
              <div v-if="imageLoading.has(getImageUrl(contribution) || '')" class="contribution-image-loading absolute-full flex flex-center">
                <q-spinner color="primary" size="3em" />
              </div>
              <!-- Action Type Badge -->
              <span v-if="contribution.contributionType" class="absolute-top-left q-ma-xs">
                <q-chip
                  :label="$t(getContributionTypeLabel(contribution.contributionType))"
                  :color="getContributionTypeQuasarColor(contribution.contributionType)"
                  text-color="white"
                  size="sm"
                />
              </span>
            </div>

            <q-card-section>
              <!-- Title and Description -->
              <div class="text-h6 q-mb-sm">{{ contribution.title }}</div>
              <div class="text-body2 text-grey-7 q-mb-md">
                {{ contribution.description }}
              </div>

              <!-- Token Reward and Action Button -->
              <div class="row items-center justify-between">
                <div class="row items-center q-gutter-xs">
                  <q-icon name="mdi-circle-multiple-outline" size="20px" color="black" />
                  <span class="text-body2 text-weight-medium">
                    {{ contribution.tokenReward }} {{ $t('hrTokens') }}
                  </span>
                </div>
                <div class="row d-flex justify-center q-mt-md">
                  <q-btn
                    :label="contribution.isCompleted ? t('actionCompleted') : t('completeAction')"
                    :color="contribution.isCompleted ? 'grey' : 'primary'"
                    unelevated
                    rounded
                    class="text-black full-width"
                    :disable="contribution.isCompleted"
                    @click.stop="handleAction(contribution)"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Empty State -->
        <div v-if="contributionsStore.activeContributions.length === 0" class="col-12">
          <q-card flat class="text-center q-pa-xl">
            <q-icon name="inbox" size="64px" color="grey-4" class="q-mb-md" />
            <div class="text-h6 text-grey-6">{{ $t('noContributionsAvailable') }}</div>
            <div class="text-body2 text-grey-5 q-mt-sm">
              {{ $t('checkBackLater') }}
            </div>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useContributionsStore } from '../stores/contributions';
import { useAuthStore } from '../stores/auth';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { logger } from '../utils/logger';
import { getContributionTypeLabel, getContributionTypeQuasarColor } from '../config/contributionTypes';

const { t } = useI18n();

defineOptions({
  name: 'ContributionsList'
});

const router = useRouter();
const $q = useQuasar();
const contributionsStore = useContributionsStore();
const authStore = useAuthStore();

const stats = computed(() => contributionsStore.stats);
const totalContributions = computed(() => contributionsStore.activeContributions.length);
const isAdmin = computed(() => authStore.user?.status === 'admin');

// Image loading state - track per image URL
const imageLoading = ref<Set<string>>(new Set());
const imageErrors = ref<Set<string>>(new Set());

const handleImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement;
  if (img.src) {
    imageLoading.value.delete(img.src);
    imageErrors.value.delete(img.src); // Remove from errors if it loads successfully
  }
};

const handleImageError = (event: Event | ErrorEvent) => {
  const img = event.target as HTMLImageElement;
  if (img && img.src) {
    console.error(`[IMAGE ERROR] Image failed to load:`, {
      srcPreview: img.src.substring(0, 100) + (img.src.length > 100 ? '...' : ''),
      srcLength: img.src.length,
      isDataUrl: img.src.startsWith('data:'),
      isBlobUrl: img.src.startsWith('blob:'),
      isHttpUrl: img.src.startsWith('http')
    });
    
    imageErrors.value.add(img.src);
    imageLoading.value.delete(img.src);
  }
};

const handleImageStartLoad = (event: Event) => {
  const img = event.target as HTMLImageElement;
  if (img.src) {
    imageLoading.value.add(img.src);
  }
};

// Get image URL from store (which uses unified image utility)
const getImageUrl = (contribution: any): string | null => {
  if (!contribution) return null;
  return contributionsStore.getContributionImageUrl(contribution);
};

const viewContribution = (id: string) => {
  router.push(`/contributions/${id}`);
};

const handleAction = async (contribution: any) => {
  if (contribution.isCompleted) {
    return;
  } else {
    // Navigate to detail page
    viewContribution(contribution.id);
  }
};

const goToManageContributions = () => {
  router.push('/admin/contributions');
};

onMounted(async () => {
  // Performance monitoring: Page mount to data ready
  const pageStart = performance.now();
  const pagePerfId = `ContributionsList-mount-${Date.now()}`;
  performance.mark(`${pagePerfId}-start`);
  console.log(`[PERF] ContributionsList: Page mount started`);

  try {
    // Only fetch if contributions aren't already in the store
    if (contributionsStore.contributions.length === 0) {
      await contributionsStore.fetchContributions();
    }
    
    const pageTotalTime = performance.now() - pageStart;
    performance.mark(`${pagePerfId}-end`);
    performance.measure(`${pagePerfId}-total`, `${pagePerfId}-start`, `${pagePerfId}-end`);
    console.log(`[PERF] ContributionsList: Page ready in ${pageTotalTime.toFixed(2)}ms`);
  } catch (error) {
    const pageTotalTime = performance.now() - pageStart;
    console.error(`[PERF] ContributionsList: FAILED after ${pageTotalTime.toFixed(2)}ms`);
    logger.error('Failed to load contributions', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadContributions'),
      position: 'top'
    });
  }
});
</script>

<style scoped lang="scss">
.contributions-page {
  background-color: #f5f5f5;
}

.header-section {
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
}

.metric-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.metric-icon {
  flex-shrink: 0;
}

.contribution-card {
  background-color: white;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
}

.contribution-image-container {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  overflow: hidden;
  background-color: #f5f5f5;
}

.contribution-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.contribution-image-loading {
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 1;
}

.contribution-image-placeholder {
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

