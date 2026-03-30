<template>
  <q-page class="flex flex-center">
    <div class="column items-center q-pa-md" style="width: 100%;">
      <div class="q-mb-lg scale-in">
        <div class="flex items-center justify-center" style="width: 100px;">
          <img :src="iconLogo" alt="HRDAO" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
      </div>

      <div class="text-center q-mb-md fade-in-2">
        <div class="text-h4 text-weight-bold q-mb-md">{{ $t('humanRightsDao') }}</div>
        <div class="powered-badge q-mt-xs">{{ $t('poweredByAmnesty') }}</div>
        <div class="text-body1 q-mt-sm" style="opacity: 0.8;">
          {{ $t('joinCommunityMessage') }}
        </div>
      </div>

      <div class="row q-col-gutter-sm q-mt-lg fade-in-3" style="width: 100%;">
        <div class="col-12">
          <div class="card-soft q-pa-md text-center">
            <q-icon name="public" size="32px" />
            <div class="text-caption q-mt-sm">{{ $t('globalCampaigns') }}</div>
          </div>
        </div>
        <div class="col-6 q-mt-sm">
          <div class="card-soft q-pa-md text-center">
            <q-icon name="paid" size="32px" />
            <div class="text-caption q-mt-sm">{{ $t('earnTokens') }}</div>
          </div>
        </div>
        <div class="col-6 q-mt-sm">
          <div class="card-soft q-pa-md text-center">
            <q-icon name="volunteer_activism" size="32px" />
            <div class="text-caption q-mt-sm">{{ $t('giveSupport') }}</div>
          </div>
        </div>
      </div>

      <div class="q-mt-xl" style="width: 100%;">
        <q-btn
          :label="`${$t('getStarted')}`"
          flat
          class="ls-1"
          @click="showDialog = true"
          style="width: 100%; height: 56px; background: #000; color: #FFFF;"
        />
        <div class="text-center text-caption q-mt-md" style="opacity: 0.7;">
          {{ $t('togetherWeProtectHumanDignity') }}
        </div>
      </div>
    </div>

    <!-- Registration Dialog -->
    <q-dialog v-model="showDialog" :maximized="isMobile">
      <q-card :style="isMobile ? '' : 'min-width: 420px'" style="background: #f9f9f9;">
        <q-card-section class="q-pb-none">
          <div class="row items-center no-wrap">
            <q-btn flat round icon="arrow_back" v-close-popup />
            <q-avatar size="30px" class="q-ml-sm" color="primary">
              <img :src="iconLogo" alt="HRDAO" />
            </q-avatar>
            <div class="column q-ml-sm">
              <div class="text-subtitle1 text-weight-bold">{{ $t('joinHumanRightsDao') }}</div>
              <div class="text-caption text-grey-7">{{ $t('createYourAccount') }}</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="onSubmit">
            
            <p class="text-subtitle2 q-mb-xs">{{ $t('profileImage') }}</p>
            <div class="row justify-center q-mb-md">
              <q-avatar color="primary" size="60px" class="cursor-pointer" @click="triggerFileInput">
                <img v-if="profileImage" :src="profileImage" style="object-fit: cover; width: 100%; height: 100%;" />
                <q-icon v-else name="person_add" size="30px" />
                <q-file
                  v-model="profileImageFile"
                  accept="image/*"
                  class="hidden"
                  max-file-size="5242880"
                  @rejected="onRejected"
                  @update:model-value="handleImageUpload"
                  ref="fileInput"
                />
              </q-avatar>
            </div>

            <p class="text-subtitle2 q-mb-xs">{{ $t('displayName') }} *</p>
            <q-input
              class="q-mb-sm"
              v-model="formData.displayName"
              :placeholder="$t('displayNamePlaceholder')"
              filled
              dense
              lazy-rules
              :rules="[requireDisplayName]"
              light
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('email') }} *</p>
            <q-input
              class="q-mb-sm"
              v-model="formData.email"
              :placeholder="$t('emailPlaceholder')"
              type="email"
              filled
              dense
              lazy-rules
              :rules="[requireEmail]"
            />
            <div class="text-caption text-grey-7 q-mt-xs">{{ $t('getUpdatesOnCampaignsYouCareAbout') }}</div>

            <p class="text-subtitle2 q-mt-lg q-mb-xs">{{ $t('country') }} *</p>
            <q-select
              v-model="formData.country"
              :options="countryOptions"
              option-value="code"
              option-label="name"
              emit-value
              map-options
              filled
              dense
              class="q-mb-sm"
              @update:model-value="onCountryChange"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('language') }} *</p>
            <q-select
              v-model="formData.language"
              :options="languageOptions"
              option-value="code"
              option-label="name"
              emit-value
              map-options
              filled
              dense
              class="q-mb-sm"
            />

            <div class="text-subtitle2 q-mt-lg">{{ $t('areasOfInterest') }} ({{ $t('selectAllThatApply') }})</div>
            <q-option-group
              v-model="formData.interests"
              type="checkbox"
              :options="interestOptions"
              color="secondary"
              class="q-mt-sm group-options"
            />

            <q-checkbox
              v-model="formData.acceptTerms"
              :rules="[requireTerms]"
              class="q-mt-md"
              :label="$t('acceptTermsLabel')"
              color="secondary"
            />

            <q-btn
              :label="$t('joinTheMovement')"
              type="submit"
              unelevated
              class="q-mt-md"
              :loading="loading"
              :disable="!formData.acceptTerms"
              :style="formData.acceptTerms ? 'width: 100%; background: #FFFF00; color: #000;' : 'width: 100%; background: #e0e0e0; color: #666;'"
            />

            <div class="text-caption q-mt-md text-grey-7">
              {{ $t('registerCommunityMessage') }}
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useLocaleStore } from '../stores/locale';
import { useRouter } from 'vue-router';
import { useQuasar, QFile } from 'quasar';
import iconLogo from '../assets/icon-logo.svg';

defineOptions({
  name: 'RegisterUser'
});

const router = useRouter();
const authStore = useAuthStore();
const localeStore = useLocaleStore();
const loading = ref(false);
const $q = useQuasar();
const showDialog = ref(false);

const formData = ref({
  profileImage: null as string | null,
  displayName: '',
  email: '',
  interests: [] as string[],
  acceptTerms: false,
  country: null as string | null,
  language: null as string | null
});

const countryOptions = computed(() => localeStore.availableCountries);
const languageOptions = computed(() => localeStore.availableLocales);

const onCountryChange = (country: string | null) => {
  // Suggest language based on country, but allow override
  if (country && !formData.value.language) {
    const suggestedLanguage = localeStore.getSuggestedLanguageForCountry(country);
    formData.value.language = suggestedLanguage;
  }
};

import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const interestOptions = [
  { label: t('interestFreedomOfExpression'), value: 'Freedom of Expression' },
  { label: t('interestEnvironmentalRights'), value: 'Environmental Rights' },
  { label: t('interestChildrensRights'), value: "Children's Rights" },
  { label: t('interestRefugeeRights'), value: 'Refugee Rights' },
  { label: t('interestWomensRights'), value: "Women's Rights" },
  { label: t('interestLGBTQRights'), value: 'LGBTQ+ Rights' },
  { label: t('interestDigitalRights'), value: 'Digital Rights' },
  { label: t('interestEconomicJustice'), value: 'Economic Justice' }
];

const isMobile = computed(() => $q.screen.lt.md);

// validation helpers to satisfy TS and keep template simple
function requireDisplayName(val: unknown): true | string {
  return (typeof val === 'string' && val.trim().length > 0) || t('displayNameRequired');
}
function requireEmail(val: unknown): true | string {
  return (typeof val === 'string' && val.trim().length > 0 && val.includes('@')) || t('emailRequiredValid');
}

function requireTerms(val: unknown): true | string {
  return val === true || t('mustAcceptTerms');
}

// Profile image upload
const profileImage = ref<string | null>(null);
const profileImageFile = ref<File | null>(null);
const fileInput = ref<InstanceType<typeof QFile> | null>(null);

const triggerFileInput = () => {
  fileInput.value?.pickFiles();
};

const onRejected = () => {
  $q.notify({
    type: 'negative',
    message: t('fileTooLarge')
  });
};

const handleImageUpload = (file: File | null) => {
  if (!file) return;
  // Preview
  profileImage.value = URL.createObjectURL(file);
  // Convert to base64 (without data URL prefix) for backend
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result as string;
    const base64Data = base64String.split(',')[1];
    formData.value.profileImage = base64Data;
  };
  reader.readAsDataURL(file);
};

const onSubmit = async () => {
  loading.value = true;
  try {
    if (!formData.value.acceptTerms) {
      throw new Error(String(t('mustAcceptTermsToContinue')));
    }
    if (!formData.value.country) {
      throw new Error('Country is required');
    }
    if (!formData.value.language) {
      throw new Error('Language is required');
    }
    
    const payload = {
      // Required by current backend
      firstName: formData.value.displayName || '',
      lastName: '',
      reason: 'Community signup',
      // Additional/optional
      preferredName: formData.value.displayName || '',
      email: formData.value.email || '',
      profileImage: formData.value.profileImage,
      affiliations: formData.value.interests?.length
        ? formData.value.interests.join(', ')
        : '',
      country: formData.value.country,
      language: formData.value.language
    };
    await authStore.registerWithSeed(payload);
    showDialog.value = false;
    router.push('/');
    // showMnemonic.value = true;
    $q.notify({
      color: 'positive',
      message: t('registrationSuccess'),
      icon: 'check'
    });
  } catch (error) {
    $q.notify({
      color: 'negative',
      message: error instanceof Error ? error.message : String(t('registrationFailed')),
      icon: 'error'
    });
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
@keyframes fadeIn {
  from { opacity: 0;}
  to   { opacity: 1;}
}

.fade-in-1, .fade-in-2, .fade-in-3 {
  opacity: 0;
  animation: fadeIn 0.7s ease forwards;
}

.fade-in-1 { animation-delay: 0.2s; }
.fade-in-2 { animation-delay: 1s; }
.fade-in-3 { animation-delay: 1.5s; }

.hidden {
  display: none;
}

.card-soft {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(4px);
}

@keyframes scaleIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.scale-in {
  animation: scaleIn 0.5s ease-out forwards;
}

.powered-badge {
  display: inline-block;
  background: #000;
  color: #fff;
  margin: 10px;
  padding: 10px 10px;
  font-weight: 800;
  font-size: 16px;
}
</style>
