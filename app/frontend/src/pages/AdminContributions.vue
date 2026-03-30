<template>
  <q-page class="admin-contributions-page">
    <div class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="ls-1">{{ $t('manageContributions') }}</div>
        <div class="row q-gutter-sm">
          <ImportCsvButton :on-import-success="handleImportSuccess" />
          <q-btn
            color="primary"
            icon="add"
            :label="$t('addContribution')"
            unelevated
            rounded
            @click="openEditDialog()"
            :size="isMobile ? 'sm' : 'md'"
            class="text-black q-mt-md"
          />
        </div>
      </div>
    </div>

    <!-- Contributions Table -->
    <div class="q-pt-none q-px-md">
      <q-table
        :rows="contributions"
        :columns="columns"
        row-key="id"
        :loading="loading"
        :filter="searchQuery"
        class="contributions-table"
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
              :placeholder="$t('searchContributions')"
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
              @click="loadContributions"
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

      <template v-slot:body-cell-isActive="props">
        <q-td :props="props">
          {{ props.value ? $t('yes') : $t('no') }}
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
                {{ editingContribution.id ? $t('editContribution') : $t('createContribution') }}
              </div>
              <div class="text-caption text-grey-7">
                {{ editingContribution.id ? $t('updateContributionDetails') : $t('addNewContribution') }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="saveContribution" class="q-gutter-md">
            <p class="text-subtitle2 q-mb-xs">{{ $t('title') }} *</p>
            <q-input
              v-model="editingContribution.title"
              :placeholder="$t('enterContributionTitle')"
              filled
              dense
              :rules="[val => !!val || t('titleRequired')]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('description') }} *</p>
            <q-input
              v-model="editingContribution.description"
              :placeholder="$t('enterContributionDescription')"
              filled
              dense
              type="textarea"
              rows="3"
              :rules="[val => !!val || t('descriptionRequired')]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('fullDetails') }}</p>
            <q-input
              v-model="editingContribution.fullDetails"
              :placeholder="$t('enterFullDetailsOptional')"
              filled
              dense
              type="textarea"
              rows="5"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('type') }} *</p>
            <q-select
              v-model="editingContribution.contributionType"
              :options="contributionTypes"
              filled
              dense
              emit-value
              map-options
              :rules="[val => {
                const validTypes = ['visit', 'share', 'scan'];
                return !!val && validTypes.includes(val) || t('typeRequired');
              }]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('tokenReward') }} *</p>
            <q-input
              v-model.number="editingContribution.tokenReward"
              placeholder="0"
              filled
              dense
              type="number"
              min="0"
              step="0.01"
              :rules="[val => val >= 0 || t('tokenRewardRequired')]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('actionButtonText') }}</p>
            <q-input
              v-model="editingContribution.actionButtonText"
              :placeholder="$t('completeAction')"
              filled
              dense
            />
            <div class="text-caption text-grey-7 q-mt-xs">{{ $t('defaultCompleteAction') }}</div>

            <p class="text-subtitle2 q-mb-xs">
              {{ $t('externalLinkUrl') }}
              <span v-if="editingContribution.contributionType === 'visit' || editingContribution.contributionType === 'share'" class="text-negative">*</span>
            </p>
            <q-input
              v-model="editingContribution.externalLink"
              :placeholder="$t('enterUrl')"
              filled
              dense
              type="url"
              :rules="[
                val => {
                  if (editingContribution.contributionType === 'visit' || editingContribution.contributionType === 'share') {
                    return !!val || t('urlRequiredForType');
                  }
                  return true;
                }
              ]"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('deadline') }}</p>
            <q-input
              v-model="editingContribution.deadline"
              filled
              dense
              type="datetime-local"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('targetParticipants') }}</p>
            <q-input
              v-model.number="editingContribution.targetParticipants"
              placeholder="0"
              filled
              dense
              type="number"
              min="0"
            />

            <p class="text-subtitle2 q-mb-xs">{{ $t('country') }}</p>
            <q-select
              v-model="editingContribution.country"
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
              v-model="editingContribution.language"
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
                    v-if="contributionImagePreview"
                    :src="contributionImagePreview"
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
              v-model="editingContribution.isActive"
              :label="$t('active')"
              class="q-mt-md"
            />

            <q-btn
              :label="editingContribution.id ? $t('updateContribution') : $t('createContribution')"
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
          <span class="q-ml-sm">{{ $t('areYouSureDelete') }}</span>
        </q-card-section>

        <q-card-section>
          <div class="text-body2">
            <strong>{{ contributionToDelete?.title }}</strong>
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
            @click="deleteContribution"
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
import { useContributionsStore, type Contribution } from '../stores/contributions';
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
  name: 'AdminContributions'
});

const $q = useQuasar();
const contributionsStore = useContributionsStore();
const apolloStore = useApolloStore();
const authStore = useAuthStore();
const localeStore = useLocaleStore();
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const searchQuery = ref('');
const isMobile = ref($q.screen.lt.sm);

const contributions = ref<(Contribution & { updating?: boolean })[]>([]);
const editDialog = ref(false);
const deleteDialog = ref(false);
const contributionToDelete = ref<Contribution | null>(null);
const imageFile = ref<File | null>(null);
const imageFileInput = ref<InstanceType<typeof QFile> | null>(null);
const contributionImagePreview = ref<string | null>(null);

const contributionTypes = computed(() => [
  { label: t('contributionTypeVisit'), value: 'visit' },
  { label: t('contributionTypeShare'), value: 'share' },
  { label: t('contributionTypeScan'), value: 'scan' }
]);

const countryOptions = computed(() => localeStore.availableCountries);
const languageOptions = computed(() => localeStore.availableLocales);

const editingContribution = ref<Partial<Contribution>>({
  title: '',
  description: '',
  fullDetails: '',
  contributionType: 'visit',
  tokenReward: 0,
  actionButtonText: 'Complete Action',
  externalLink: '',
  deadline: '',
  targetParticipants: undefined,
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
    name: 'contributionType',
    label: t('type'),
    field: 'contributionType',
    align: 'left',
    sortable: true
  },
  {
    name: 'tokenReward',
    label: t('reward'),
    field: 'tokenReward',
    align: 'right',
    sortable: true,
    format: (val: number) => `${val} HR`
  },
  {
    name: 'currentParticipants',
    label: t('participants'),
    field: 'currentParticipants',
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

const loadContributions = async () => {
  if (!apolloStore.client || !authStore.jwt) {
    $q.notify({
      type: 'negative',
      message: t('notAuthenticated')
    });
    return;
  }

  loading.value = true;
  try {
    // Fetch all contributions (including inactive) for admin
    const result = await apolloStore.client.query({
      query: gql`
        query GetAllContributions {
          contributions(order_by: [{ is_active: desc }, { created_at: desc }]) {
            id
            title
            description
            full_details
            image_url
            image_data
            token_reward
            contribution_type
            action_button_text
            external_link
            deadline
            target_participants
            current_participants
            country
            language
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

    contributions.value = result.data.contributions.map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      fullDetails: c.full_details,
      imageUrl: c.image_url,
      imageData: c.image_data,
      tokenReward: parseFloat(c.token_reward),
      contributionType: c.contribution_type,
      actionButtonText: c.action_button_text || t('completeAction'),
      externalLink: c.external_link,
      deadline: c.deadline,
      targetParticipants: c.target_participants,
      currentParticipants: c.current_participants || 0,
      country: c.country,
      language: c.language,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      createdBy: c.created_by,
      updating: false,
      image: contributionsStore.getContributionImageUrl({
        imageUrl: c.image_url,
        imageData: c.image_data
      } as Contribution)
    }));
  } catch (error: any) {
    console.error('Failed to load contributions:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadContributions')
    });
  } finally {
    loading.value = false;
  }
};

const convertImageDataToString = (imageData: string | { data: number[], type: string } | null | undefined): string | null => {
  // Use unified image utility for conversion
  return imageDataToBase64(imageData);
};

const openEditDialog = async (contribution?: Contribution) => {

  if (contribution && contribution.id) {
    // Fetch the full contribution data to ensure we have all fields
    try {
      const fullContribution = await contributionsStore.fetchContributionById(contribution.id);
      
      // Ensure all fields have proper defaults to avoid empty form
      editingContribution.value = {
        id: fullContribution.id,
        title: fullContribution.title || '',
        description: fullContribution.description || '',
        fullDetails: fullContribution.fullDetails || '',
        contributionType: fullContribution.contributionType || 'visit',
        tokenReward: fullContribution.tokenReward ?? 0,
        actionButtonText: fullContribution.actionButtonText || t('completeAction'),
        externalLink: fullContribution.externalLink || '',
        deadline: fullContribution.deadline ? new Date(fullContribution.deadline).toISOString().slice(0, 16) : '',
        targetParticipants: fullContribution.targetParticipants ?? undefined,
        country: fullContribution.country || null,
        language: fullContribution.language || null,
        isActive: fullContribution.isActive ?? true,
        imageData: convertImageDataToString(fullContribution.imageData)
      };
      contributionImagePreview.value = contributionsStore.getContributionImageUrl(fullContribution);
    } catch (error) {
      console.error('Failed to fetch contribution details:', error);
      // Fallback to using the contribution from the table row
      editingContribution.value = {
        id: contribution.id,
        title: contribution.title || '',
        description: contribution.description || '',
        fullDetails: contribution.fullDetails || '',
        contributionType: contribution.contributionType || 'visit',
        tokenReward: contribution.tokenReward ?? 0,
        actionButtonText: contribution.actionButtonText || t('completeAction'),
        externalLink: contribution.externalLink || '',
        deadline: contribution.deadline ? new Date(contribution.deadline).toISOString().slice(0, 16) : '',
        targetParticipants: contribution.targetParticipants ?? undefined,
        country: contribution.country || null,
        language: contribution.language || null,
        isActive: contribution.isActive ?? true,
        imageData: convertImageDataToString(contribution.imageData)
      };
      contributionImagePreview.value = contributionsStore.getContributionImageUrl(contribution);
    }
  } else {
    editingContribution.value = {
      title: '',
      description: '',
      fullDetails: '',
      contributionType: 'visit',
      tokenReward: 0,
      actionButtonText: t('completeAction'),
      externalLink: '',
      deadline: '',
      targetParticipants: undefined,
      country: null,
      language: null,
      isActive: true,
      imageData: null
    };
    contributionImagePreview.value = null;
  }
  imageFile.value = null;
  editDialog.value = true;
};

const triggerImageInput = () => {
  imageFileInput.value?.pickFiles();
};

const handleImageUpload = (file: File | null) => {
  if (!file) return;
  contributionImagePreview.value = URL.createObjectURL(file);
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result as string;
    const base64Data = base64String.split(',')[1];
    editingContribution.value.imageData = base64Data;
  };
  reader.readAsDataURL(file);
};

const onImageRejected = () => {
  $q.notify({
    type: 'negative',
    message: t('fileTooLarge')
  });
};

const saveContribution = async () => {
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
      title: editingContribution.value.title,
      description: editingContribution.value.description,
      full_details: editingContribution.value.fullDetails || null,
      contribution_type: editingContribution.value.contributionType,
      token_reward: editingContribution.value.tokenReward?.toString(),
      action_button_text: editingContribution.value.actionButtonText || 'Complete Action',
      external_link: editingContribution.value.externalLink || null,
      deadline: editingContribution.value.deadline ? new Date(editingContribution.value.deadline).toISOString() : null,
      target_participants: editingContribution.value.targetParticipants || null,
      country: editingContribution.value.country || null,
      language: editingContribution.value.language || null,
      is_active: editingContribution.value.isActive ?? true
    };

    // Only include created_by when creating a new contribution, not when updating
    if (!editingContribution.value.id) {
      variables.created_by = authStore.userId;
    }

    if (editingContribution.value.imageData) {
      // Convert base64 to bytea format for Hasura
      // Note: Hasura expects image_data as base64 string, we'll handle it in the mutation
      variables.image_data = editingContribution.value.imageData;
    }

    let mutation;
    if (editingContribution.value.id) {
      // Update
      mutation = gql`
        mutation UpdateContribution($id: uuid!, $object: contributions_set_input!) {
          update_contributions_by_pk(pk_columns: { id: $id }, _set: $object) {
            id
          }
        }
      `;
      await apolloStore.client.mutate({
        mutation,
        variables: {
          id: editingContribution.value.id,
          object: variables
        },
        context: {
          headers: {
            Authorization: `Bearer ${authStore.jwt}`
          }
        }
      });
    } else {
      // Create
      mutation = gql`
        mutation CreateContribution($object: contributions_insert_input!) {
          insert_contributions_one(object: $object) {
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
      message: t('contributionUpdatedSuccessfully', [editingContribution.value.id ? t('contributionUpdated') : t('contributionCreated')])
    });

    editDialog.value = false;
    await loadContributions();
    // Also refresh the store so ContributionsList page sees the changes
    await contributionsStore.fetchContributions();
  } catch (error: any) {
    console.error('Failed to save contribution:', error);
    $q.notify({
      type: 'negative',
      message: error.message || t('failedToSaveContribution')
    });
  } finally {
    saving.value = false;
  }
};

const updateContributionStatus = async (id: string, isActive: boolean) => {
  if (!apolloStore.client || !authStore.jwt) {
    return;
  }

  const contribution = contributions.value.find(c => c.id === id);
  if (contribution) {
    contribution.updating = true;
  }

  try {
    await apolloStore.client.mutate({
      mutation: gql`
        mutation UpdateContributionStatus($id: uuid!, $isActive: Boolean!) {
          update_contributions_by_pk(pk_columns: { id: $id }, _set: { is_active: $isActive }) {
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

    if (contribution) {
      contribution.isActive = isActive;
    }
    // Also refresh the store so ContributionsList page sees the changes
    await contributionsStore.fetchContributions();
  } catch (error: any) {
    console.error('Failed to update contribution status:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToUpdateContributionStatus')
    });
    // Revert toggle
    if (contribution) {
      contribution.isActive = !isActive;
    }
  } finally {
    if (contribution) {
      contribution.updating = false;
    }
  }
};

const confirmDelete = (contribution: Contribution) => {
  contributionToDelete.value = contribution;
  deleteDialog.value = true;
};

const deleteContribution = async () => {
  if (!contributionToDelete.value || !apolloStore.client || !authStore.jwt) {
    return;
  }

  deleting.value = true;
  try {
    await apolloStore.client.mutate({
      mutation: gql`
        mutation DeleteContribution($id: uuid!) {
          delete_contributions_by_pk(id: $id) {
            id
          }
        }
      `,
      variables: { id: contributionToDelete.value.id },
      context: {
        headers: {
          Authorization: `Bearer ${authStore.jwt}`
        }
      }
    });

    $q.notify({
      type: 'positive',
      message: t('contributionDeletedSuccessfully')
    });

    deleteDialog.value = false;
    contributionToDelete.value = null;
    await loadContributions();
    // Also refresh the store so ContributionsList page sees the changes
    await contributionsStore.fetchContributions();
  } catch (error: any) {
    console.error('Failed to delete contribution:', error);
    $q.notify({
      type: 'negative',
      message: error.message || t('failedToDeleteContribution')
    });
  } finally {
    deleting.value = false;
  }
};

const handleImportSuccess = async () => {
  await loadContributions();
  // Also refresh the store so ContributionsList page sees the changes
  await contributionsStore.fetchContributions();
};

onMounted(async () => {
  await loadContributions();
});
</script>

<style scoped lang="scss">
.admin-contributions-page {
  background-color: #f5f5f5;
}

.contributions-table {
  background-color: white;
  border-radius: 12px;
}

.hidden {
  display: none;
}
</style>

