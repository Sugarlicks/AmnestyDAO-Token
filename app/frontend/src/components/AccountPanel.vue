<template>
  <q-drawer
    v-model="drawerOpen"
    side="right"
    :width="drawerWidth"
    elevated
    class="bg-grey-1"
    overlay
  >
    <q-scroll-area class="fit">
      <div class="q-pa-md">
        <!-- Header -->
        <div class="row items-center q-mb-md">
          <q-btn
            flat
            round
            dense
            icon="arrow_back"
            @click="drawerOpen = false"
            class="q-mr-sm"
          />
          <div class="col">
            <div class="ls-1">{{ t('profile') }}</div>
            <div class="text-caption text-grey-7">{{ t('manageYourAccount') }}</div>
          </div>
        </div>

        <!-- Profile Summary Card -->
        <q-card flat class="q-mb-md bg-white" style="border-radius: 16px;">
          <q-card-section class="text-center q-pa-lg">
            <q-avatar 
              size="120px" 
              class="q-mb-md" 
              color="warning"
              :class="{ 'cursor-pointer': isEditing }"
              @click="isEditing ? triggerFileInput() : null"
            >
              <img v-if="profileImagePreview || auth.user.profileImage" :src="profileImagePreview || getFullImageUrl(auth.user.profileImage)">
              <span v-else class="text-h3 text-dark">{{ displayNameInitial }}</span>
              <q-icon 
                v-if="isEditing" 
                name="camera_alt" 
                size="24px" 
                color="dark"
                class="absolute-bottom-right q-ma-xs"
                style="background: rgba(255,255,255,0.9); border-radius: 50%; padding: 4px;"
              />
            </q-avatar>
            <q-file
              v-model="profileImageFile"
              accept="image/*"
              class="hidden"
              max-file-size="5242880"
              @rejected="onImageRejected"
              @update:model-value="handleImageUpload"
              ref="fileInput"
            />
            <div class="ls-1 q-mb-xs">{{ displayName }}</div>
            <div class="caption text-grey-7 q-mb-sm">{{ auth.user.email || t('noEmail') }}</div>
            <q-badge 
              :color="auth.user.status === 'admin' ? 'secondary' : 'warning'" 
              :label="auth.user.status === 'admin' ? t('admin') : t('activeMember')"
              class="q-px-md q-py-xs text-black"
              style="border-radius: 20px;"
              @click="auth.user.status === 'admin' ? goToAdminDashboard() : null"
            />
          </q-card-section>
        </q-card>

        <!-- Your Impact Section -->
        <div class="q-mb-md">
          <div class="ls-1 q-mb-md">{{ t('yourImpact') }}</div>
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-card flat class="bg-amber-1" style="border-radius: 12px;">
                <q-card-section class="q-pa-md text-center">
                  <q-icon name="check_circle" size="24px" color="grey-8" class="q-mb-xs" />
                  <div class="text-h5 ls-1">{{ impactStats.actionsCompleted }}</div>
                  <div class="text-caption text-grey-7">{{ t('actionsCompleted') }}</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-6">
              <q-card flat class="bg-amber-1" style="border-radius: 12px;">
                <q-card-section class="q-pa-md text-center">
                  <q-icon name="campaign" size="24px" color="grey-8" class="q-mb-xs" />
                  <div class="text-h5 ls-1">{{ impactStats.campaignsSupported }}</div>
                  <div class="text-caption text-grey-7">{{ t('campaignsSupported') }}</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-6">
              <q-card flat class="bg-pink-1" style="border-radius: 12px;">
                <q-card-section class="q-pa-md text-center">
                  <q-icon name="volunteer_activism" size="24px" color="pink-7" class="q-mb-xs" />
                  <div class="text-h5 ls-1">{{ impactStats.tokensDonated }}</div>
                  <div class="text-caption text-grey-7">{{ t('tokensDonated') }}</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-6">
              <q-card flat class="bg-warning" style="border-radius: 12px;">
                <q-card-section class="q-pa-md text-center">
                  <q-icon name="account_balance_wallet" size="24px" color="dark" class="q-mb-xs" />
                  <div class="text-h5 ls-1">{{ impactStats.currentBalance }}</div>
                  <div class="text-caption text-dark">{{ t('currentBalance') }}</div>
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>

        <!-- Profile Information Section -->
        <div class="q-mb-md">
          <div class="row items-center justify-between q-mb-md">
            <div class="ls-1">{{ t('profileInformation') }}</div>
            <q-btn
              flat
              round
              dense
              size="small"
              :icon="isEditing ? 'close' : 'edit'"
              @click="toggleEdit"
              color="grey-7"
            />
          </div>
          <q-card flat class="bg-white" style="border-radius: 16px;">
            <q-card-section class="q-pa-md">
              <!-- Display Name / Preferred Name -->
              <div class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="person" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('displayName') }}</div>
                  <q-input
                    v-if="isEditing"
                    v-model="editForm.preferredName"
                    dense
                    outlined
                    :placeholder="t('preferredNamePlaceholder')"
                    class="q-mt-xs"
                  />
                  <div v-else class="text-body2">{{ displayName }}</div>
                </div>
              </div>

              <!-- Email -->
              <div class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="email" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('email') }}</div>
                  <q-input
                    v-if="isEditing"
                    v-model="editForm.email"
                    dense
                    outlined
                    type="email"
                    :placeholder="t('emailAddressPlaceholder')"
                    class="q-mt-xs"
                  />
                  <div v-else class="text-body2">{{ auth.user.email || t('noEmail') }}</div>
                </div>
              </div>

              <!-- First Name -->
              <div class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="badge" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('firstName') }}</div>
                  <q-input
                    v-if="isEditing"
                    v-model="editForm.firstName"
                    dense
                    outlined
                    :placeholder="t('firstNamePlaceholder')"
                    class="q-mt-xs"
                  />
                  <div v-else class="text-body2">{{ auth.user.firstName || t('notSet') }}</div>
                </div>
              </div>

              <!-- Last Name -->
              <div class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="badge" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('lastName') }}</div>
                  <q-input
                    v-if="isEditing"
                    v-model="editForm.lastName"
                    dense
                    outlined
                    :placeholder="t('lastNamePlaceholder')"
                    class="q-mt-xs"
                  />
                  <div v-else class="text-body2">{{ auth.user.lastName || t('notSet') }}</div>
                </div>
              </div>

              <!-- Affiliations -->
              <div v-if="auth.user.affiliations || isEditing" class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="groups" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('affiliations') }}</div>
                  <q-input
                    v-if="isEditing"
                    v-model="editForm.affiliations"
                    dense
                    outlined
                    :placeholder="t('affiliationsPlaceholder')"
                    class="q-mt-xs"
                  />
                  <div v-else class="text-body2">{{ formatAffiliations(auth.user.affiliations) }}</div>
                </div>
              </div>

              <!-- Wallet Address -->
              <div v-if="auth.user.walletAddress" class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="account_balance_wallet" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('walletAddress') }}</div>
                  <div class="text-body2 text-grey-8" style="word-break: break-all; font-family: monospace; font-size: 0.75rem;">
                    {{ auth.user.walletAddress }}
                  </div>
                </div>
              </div>

              <!-- Country Preference -->
              <div class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="public" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('country') }}</div>
                  <q-select
                    v-if="isEditing"
                    v-model="editForm.country"
                    :options="countryOptions"
                    option-value="code"
                    option-label="name"
                    emit-value
                    map-options
                    dense
                    outlined
                    clearable
                    :placeholder="t('selectCountry')"
                    class="q-mt-xs"
                  />
                  <div v-else class="text-body2">
                    {{ currentCountryName || t('notSet') }}
                  </div>
                </div>
              </div>

              <!-- Language Preference -->
              <div class="row items-center q-mb-md">
                <q-avatar size="32px" color="grey-3" class="q-mr-md">
                  <q-icon name="language" color="grey-7" />
                </q-avatar>
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">{{ t('language') }}</div>
                  <LanguageSwitcher />
                </div>
              </div>

              <!-- Save/Cancel Buttons -->
              <div v-if="isEditing" class="row q-col-gutter-sm q-mt-md">
                <div class="col">
                  <q-btn
                    :label="t('cancel')"
                    outline
                    color="grey-7"
                    class="full-width"
                    @click="cancelEdit"
                  />
                </div>
                <div class="col">
                  <q-btn
                    :label="t('save')"
                    color="primary"
                    class="full-width"
                    @click="saveProfile"
                    :loading="saving"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- App Information Section -->
        <div class="q-mb-md">
          <div class="ls-1 q-mb-md">{{ t('appInformation') }}</div>
          <q-card flat class="bg-white" style="border-radius: 16px;">
            <q-card-section class="q-pa-md">
              <!-- App Details -->
              <div class="row items-center q-mb-md">
                <q-avatar size="40px" color="warning" class="q-mr-md">
                  <img src="../assets/icon-logo.svg" alt="HRDAO" style="width: 30px;" />
                </q-avatar>
                <div class="col">
                  <div class="text-body1 ls-1">{{ t('hrDao') }}</div>
                  <div class="text-caption text-grey-7">{{ t('poweredByAmnesty') }}</div>
                  <a 
                    href="https://matou.nz" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="text-caption text-grey-7"
                  >
                    Built by Matou
                  </a>
                </div>
              </div>

              <!-- Version -->
              <div class="row items-center">
                <div class="col">
                  <div class="text-caption text-grey-7">{{ t('version') }}</div>
                </div>
                <div class="text-body1">
                  {{ versionStore.frontendVersion }}
                  <span v-if="isDevelopment" class="text-caption text-grey-7 q-ml-xs">env: dev</span>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

                <!-- Admin Tools Section -->
                <div v-if="auth.user.status === 'admin'" class="q-mb-md">
          <div class="ls-1 q-mb-md">{{ t('adminTools') }}</div>
          <q-card flat class="bg-white" style="border-radius: 16px;">
            <q-card-section class="q-pa-md">
              <q-btn
                :label="t('adminDashboard')"
                color="black"
                icon="mdi-shield-outline"
                class="full-width text-yellow"
                style="border-radius: 8px;"
                @click="goToAdminDashboard"
                unelevated
              />
            </q-card-section>
          </q-card>
        </div>


        <!-- Logout Button -->
        <!-- <div class="q-mt-lg">
          <q-btn
            color="warning"
            label="Logout"
            @click="handleLogout"
            class="full-width text-black"
            style="border-radius: 8px;"
          />
        </div> -->
      </div>
    </q-scroll-area>
  </q-drawer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useVersionStore } from '../stores/version';
import { useTokenStore } from '../stores/token';
import { useContributionsStore } from '../stores/contributions';
import { useCampaignsStore } from '../stores/campaigns';
import { useLocaleStore } from '../stores/locale';
import { useRouter } from 'vue-router';
import config from '../config';
import { App } from '@capacitor/app';
import { Notify, QFile } from 'quasar';
import { getImageUrl } from '../utils/imageUtils';
import LanguageSwitcher from './LanguageSwitcher.vue';

// Add type declarations for platform-specific APIs
declare global {
  interface Window {
    electron?: {
      close: () => void;
    };
  }
}

const { t } = useI18n();
const auth = useAuthStore();
const versionStore = useVersionStore();
const tokenStore = useTokenStore();
const contributionsStore = useContributionsStore();
const campaignsStore = useCampaignsStore();
const localeStore = useLocaleStore();
const router = useRouter();
const drawerOpen = ref(false);
const isEditing = ref(false);
const saving = ref(false);

// Profile image upload
const profileImagePreview = ref<string | null>(null);
const profileImageFile = ref<File | null>(null);
const profileImageBase64 = ref<string | null>(null);
const fileInput = ref<InstanceType<typeof QFile> | null>(null);

const drawerWidth = computed(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth;
  }
  return 1000; // fallback
});

const editForm = ref({
  firstName: '',
  lastName: '',
  preferredName: '',
  email: '',
  affiliations: '',
  country: null as string | null,
  profileImage: null as string | null
});

const displayName = computed(() => {
  return auth.user.preferredName || `${auth.user.firstName} ${auth.user.lastName}`;
});

const displayNameInitial = computed(() => {
  const name = displayName.value;
  return name ? name.charAt(0).toUpperCase() : '?';
});

const countryOptions = computed(() => localeStore.availableCountries);

const currentCountryName = computed(() => {
  const country = (auth.user as any)?.country;
  if (!country) return null;
  const countryInfo = localeStore.availableCountries.find(c => c.code === country);
  return countryInfo?.name || country;
});

const isDevelopment = computed(() => process.env.NODE_ENV === 'development');

const impactStats = computed(() => {
  // Calculate campaigns supported (unique campaigns user has donated to)
  const uniqueCampaignIds = new Set<string>();
  
  // Get unique campaigns from user donations
  campaignsStore.userDonations.forEach(donation => {
    if (donation.campaignId) {
      uniqueCampaignIds.add(donation.campaignId);
    }
  });
  
  // Also check token transactions for DONATION type with campaign_id
  tokenStore.userTransactions
    .filter(tx => {
      const txType = tx.transactionType || tx.type;
      return txType === 'DONATION' && tx.campaign_id;
    })
    .forEach(tx => {
      if (tx.campaign_id) {
        uniqueCampaignIds.add(tx.campaign_id);
      }
    });
  
  const campaignsSupported = uniqueCampaignIds.size;

  // Calculate tokens donated (sum of DONATION transactions)
  // getUserTransactions already returns only transactions for the current user,
  // so any DONATION transaction is from this user as the donor
  const tokensDonated = tokenStore.userTransactions
    .filter(tx => {
      const txType = tx.transactionType || tx.type;
      return txType === 'DONATION';
    })
    .reduce((sum, tx) => {
      // Use tokenAmount if available (more accurate for donations), otherwise amount
      const amount = tx.tokenAmount ?? tx.token_amount ?? tx.amount ?? 0;
      return sum + amount;
    }, 0);

  return {
    actionsCompleted: contributionsStore.stats.actionsDone || 0,
    campaignsSupported,
    tokensDonated: Math.round(tokensDonated * 100) / 100,
    currentBalance: Math.round(tokenStore.userBalance * 100) / 100
  };
});

onMounted(async () => {
  try {
    await versionStore.fetchBackendVersion();
    // Fetch user contributions, transactions, and donations for stats
    if (auth.userId) {
      await contributionsStore.fetchUserContributions();
      await tokenStore.fetchUserTransactions();
      await tokenStore.fetchUserBalance();
      await campaignsStore.fetchUserDonations();
    }
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
});

// Watch for drawer opening to refresh data
watch(drawerOpen, async (isOpen) => {
  if (isOpen && auth.userId) {
    try {
      await contributionsStore.fetchUserContributions();
      await tokenStore.fetchUserTransactions();
      await tokenStore.fetchUserBalance();
      await campaignsStore.fetchUserDonations();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }
});

// Cleanup blob URL on component unmount
onBeforeUnmount(() => {
  if (profileImagePreview.value) {
    URL.revokeObjectURL(profileImagePreview.value);
  }
});

function goToAdminDashboard() {
  router.push('/admin');
}

function formatAffiliations(affiliations: string | string[] | null): string {
  if (!affiliations) return t('none');
  if (Array.isArray(affiliations)) {
    return affiliations.length > 0 ? affiliations.join(', ') : t('none');
  }
  return affiliations;
}

function getFullImageUrl(path: string | { data: number[], type: string } | null) {
  if (!path) return null;
  // Use the unified image utility which handles all formats correctly
  if (typeof path === 'string') {
    const result = getImageUrl(path);
    return result.url;
  }
  if (typeof path === 'object' && path.data) {
    // Convert object format to base64 string first
    try {
      const uint8Array = new Uint8Array(path.data);
      const chunkSize = 1024 * 1024;
      let result = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        result += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(result);
      const imageResult = getImageUrl(base64);
      return imageResult.url;
    } catch (error) {
      console.error('Error converting image:', error);
      return null;
    }
  }
  return null;
}

function toggleEdit() {
  if (isEditing.value) {
    cancelEdit();
  } else {
    isEditing.value = true;
    const affiliationsValue = auth.user.affiliations 
      ? (Array.isArray(auth.user.affiliations) 
          ? auth.user.affiliations.join(', ') 
          : auth.user.affiliations)
      : '';
    editForm.value = {
      firstName: auth.user.firstName || '',
      lastName: auth.user.lastName || '',
      preferredName: auth.user.preferredName || '',
      email: auth.user.email || '',
      affiliations: affiliationsValue,
      country: (auth.user as any)?.country || null,
      profileImage: null
    };
    // Reset image preview
    profileImagePreview.value = null;
    profileImageFile.value = null;
    profileImageBase64.value = null;
  }
}

function cancelEdit() {
  isEditing.value = false;
  editForm.value = {
    firstName: '',
    lastName: '',
    preferredName: '',
    email: '',
    affiliations: '',
    country: null,
    profileImage: null
  };
  // Reset image preview and revoke blob URL to prevent memory leaks
  if (profileImagePreview.value) {
    URL.revokeObjectURL(profileImagePreview.value);
  }
  profileImagePreview.value = null;
  profileImageFile.value = null;
  profileImageBase64.value = null;
}

function triggerFileInput() {
  fileInput.value?.pickFiles();
}

function onImageRejected() {
  Notify.create({
    type: 'negative',
    message: t('fileTooLarge'),
    position: 'top'
  });
}

function handleImageUpload(file: File | null) {
  if (!file) return;
  // Preview
  profileImagePreview.value = URL.createObjectURL(file);
  // Convert to base64 (without data URL prefix) for backend
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result as string;
    const base64Data = base64String.split(',')[1];
    profileImageBase64.value = base64Data;
    editForm.value.profileImage = base64Data;
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  try {
    saving.value = true;
    const updateData: {
      firstName?: string;
      lastName?: string;
      preferredName?: string | null;
      email?: string | null;
      affiliations?: string | null;
      country?: string | null;
      profileImage?: string | null;
    } = {
      firstName: editForm.value.firstName,
      lastName: editForm.value.lastName,
      preferredName: editForm.value.preferredName || null,
      email: editForm.value.email || null,
      affiliations: editForm.value.affiliations || null,
      country: editForm.value.country || null
    };
    
    // Include profileImage if a new one was selected
    if (profileImageBase64.value !== null) {
      updateData.profileImage = profileImageBase64.value;
    }
    
    await auth.updateUserProfile(updateData);
    isEditing.value = false;
    // Reset image preview after successful save
    if (profileImagePreview.value) {
      URL.revokeObjectURL(profileImagePreview.value);
      profileImagePreview.value = null;
    }
    profileImageFile.value = null;
    profileImageBase64.value = null;
    Notify.create({
      type: 'positive',
      message: t('profileUpdatedSuccessfully'),
      position: 'top'
    });
  } catch (error) {
    console.error('Failed to update profile:', error);
    Notify.create({
      type: 'negative',
      message: t('failedToUpdateProfile'),
      position: 'top'
    });
  } finally {
    saving.value = false;
  }
}

async function handleLogout() {
  try {
    await auth.logout();
    router.push('/');
    
    // Check if running in Electron
    if (window.electron) {
      window.electron.close();
    }
    // Use Capacitor App plugin for mobile
    else {
      await App.exitApp();
    }
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

// Expose open/close methods
defineExpose({
  open: () => drawerOpen.value = true,
  close: () => drawerOpen.value = false
});
</script>

<style scoped>
.bg-grey-1 {
  background-color: #f5f5f5;
}
</style>
