<template>
  <q-page class="contribution-details-page">
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
    <div v-else-if="contribution">
      <!-- Header -->
      <div class="row items-center q-mb-md">
        <q-btn
          flat
          round
          icon="arrow_back"
          @click="goBack"
          class="q-mr-sm"
        />
        <div class="ls-1">{{ $t('activityDetails') }}</div>
      </div>

      <!-- Image Section -->
      <div class="contribution-header-image">
        <q-img
          v-if="contributionImageUrl"
          :src="contributionImageUrl"
          :ratio="16/9"
          class="full-width"
        >
          <template v-slot:loading>
            <div class="absolute-full flex flex-center">
              <q-spinner color="white" size="3em" />
            </div>
          </template>
        </q-img>
        <div v-else class="contribution-image-placeholder bg-grey-3 flex flex-center" style="height: 300px;">
          <q-icon name="image" size="64px" color="grey-5" />
        </div>
      </div>

      <!-- Reward Section -->
      <q-card flat class="reward-card q-mx-md q-mt-md">
        <q-card-section class="text-center">
          <q-avatar size="50px" color="yellow-5" class="text-yellow-5">
            <q-icon name="mdi-circle-multiple-outline" size="30px" color="black"/>
          </q-avatar>
          <div class="text-h6 text-weight-bold q-ma-xs">
            {{ contribution.tokenReward }} {{ $t('hrTokens') }}
          </div>
          <div class="text-body2 text-grey-7">
            {{ $t('rewardForCompletion') }}
          </div>
        </q-card-section>
      </q-card>

      <!-- Contribution Details Card -->
      <q-card flat class="details-card q-mx-md q-mt-md">
        <q-card-section>
          <!-- Type Tag -->
          <div class="row items-center q-mb-md">
            <q-chip
              :label="contributionTypeLabel"
              color="warning"
              text-color="black"
              size="sm"
            />
          </div>

          <!-- Title -->
          <div class="text-h6 text-weight-bold q-mb-sm">
            {{ contribution.title }}
          </div>

          <!-- Description -->
          <div class="text-body2 text-grey-7 q-mb-md">
            {{ contribution.description }}
          </div>

          <!-- Metrics -->
          <div v-if="contribution.deadline || contribution.targetParticipants" class="q-mb-md q-mt-lg">
            <div v-if="contribution.deadline" class="row items-center q-mb-sm">
              <q-icon name="schedule" size="20px" color="grey-6" class="q-mr-sm" />
              <span class="text-body2">
                {{ $t('deadlineLabel') }}: {{ formatDate(contribution.deadline) }}
              </span>
            </div>
            <div v-if="contribution.targetParticipants" class="row items-center q-mb-sm">
              <q-icon name="people" size="20px" color="grey-6" class="q-mr-sm" />
              <span class="text-body2">
                {{ contribution.currentParticipants.toLocaleString() }} {{ $t('participants') }}
              </span>
            </div>
            <div v-if="contribution.targetParticipants" class="q-mt-sm">
              <q-linear-progress
                :value="participationProgress"
                color="dark"
                size="8px"
                rounded
              />
            </div>
          </div>

          <!-- Full Details -->
          <div v-if="contribution.fullDetails" class="q-mt-lg">
            <div class="ls-1 q-mb-sm">{{ $t('fullDetails') }}</div>
            <div class="text-body2 text-grey-8">
              {{ contribution.fullDetails }}
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Action Buttons -->
      <div class="action-buttons q-pa-md">
        <q-btn
          v-if="isAdmin && contribution.contributionType === 'scan'"
          :label="$t('generateQRCode')"
          color="info"
          text-color="white"
          unelevated
          rounded
          class="full-width q-mb-md"
          icon="qr_code"
          :loading="generatingQR"
          @click="generateQRCode"
        />
        <q-btn
          :label="contribution.isCompleted ? t('actionCompleted') : contribution.actionButtonText"
          :color="contribution.isCompleted ? 'grey' : 'primary'"
          text-color="black"
          unelevated
          rounded
          class="full-width q-mb-md"
          :loading="completing"
          :disable="contribution.isCompleted"
          @click="handleComplete"
        />
        <q-btn
          v-if="contribution.externalLink"
          :label="$t('openLink')"
          color="secondary"
          text-color="white"
          unelevated
          rounded
          class="full-width"
          icon="open_in_new"
          @click="openExternalLink"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useContributionsStore } from '../stores/contributions';
import { useAuthStore } from '../stores/auth';
import { useQuasar } from 'quasar';
import { format } from 'date-fns';
import { useI18n } from 'vue-i18n';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { CapacitorBarcodeScanner } from '@capacitor/barcode-scanner';
import type { PluginListenerHandle } from '@capacitor/core';
import QRCode from 'qrcode';

// Barcode scanner constants matching Capacitor API enums
// QR_CODE = 0, BACK = 1 (from CapacitorBarcodeScannerCameraDirection enum)
const QR_CODE_FORMAT = 0;
const CAMERA_BACK = 1;

const { t } = useI18n();

defineOptions({
  name: 'ContributionDetails'
});

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const contributionsStore = useContributionsStore();
const authStore = useAuthStore();

const loading = ref(true);
const error = ref<string | null>(null);
const completing = ref(false);
const generatingQR = ref(false);
const contribution = ref<any>(null);
let browserListenerHandle: PluginListenerHandle | null = null;

const isAdmin = computed(() => authStore.user?.status === 'admin');

const contributionId = computed(() => route.params.id as string);

const contributionImageUrl = computed(() => {
  if (!contribution.value) return null;
  return contributionsStore.getContributionImageUrl(contribution.value);
});

const contributionTypeLabel = computed(() => {
  if (!contribution.value) return '';
  const type = contribution.value.contributionType;
  const labels: Record<string, string> = {
    visit: t('contributionTypeVisit'),
    share: t('contributionTypeShare'),
    scan: t('contributionTypeScan')
  };
  return labels[type] || t('contributionTypeVisit');
});

const participationProgress = computed(() => {
  if (!contribution.value || !contribution.value.targetParticipants) return 0;
  return Math.min(
    contribution.value.currentParticipants / contribution.value.targetParticipants,
    1
  );
});

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return t('invalidDate');
    }
    return format(date, 'dd MMM yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return t('invalidDate');
  }
};

const goBack = () => {
  router.back();
};

const handleComplete = async () => {
  if (!contribution.value || contribution.value.isCompleted) {
    return;
  }

  // If contribution type is 'visit', open browser and wait for browserFinished event
  if (contribution.value.contributionType === 'visit' && contribution.value.externalLink) {
    try {
      // Remove any existing listener first
      if (browserListenerHandle) {
        await browserListenerHandle.remove();
        browserListenerHandle = null;
      }

      // Set up listener for browserFinished event
      browserListenerHandle = await Browser.addListener('browserFinished', async () => {
        // Browser was closed, now fire the reward
        await completeContribution();
        
        // Remove listener after use
        if (browserListenerHandle) {
          await browserListenerHandle.remove();
          browserListenerHandle = null;
        }
      });

      // Open the browser with the external link
      await Browser.open({ 
        url: contribution.value.externalLink,
        toolbarColor: '#ffffff'
      });
    } catch (err: any) {
      console.error('Failed to open browser:', err);
      $q.notify({
        type: 'negative',
        message: err.message || t('failedToOpenBrowser'),
        position: 'top'
      });
      
      // Clean up listener on error
      if (browserListenerHandle) {
        await browserListenerHandle.remove();
        browserListenerHandle = null;
      }
    }
  } else if (contribution.value.contributionType === 'share') {
    // If contribution type is 'share', open share menu
    try {
      const shareOptions: any = {
        title: contribution.value.title,
        text: contribution.value.description
      };

      // Add URL if externalLink is available
      if (contribution.value.externalLink) {
        shareOptions.url = contribution.value.externalLink;
      }

      // Open share menu
      await Share.share(shareOptions);
      
      // Fire the reward after share completes
      await completeContribution();
    } catch (err: any) {
      // User cancelled sharing - don't show error, just don't complete
      if (err.message && err.message.includes('cancel')) {
        return;
      }
      
      console.error('Failed to share:', err);
      $q.notify({
        type: 'negative',
        message: err.message || t('failedToShare'),
        position: 'top'
      });
    }
  } else if (contribution.value.contributionType === 'scan') {
    // If contribution type is 'scan', open QR code scanner
    await scanQRCode();
  } else {
    // For other types, complete immediately
    await completeContribution();
  }
};

const completeContribution = async () => {
  if (!contribution.value || contribution.value.isCompleted) {
    return;
  }
  
  completing.value = true;
  try {
    await contributionsStore.completeContribution(contribution.value.id);
    
    $q.notify({
      type: 'positive',
      message: t('youEarnedTokens', [contribution.value.tokenReward]),
      position: 'top',
      timeout: 3000
    });

    // Refresh the contribution data
    await loadContribution();
  } catch (err: any) {
    console.error('Failed to complete contribution:', err);
    $q.notify({
      type: 'negative',
      message: err.message || t('failedToCompleteContribution'),
      position: 'top'
    });
  } finally {
    completing.value = false;
  }
};

const scanQRCode = async () => {
  if (!contribution.value) {
    return;
  }

  try {
    // Start scanning using Capacitor Barcode Scanner API
    // Documentation: https://capacitorjs.com/docs/apis/barcode-scanner#scanbarcode
    const scanResult = await CapacitorBarcodeScanner.scanBarcode({
      hint: QR_CODE_FORMAT, // QR_CODE format (0) from Html5QrcodeSupportedFormats enum
      scanInstructions: t('scanQRCodeInstructions'),
      scanButton: true,
      scanText: t('scanQRCode'),
      cameraDirection: CAMERA_BACK // BACK camera (1) from CapacitorBarcodeScannerCameraDirection enum
    });

    // Result structure: { ScanResult: string; format: CapacitorBarcodeScannerTypeHint; }
    // Documentation: https://capacitorjs.com/docs/apis/barcode-scanner#capacitorbarcodescannerscanresult
    const scannedId = scanResult.ScanResult.trim();
    const expectedId = contribution.value.id;

    if (scannedId === expectedId) {
      // QR code matches the contribution ID, complete the contribution
      await completeContribution();
    } else {
      // QR code doesn't match - show error message
      $q.notify({
        type: 'negative',
        message: t('qrCodeMismatch'),
        position: 'top',
        timeout: 3000
      });
    }
  } catch (err: any) {
    // Handle user cancellation gracefully (don't show error)
    if (err.message && (err.message.includes('cancel') || err.message.includes('User cancelled'))) {
      return;
    }
    
    // Handle permission errors
    if (err.message && err.message.includes('permission')) {
      $q.notify({
        type: 'negative',
        message: t('cameraPermissionDenied'),
        position: 'top'
      });
      return;
    }
    
    // Handle other errors
    console.error('Failed to scan QR code:', err);
    $q.notify({
      type: 'negative',
      message: err.message || t('failedToScanQRCode'),
      position: 'top'
    });
  }
};

const openExternalLink = () => {
  if (contribution.value?.externalLink) {
    window.open(contribution.value.externalLink, '_blank');
  }
};

const generateQRCode = async () => {
  if (!contribution.value) {
    return;
  }

  generatingQR.value = true;
  try {
    // Generate QR code with the contribution ID
    const qrCodeDataUrl = await QRCode.toDataURL(contribution.value.id, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Convert data URL to blob
    const response = await fetch(qrCodeDataUrl);
    const blob = await response.blob();

    // Create filename with contribution title (sanitized)
    const sanitizedTitle = contribution.value.title
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 30);
    const filename = `qr-code-${sanitizedTitle}-${contribution.value.id.substring(0, 8)}.png`;

    // Download the file (works on both web and mobile)
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    $q.notify({
      type: 'positive',
      message: t('qrCodeGeneratedSuccessfully'),
      position: 'top',
      timeout: 3000
    });
  } catch (err: any) {
    console.error('Failed to generate QR code:', err);
    $q.notify({
      type: 'negative',
      message: err.message || t('failedToGenerateQRCode'),
      position: 'top'
    });
  } finally {
    generatingQR.value = false;
  }
};

const loadContribution = async () => {
  // Performance monitoring: Contribution details load
  const loadStart = performance.now();
  const loadPerfId = `ContributionDetails-load-${contributionId.value}-${Date.now()}`;
  performance.mark(`${loadPerfId}-start`);
  console.log(`[PERF] ContributionDetails: Loading contribution ${contributionId.value}`);

  loading.value = true;
  error.value = null;
  
  try {
    const data = await contributionsStore.fetchContributionById(contributionId.value);
    contribution.value = data;
    
    // Check if user has completed this contribution
    const checkCompletedStart = performance.now();
    const userContributions = contributionsStore.userContributions;
    const isCompleted = userContributions.some(uc => uc.contributionId === contributionId.value);
    contribution.value.isCompleted = isCompleted;
    const checkCompletedTime = performance.now() - checkCompletedStart;
    console.log(`[PERF] ContributionDetails: Check completed status took ${checkCompletedTime.toFixed(2)}ms`);
    
    const loadTime = performance.now() - loadStart;
    performance.mark(`${loadPerfId}-end`);
    performance.measure(`${loadPerfId}-total`, `${loadPerfId}-start`, `${loadPerfId}-end`);
    console.log(`[PERF] ContributionDetails: Contribution loaded in ${loadTime.toFixed(2)}ms`);
  } catch (err: any) {
    const loadTime = performance.now() - loadStart;
    console.error(`[PERF] ContributionDetails: FAILED after ${loadTime.toFixed(2)}ms`);
    console.error('Failed to load contribution:', err);
    error.value = err.message || t('failedToLoadContribution');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  // Performance monitoring: Page mount
  const pageStart = performance.now();
  const pagePerfId = `ContributionDetails-mount-${Date.now()}`;
  performance.mark(`${pagePerfId}-start`);
  console.log(`[PERF] ContributionDetails: Page mount started`);

  await loadContribution();
  
  const pageTotalTime = performance.now() - pageStart;
  performance.mark(`${pagePerfId}-end`);
  performance.measure(`${pagePerfId}-total`, `${pagePerfId}-start`, `${pagePerfId}-end`);
  console.log(`[PERF] ContributionDetails: Page ready in ${pageTotalTime.toFixed(2)}ms`);
});

onUnmounted(async () => {
  // Clean up browser listener when component is unmounted
  if (browserListenerHandle) {
    await browserListenerHandle.remove();
    browserListenerHandle = null;
  }
});
</script>

<style scoped lang="scss">
.contribution-details-page {
  background-color: #f5f5f5 !important;
  min-height: 100vh;
}

.contribution-header-image {
  width: 100%;
  overflow: hidden;
}

.reward-card {
  background-color: white;
  border-radius: 12px;
}

.reward-icon-container {
  display: flex;
  justify-content: center;
}

.details-card {
  background-color: white;
  border-radius: 12px;
}

</style>

<style lang="scss">
// Non-scoped style to target parent .q-page-container element
// This applies globally. To scope it to this page only, use a route-specific class
.q-page-container {
  background-color: #f5f5f5 !important;
}
</style>

