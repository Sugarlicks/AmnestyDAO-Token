<template>
  <q-page class="admin-campaigns-page">
    <div class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="ls-1">{{ $t('manageCampaigns') }}</div>
        <div class="row q-gutter-sm">
          <ImportCsvButton :import-type="'campaigns'" :on-import-success="handleImportSuccess" />
          <q-btn
            color="primary"
            icon="add"
            :label="$t('addCampaign')"
            unelevated
            rounded
            @click="openEditDialog()"
            :size="isMobile ? 'sm' : 'md'"
            class="text-black q-mt-md"
          />
        </div>
      </div>
    </div>

    <!-- Campaigns Table -->
    <div class="q-pt-none q-px-md">
      <q-table
        :rows="campaigns"
        :columns="columns"
        row-key="id"
        :loading="loading"
        :filter="searchQuery"
        class="campaigns-table"
        flat
        bordered
      >
      <template v-slot:top>
        <div class="row items-center justify-between full-width">
          <div class="row items-center q-gutter-sm">
            <q-input
              v-model="searchQuery"
              dense
              outlined
              :placeholder="$t('searchCampaigns')"
              class="q-mr-sm"
              :style="{ width: isMobile ? '150px' : '250px' }"
            >
              <template v-slot:append>
                <q-icon name="search" />
              </template>
            </q-input>
            <q-btn
              flat
              color="primary"
              icon="refresh"
              round
              @click="loadCampaigns"
              :loading="loading"
              class="text-black"
            />
          </div>
        </div>
      </template>

      <template v-slot:body-cell-image="props">
        <q-td :props="props">
          <q-img
            v-if="props.value"
            :src="props.value"
            style="width: 80px; height: 60px; object-fit: cover; border-radius: 4px;"
          />
          <q-icon v-else name="image" size="40px" color="grey-4" />
        </q-td>
      </template>

      <template v-slot:body-cell-progress="props">
        <q-td :props="props">
          <span>{{ Math.round(props.value) }}%</span>
        </q-td>
      </template>

      <template v-slot:body-cell-isActive="props">
        <q-td :props="props">
          <q-toggle
            v-model="props.value"
            color="secondary"
            @update:model-value="updateCampaignStatus(props.row.id, $event)"
            :loading="props.row.updating"
          />
        </q-td>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            flat
            round
            icon="edit"
            size="sm"
            @click="openEditDialog(props.row)"
            class="q-mr-xs"
          />
          <q-btn
            flat
            round
            icon="delete"
            color="negative"
            size="sm"
            @click="confirmDelete(props.row)"
          />
        </q-td>
      </template>
      </q-table>
    </div>

    <!-- Edit/Create Dialog -->
    <q-dialog v-model="editDialog" :maximized="isMobile">
      <q-card :style="isMobile ? '' : 'min-width: 600px'" style="background: #f9f9f9;">
        <q-card-section class="q-pb-none">
          <div class="row items-center no-wrap">
            <q-btn flat round icon="arrow_back" v-close-popup />
            <q-avatar size="30px" class="q-ml-sm" color="warning">
              <q-icon name="edit" size="18px" />
            </q-avatar>
            <div class="column q-ml-sm">
              <div class="text-subtitle1 text-weight-bold">
                {{ editingCampaign.id ? $t('editCampaign') : $t('createCampaign') }}
              </div>
              <div class="text-caption text-grey-7">
                {{ editingCampaign.id ? $t('updateCampaignDetails') : $t('addNewCampaign') }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="saveCampaign" class="q-gutter-md">
            <p class="text-subtitle2 q-mb-xs">{{ $t('title') }} *</p>
            <q-input
              v-model="editingCampaign.title"
              :placeholder="$t('enterCampaignTitle')"
              filled
              dense
              :rules="[val => !!val || t('titleRequired')]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('description') }} *</p>
            <q-input
              v-model="editingCampaign.description"
              :placeholder="$t('enterCampaignDescription')"
              filled
              dense
              type="textarea"
              rows="3"
              :rules="[val => !!val || t('descriptionRequired')]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('fullDetails') }}</p>
            <q-input
              v-model="editingCampaign.fullDetails"
              :placeholder="$t('enterFullDetailsOptional')"
              filled
              dense
              type="textarea"
              rows="5"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('goalTokens') }} *</p>
            <q-input
              v-model.number="editingCampaign.goalTokens"
              placeholder="0"
              filled
              dense
              type="number"
              min="0"
              step="0.01"
              :rules="[val => val > 0 || t('goalTokensRequired')]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('category') }} *</p>
            <q-select
              v-model="editingCampaign.category"
              :options="categoryOptions"
              filled
              dense
              emit-value
              map-options
              :rules="[val => !!val || t('categoryRequired')]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('campaignUrl') }}</p>
            <q-input
              v-model="editingCampaign.campaignUrl"
              :placeholder="$t('campaignUrlPlaceholder')"
              filled
              dense
              type="url"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('deadline') }}</p>
            <q-input
              v-model="editingCampaign.deadline"
              filled
              dense
              type="datetime-local"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('country') }}</p>
            <q-select
              v-model="editingCampaign.country"
              :options="countryOptions"
              option-value="code"
              option-label="name"
              emit-value
              map-options
              filled
              dense
              clearable
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('language') }}</p>
            <q-select
              v-model="editingCampaign.language"
              :options="languageOptions"
              option-value="code"
              option-label="name"
              emit-value
              map-options
              filled
              dense
              clearable
            />

            <!-- Image Upload -->
            <div class="q-mt-lg">
              <p class="text-subtitle2 q-mb-xs">{{ $t('image') }}</p>
              <div class="row justify-center q-mb-md">
                <q-avatar color="grey-3" size="120px" class="cursor-pointer" @click="triggerImageInput">
                  <q-img
                    v-if="campaignImagePreview"
                    :src="campaignImagePreview"
                    style="width: 100%; height: 100%; object-fit: cover;"
                  />
                  <q-icon v-else name="image" size="48px" color="grey-5" />
                  <q-file
                    ref="imageFileInput"
                    v-model="imageFile"
                    accept="image/*"
                    class="hidden"
                    max-file-size="5242880"
                    @rejected="onImageRejected"
                    @update:model-value="handleImageUpload"
                  />
                </q-avatar>
              </div>
            </div>

            <q-toggle
              v-model="editingCampaign.isActive"
              :label="$t('active')"
              class="q-mt-md"
            />

            <q-btn
              :label="editingCampaign.id ? $t('updateCampaign') : $t('createCampaign')"
              type="submit"
              unelevated
              class="q-mt-md"
              :loading="saving"
              :style="'width: 100%; background: #FFFF00; color: #000;'"
            />

            <div class="row justify-end q-mt-md">
              <q-btn
                :label="$t('cancel')"
                flat
                v-close-popup
                :style="'color: #666;'"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="deleteDialog">
      <q-card>
        <q-card-section class="row items-center">
          <q-icon name="warning" color="negative" size="2em" />
          <span class="q-ml-sm">{{ $t('areYouSureDeleteCampaign') }}</span>
        </q-card-section>

        <q-card-section>
          <div class="text-body2">
            <strong>{{ campaignToDelete?.title }}</strong>
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ $t('actionCannotBeUndone') }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('cancel')" color="grey-7" v-close-popup />
          <q-btn
            flat
            :label="$t('delete')"
            color="negative"
            @click="deleteCampaign"
            :loading="deleting"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { QTableColumn, QFile } from 'quasar';
import { useCampaignsStore, type Campaign } from '../stores/campaigns';
import { useApolloStore } from '../stores/apollo';
import { useAuthStore } from '../stores/auth';
import { useLocaleStore } from '../stores/locale';
import { useQuasar } from 'quasar';
import { gql } from '@apollo/client/core';
import { useI18n } from 'vue-i18n';
import { imageDataToBase64 } from '../utils/imageUtils';
import ImportCsvButton from '../components/ImportCsvButton.vue';

const { t } = useI18n();

defineOptions({
  name: 'AdminCampaigns'
});

const $q = useQuasar();
const campaignsStore = useCampaignsStore();
const apolloStore = useApolloStore();
const authStore = useAuthStore();
const localeStore = useLocaleStore();
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const searchQuery = ref('');
const isMobile = ref($q.screen.lt.sm);

const campaigns = ref<(Campaign & { updating?: boolean; progress?: number })[]>([]);
const editDialog = ref(false);
const deleteDialog = ref(false);
const campaignToDelete = ref<Campaign | null>(null);
const imageFile = ref<File | null>(null);
const imageFileInput = ref<InstanceType<typeof QFile> | null>(null);
const campaignImagePreview = ref<string | null>(null);

const categoryOptions = computed(() => [
  { label: t('interestFreedomOfExpression'), value: 'Freedom of Expression' },
  { label: t('interestEnvironmentalRights'), value: 'Environmental Rights' },
  { label: t('interestChildrensRights'), value: 'Children\'s Rights' },
  { label: t('interestRefugeeRights'), value: 'Refugee Rights' },
  { label: t('interestWomensRights'), value: 'Women\'s Rights' },
  { label: t('interestLGBTQRights'), value: 'LGBTQ+ Rights' },
  { label: t('interestDigitalRights'), value: 'Digital Rights' },
  { label: t('interestEconomicJustice'), value: 'Economic Justice' },
  { label: 'Other', value: 'Other' }
]);

const countryOptions = computed(() => localeStore.availableCountries);
const languageOptions = computed(() => localeStore.availableLocales);

const editingCampaign = ref<Partial<Campaign>>({
  title: '',
  description: '',
  fullDetails: '',
  goalTokens: 0,
  category: '',
  campaignUrl: '',
  deadline: '',
  country: null,
  language: null,
  isActive: true,
  imageData: null
});

const columns: QTableColumn[] = [
  {
    name: 'image',
    label: t('image'),
    field: 'image',
    align: 'center',
    sortable: false
  },
  {
    name: 'title',
    label: t('title'),
    field: 'title',
    align: 'left',
    sortable: true
  },
  {
    name: 'category',
    label: t('category'),
    field: 'category',
    align: 'left',
    sortable: true
  },
  {
    name: 'goalTokens',
    label: t('goalTokens'),
    field: 'goalTokens',
    align: 'right',
    sortable: true,
    format: (val: number) => `${val.toLocaleString()} HR`
  },
  {
    name: 'tokensRaised',
    label: t('tokensRaised'),
    field: 'tokensRaised',
    align: 'right',
    sortable: true,
    format: (val: number) => `${val.toLocaleString()} HR`
  },
  {
    name: 'progress',
    label: t('progress'),
    field: 'progress',
    align: 'right',
    sortable: true,
    format: (val: number) => `${Math.round(val)}%`
  },
  {
    name: 'supporterCount',
    label: t('supporters'),
    field: 'supporterCount',
    align: 'right',
    sortable: true
  },
  {
    name: 'isActive',
    label: t('active'),
    field: 'isActive',
    align: 'center',
    sortable: true
  },
  {
    name: 'actions',
    label: t('actions'),
    field: 'actions',
    align: 'center',
    sortable: false
  }
];

const loadCampaigns = async () => {
  if (!apolloStore.client || !authStore.jwt) {
    $q.notify({
      type: 'negative',
      message: t('notAuthenticated')
    });
    return;
  }

  loading.value = true;
  try {
    // Fetch all campaigns (including inactive) for admin
    const result = await apolloStore.client.query({
      query: gql`
        query GetAllCampaigns {
          campaigns {
            id
            title
            description
            full_details
            image_url
            image_data
            goal_tokens
            tokens_raised
            category
            country
            language
            deadline
            supporter_count
            campaign_url
            is_active
            created_at
            updated_at
            created_by
          }
        }
      `,
      fetchPolicy: 'network-only',
      context: {
        headers: {
          Authorization: `Bearer ${authStore.jwt}`
        }
      }
    });

    campaigns.value = result.data.campaigns.map((c: any) => {
      const goalTokens = parseFloat(c.goal_tokens);
      const tokensRaised = parseFloat(c.tokens_raised);
      const progress = goalTokens > 0 ? (tokensRaised / goalTokens) * 100 : 0;
      
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        fullDetails: c.full_details,
        imageUrl: c.image_url,
        imageData: c.image_data,
        goalTokens,
        tokensRaised,
        category: c.category,
        country: c.country,
        language: c.language,
        deadline: c.deadline,
        supporterCount: c.supporter_count || 0,
        campaignUrl: c.campaign_url,
        isActive: c.is_active,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        createdBy: c.created_by,
        updating: false,
        progress,
        image: campaignsStore.getCampaignImageUrl({
          imageUrl: c.image_url,
          imageData: c.image_data
        } as Campaign)
      };
    });
  } catch (error: any) {
    console.error('Failed to load campaigns:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadCampaigns')
    });
  } finally {
    loading.value = false;
  }
};

const convertImageDataToString = (imageData: string | { data: number[], type: string } | null | undefined): string | null => {
  // Use unified image utility for conversion
  return imageDataToBase64(imageData);
};

const openEditDialog = (campaign?: Campaign) => {
  if (campaign) {
    editingCampaign.value = {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      fullDetails: campaign.fullDetails || '',
      goalTokens: campaign.goalTokens,
      category: campaign.category || '',
      campaignUrl: campaign.campaignUrl || '',
      deadline: campaign.deadline ? new Date(campaign.deadline).toISOString().slice(0, 16) : '',
      country: campaign.country || null,
      language: campaign.language || null,
      isActive: campaign.isActive,
      imageData: convertImageDataToString(campaign.imageData)
    };
    campaignImagePreview.value = campaignsStore.getCampaignImageUrl(campaign);
  } else {
    editingCampaign.value = {
      title: '',
      description: '',
      fullDetails: '',
      goalTokens: 0,
      category: '',
      campaignUrl: '',
      deadline: '',
      country: null,
      language: null,
      isActive: true,
      imageData: null
    };
    campaignImagePreview.value = null;
  }
  imageFile.value = null;
  editDialog.value = true;
};

const triggerImageInput = () => {
  imageFileInput.value?.pickFiles();
};

const handleImageUpload = (file: File | null) => {
  if (!file) return;
  campaignImagePreview.value = URL.createObjectURL(file);
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result as string;
    const base64Data = base64String.split(',')[1];
    editingCampaign.value.imageData = base64Data;
  };
  reader.readAsDataURL(file);
};

const onImageRejected = () => {
  $q.notify({
    type: 'negative',
    message: t('fileTooLarge')
  });
};

const saveCampaign = async () => {
  if (!apolloStore.client || !authStore.jwt || !authStore.userId) {
    $q.notify({
      type: 'negative',
      message: t('notAuthenticated')
    });
    return;
  }

  saving.value = true;
  try {
    const variables: any = {
      title: editingCampaign.value.title,
      description: editingCampaign.value.description,
      full_details: editingCampaign.value.fullDetails || null,
      goal_tokens: editingCampaign.value.goalTokens?.toString(),
      category: editingCampaign.value.category || null,
      campaign_url: editingCampaign.value.campaignUrl || null,
      deadline: editingCampaign.value.deadline ? new Date(editingCampaign.value.deadline).toISOString() : null,
      country: editingCampaign.value.country || null,
      language: editingCampaign.value.language || null,
      is_active: editingCampaign.value.isActive ?? true
    };

    if (!editingCampaign.value.id) {
      variables.created_by = authStore.userId;
    }

    if (editingCampaign.value.imageData) {
      variables.image_data = editingCampaign.value.imageData;
    }

    let mutation;
    if (editingCampaign.value.id) {
      mutation = gql`
        mutation UpdateCampaign($id: uuid!, $object: campaigns_set_input!) {
          update_campaigns_by_pk(pk_columns: { id: $id }, _set: $object) {
            id
          }
        }
      `;
      await apolloStore.client.mutate({
        mutation,
        variables: {
          id: editingCampaign.value.id,
          object: variables
        },
        context: {
          headers: {
            Authorization: `Bearer ${authStore.jwt}`
          }
        }
      });
    } else {
      mutation = gql`
        mutation CreateCampaign($object: campaigns_insert_input!) {
          insert_campaigns_one(object: $object) {
            id
          }
        }
      `;
      await apolloStore.client.mutate({
        mutation,
        variables: { object: variables },
        context: {
          headers: {
            Authorization: `Bearer ${authStore.jwt}`
          }
        }
      });
    }

    $q.notify({
      type: 'positive',
      message: t('campaignUpdatedSuccessfully', [editingCampaign.value.id ? t('campaignUpdated') : t('campaignCreated')])
    });

    editDialog.value = false;
    await loadCampaigns();
    // Also refresh the store so CampaignsList page sees the changes
    await campaignsStore.fetchCampaigns();
  } catch (error: any) {
    console.error('Failed to save campaign:', error);
    $q.notify({
      type: 'negative',
      message: error.message || t('failedToSaveCampaign')
    });
  } finally {
    saving.value = false;
  }
};

const updateCampaignStatus = async (id: string, isActive: boolean) => {
  if (!apolloStore.client || !authStore.jwt) {
    return;
  }

  const campaign = campaigns.value.find(c => c.id === id);
  if (campaign) {
    campaign.updating = true;
  }

  try {
    await apolloStore.client.mutate({
      mutation: gql`
        mutation UpdateCampaignStatus($id: uuid!, $isActive: Boolean!) {
          update_campaigns_by_pk(pk_columns: { id: $id }, _set: { is_active: $isActive }) {
            id
          }
        }
      `,
      variables: { id, isActive },
      context: {
        headers: {
          Authorization: `Bearer ${authStore.jwt}`
        }
      }
    });

    $q.notify({
      type: 'positive',
      message: t('campaignStatusUpdated')
    });
    // Also refresh the store so CampaignsList page sees the changes
    await campaignsStore.fetchCampaigns();
  } catch (error: any) {
    console.error('Failed to update campaign status:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToUpdateCampaignStatus')
    });
    // Revert the toggle
    if (campaign) {
      campaign.isActive = !isActive;
    }
  } finally {
    if (campaign) {
      campaign.updating = false;
    }
  }
};

const confirmDelete = (campaign: Campaign) => {
  campaignToDelete.value = campaign;
  deleteDialog.value = true;
};

const deleteCampaign = async () => {
  if (!campaignToDelete.value || !apolloStore.client || !authStore.jwt) {
    return;
  }

  deleting.value = true;
  try {
    await apolloStore.client.mutate({
      mutation: gql`
        mutation DeleteCampaign($id: uuid!) {
          delete_campaigns_by_pk(id: $id) {
            id
          }
        }
      `,
      variables: { id: campaignToDelete.value.id },
      context: {
        headers: {
          Authorization: `Bearer ${authStore.jwt}`
        }
      }
    });

    $q.notify({
      type: 'positive',
      message: t('campaignDeletedSuccessfully')
    });

    deleteDialog.value = false;
    await loadCampaigns();
    // Also refresh the store so CampaignsList page sees the changes
    await campaignsStore.fetchCampaigns();
  } catch (error: any) {
    console.error('Failed to delete campaign:', error);
    $q.notify({
      type: 'negative',
      message: error.message || t('failedToDeleteCampaign')
    });
  } finally {
    deleting.value = false;
  }
};

const handleImportSuccess = async () => {
  await loadCampaigns();
  // Also refresh the store so CampaignsList page sees the changes
  await campaignsStore.fetchCampaigns();
};

onMounted(async () => {
  await loadCampaigns();
});
</script>

<style scoped lang="scss">
.admin-campaigns-page {
  background-color: #f5f5f5;
}
</style>

