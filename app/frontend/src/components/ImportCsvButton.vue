<template>
  <div>
    <q-btn
      color="primary"
      icon="upload_file"
      :label="$t('importCSV')"
      unelevated
      rounded
      @click="openCSVImportDialog()"
      :size="isMobile ? 'sm' : 'md'"
      class="text-black q-mt-md"
    />

    <!-- CSV Import Dialog -->
    <q-dialog v-model="csvImportDialog" :maximized="isMobile">
      <q-card :style="isMobile ? '' : 'min-width: 600px'" style="background: #f9f9f9;">
        <q-card-section class="q-pb-none">
          <div class="row items-center no-wrap">
            <q-btn flat round icon="arrow_back" v-close-popup />
            <q-avatar size="30px" class="q-ml-sm" color="primary">
              <q-icon name="upload_file" size="18px" />
            </q-avatar>
            <div class="column q-ml-sm">
              <div class="text-subtitle1 text-weight-bold">
                {{ importType === 'campaigns' ? $t('importCampaignsFromCSV') : $t('importActionsFromCSV') }}
              </div>
              <div class="text-caption text-grey-7">
                {{ importType === 'campaigns' ? $t('uploadCSVFileToCreateCampaigns') : $t('uploadCSVFileToCreateActions') }}
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md">
            <div class="row items-center justify-between q-mb-sm">
              <p class="text-body2 q-mb-none">{{ $t('csvFormatInstructions') }}:</p>
              <q-btn
                flat
                dense
                icon="download"
                :label="$t('downloadTemplate')"
                color="accent"
                size="sm"
                @click="downloadTemplate"
              />
            </div>
            <div class="text-caption text-grey-7 q-mb-md">
              <div v-if="importType === 'actions'">
                <div>{{ $t('requiredHeaders') }}: country, language, title, description, full details, link, type, reward, action button text, image url</div>
                <div class="q-mt-xs">{{ $t('typeMustBe') }}: visit, share, or scan</div>
              </div>
              <div v-else>
                <div>{{ $t('requiredHeaders') }}: country, language, title, description, full details, goal tokens, category, campaign url, deadline, image url</div>
                <div class="q-mt-xs">{{ $t('categoryMustBe') }}: Freedom of Expression, Environmental Rights, Children's Rights, Refugee Rights, Women's Rights, LGBTQ+ Rights, Digital Rights, Economic Justice, Other</div>
              </div>
            </div>
          </div>

          <q-file
            v-model="csvFile"
            :label="$t('selectCSVFile')"
            accept=".csv"
            filled
            dense
            @update:model-value="handleCSVFileSelect"
            class="q-mb-md"
          >
            <template v-slot:prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>

          <div v-if="csvPreview.length > 0" class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">{{ $t('preview') }} ({{ csvPreview.length }} {{ importType === 'campaigns' ? $t('campaigns') : $t('actions') }})</div>
            <q-table
              :rows="csvPreview.slice(0, 5)"
              :columns="csvPreviewColumns"
              row-key="index"
              flat
              bordered
              dense
              :rows-per-page-options="[5]"
              hide-pagination
            />
            <div v-if="csvPreview.length > 5" class="text-caption text-grey-7 q-mt-sm">
              {{ $t('showingFirst5Of') }} {{ csvPreview.length }} {{ importType === 'campaigns' ? $t('campaigns') : $t('actions') }}
            </div>
          </div>

          <div v-if="csvImportErrors.length > 0" class="q-mb-md">
            <q-banner class="bg-negative text-white">
              <template v-slot:avatar>
                <q-icon name="error" />
              </template>
              <div class="text-subtitle2 q-mb-sm">{{ $t('errorsFound') }}:</div>
              <ul class="q-pl-md">
                <li v-for="(error, index) in csvImportErrors" :key="index">{{ error }}</li>
              </ul>
            </q-banner>
          </div>

          <q-btn
            :label="importType === 'campaigns' ? $t('importCampaigns') : $t('importActions')"
            unelevated
            class="q-mt-md"
            :loading="importingCSV"
            :disable="csvPreview.length === 0 || csvImportErrors.length > 0"
            :style="'width: 100%; background: #FFFF00; color: #000;'"
            @click="importCSV"
          />

          <div class="row justify-end q-mt-md">
            <q-btn
              :label="$t('cancel')"
              flat
              v-close-popup
              :style="'color: #666;'"
            />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { QTableColumn, QFile } from 'quasar';
import { useApolloStore } from '../stores/apollo';
import { useAuthStore } from '../stores/auth';
import { useLocaleStore } from '../stores/locale';
import { useQuasar } from 'quasar';
import { gql } from '@apollo/client/core';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineOptions({
  name: 'ImportCsvButton'
});

const props = defineProps<{
  importType?: 'actions' | 'campaigns';
  onImportSuccess?: () => void | Promise<void>;
}>();

const importType = computed(() => props.importType || 'actions');

const $q = useQuasar();
const apolloStore = useApolloStore();
const authStore = useAuthStore();
const localeStore = useLocaleStore();
const isMobile = ref($q.screen.lt.sm);

const csvImportDialog = ref(false);
const csvFile = ref<File | null>(null);
const csvPreview = ref<any[]>([]);
const csvImportErrors = ref<string[]>([]);
const importingCSV = ref(false);

const csvPreviewColumns = computed((): QTableColumn[] => {
  if (importType.value === 'campaigns') {
    return [
      {
        name: 'title',
        label: t('title'),
        field: 'title',
        align: 'left' as const
      },
      {
        name: 'category',
        label: t('category'),
        field: 'category',
        align: 'left' as const
      },
      {
        name: 'goalTokens',
        label: t('goalTokens'),
        field: 'goalTokens',
        align: 'right' as const
      }
    ];
  } else {
    return [
      {
        name: 'title',
        label: t('title'),
        field: 'title',
        align: 'left' as const
      },
      {
        name: 'type',
        label: t('type'),
        field: 'type',
        align: 'left' as const
      },
      {
        name: 'reward',
        label: t('reward'),
        field: 'reward',
        align: 'right' as const
      }
    ];
  }
});

// Helper function to normalize contribution type to ensure it matches database constraint
const normalizeContributionType = (type: string | undefined): 'visit' | 'share' | 'scan' => {
  const validTypes: ('visit' | 'share' | 'scan')[] = ['visit', 'share', 'scan'];
  if (!type) return 'visit';
  const normalized = type.trim().toLowerCase();
  return validTypes.includes(normalized as any) ? (normalized as 'visit' | 'share' | 'scan') : 'visit';
};

// CSV Import Functions
const openCSVImportDialog = () => {
  csvImportDialog.value = true;
  csvFile.value = null;
  csvPreview.value = [];
  csvImportErrors.value = [];
};

const downloadTemplate = () => {
  let headers: string[];
  let exampleRow: string[];

  if (importType.value === 'campaigns') {
    headers = [
      'country',
      'language',
      'title',
      'description',
      'full details',
      'goal tokens',
      'category',
      'campaign url',
      'deadline',
      'image url'
    ];
    exampleRow = [
      'aus',
      'en',
      'Example Campaign Title',
      'Short description of the campaign',
      'Full detailed information about the campaign',
      '1000',
      'Freedom of Expression',
      'https://example.com/campaign',
      '2025-12-31T23:59:59',
      'https://example.com/image.jpg'
    ];
  } else {
    headers = [
      'country',
      'language',
      'title',
      'description',
      'full details',
      'link',
      'type',
      'reward',
      'action button text',
      'image url'
    ];
    exampleRow = [
      'aus',
      'en',
      'Example Action Title',
      'Short description of the action',
      'Full detailed information about the action',
      'https://example.com/action',
      'visit',
      '10',
      'Take Action',
      'https://example.com/image.jpg'
    ];
  }

  // Create CSV content
  const csvContent = [
    headers.join(','),
    exampleRow.map(field => {
      // Escape fields that contain commas, quotes, or newlines
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    }).join(',')
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', importType.value === 'campaigns' ? 'campaigns_template.csv' : 'actions_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const parseCSV = (csvText: string): any[] => {
  if (!csvText || csvText.trim().length === 0) return [];

  // Parse all rows first, handling multi-line quoted fields
  const rows = parseCSVRows(csvText);
  if (rows.length === 0) return [];

  // Parse header (first row)
  const headers = rows[0].map((h: string) => h.trim().toLowerCase());
  
  // Expected headers mapping based on import type
  const expectedHeaders = importType.value === 'campaigns' 
    ? [
        'country', 'language', 'title', 'description', 'full details',
        'goal tokens', 'category', 'campaign url', 'deadline', 'image url'
      ]
    : [
        'country', 'language', 'title', 'description', 'full details', 
        'link', 'type', 'reward', 'action button text', 'image url'
      ];

  // Validate headers
  const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    csvImportErrors.value.push(`Missing required headers: ${missingHeaders.join(', ')}`);
    return [];
  }

  // Parse data rows (skip header row)
  const data: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length === 0) continue;

    let row: any;
    if (importType.value === 'campaigns') {
      row = {
        index: i,
        country: getValueByHeader(headers, values, 'country'),
        language: getValueByHeader(headers, values, 'language'),
        title: getValueByHeader(headers, values, 'title'),
        description: getValueByHeader(headers, values, 'description'),
        fullDetails: getValueByHeader(headers, values, 'full details'),
        goalTokens: getValueByHeader(headers, values, 'goal tokens'),
        category: getValueByHeader(headers, values, 'category'),
        campaignUrl: getValueByHeader(headers, values, 'campaign url'),
        deadline: getValueByHeader(headers, values, 'deadline'),
        imageUrl: getValueByHeader(headers, values, 'image url')
      };
    } else {
      row = {
        index: i,
        country: getValueByHeader(headers, values, 'country'),
        language: getValueByHeader(headers, values, 'language'),
        title: getValueByHeader(headers, values, 'title'),
        description: getValueByHeader(headers, values, 'description'),
        fullDetails: getValueByHeader(headers, values, 'full details'),
        link: getValueByHeader(headers, values, 'link'),
        type: getValueByHeader(headers, values, 'type'),
        reward: getValueByHeader(headers, values, 'reward'),
        actionButtonText: getValueByHeader(headers, values, 'action button text'),
        imageUrl: getValueByHeader(headers, values, 'image url')
      };
    }

    // Validate row
    const rowErrors = validateCSVRow(row, i + 1);
    if (rowErrors.length > 0) {
      csvImportErrors.value.push(...rowErrors);
    } else {
      data.push(row);
    }
  }

  return data;
};

// Parse CSV rows, handling multi-line quoted fields
const parseCSVRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (double quote) - add one quote to field
        currentField += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field (only if not in quotes)
      currentRow.push(currentField);
      currentField = '';
      i++;
    } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
      // Windows line ending (\r\n) - end of row (only if not in quotes)
      currentRow.push(currentField);
      if (currentRow.length > 0 && currentRow.some(field => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i += 2;
    } else if (char === '\n' && !inQuotes) {
      // Unix line ending - end of row (only if not in quotes)
      currentRow.push(currentField);
      if (currentRow.length > 0 && currentRow.some(field => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
    } else if (char === '\r' && !inQuotes) {
      // Old Mac line ending - end of row (only if not in quotes)
      currentRow.push(currentField);
      if (currentRow.length > 0 && currentRow.some(field => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
    } else {
      // Regular character (including newlines inside quotes)
      currentField += char;
      i++;
    }
  }

  // Add the last field and row if there's remaining data
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 0 && currentRow.some(field => field.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  // Trim all fields
  return rows.map(row => row.map(field => field.trim()));
};

const getValueByHeader = (headers: string[], values: string[], headerName: string): string => {
  const index = headers.indexOf(headerName.toLowerCase());
  return index >= 0 && index < values.length ? values[index].trim() : '';
};

const validateCSVRow = (row: any, rowNumber: number): string[] => {
  const errors: string[] = [];

  // Common validations
  if (!row.title || row.title.trim() === '') {
    errors.push(`Row ${rowNumber}: Title is required`);
  }

  if (!row.description || row.description.trim() === '') {
    errors.push(`Row ${rowNumber}: Description is required`);
  }

  // Type-specific validations
  if (importType.value === 'campaigns') {
    // Campaign validations
    if (!row.goalTokens || row.goalTokens.trim() === '') {
      errors.push(`Row ${rowNumber}: Goal tokens is required`);
    } else {
      const goalTokensNum = parseFloat(row.goalTokens);
      if (isNaN(goalTokensNum) || goalTokensNum <= 0) {
        errors.push(`Row ${rowNumber}: Goal tokens must be a valid number > 0 (got: ${row.goalTokens})`);
      }
    }

    if (!row.category || row.category.trim() === '') {
      errors.push(`Row ${rowNumber}: Category is required`);
    } else {
      const validCategories = [
        'Freedom of Expression',
        'Environmental Rights',
        'Children\'s Rights',
        'Refugee Rights',
        'Women\'s Rights',
        'LGBTQ+ Rights',
        'Digital Rights',
        'Economic Justice',
        'Other'
      ];
      if (!validCategories.includes(row.category.trim())) {
        errors.push(`Row ${rowNumber}: Category must be one of: ${validCategories.join(', ')} (got: ${row.category})`);
      }
    }
  } else {
    // Action/Contribution validations
    if (!row.type || row.type.trim() === '') {
      errors.push(`Row ${rowNumber}: Type is required`);
    } else {
      const validTypes = ['visit', 'share', 'scan'];
      const normalizedType = row.type.trim().toLowerCase();
      if (!validTypes.includes(normalizedType)) {
        errors.push(`Row ${rowNumber}: Type must be one of: visit, share, scan (got: ${row.type})`);
      }
    }

    if (!row.reward || row.reward.trim() === '') {
      errors.push(`Row ${rowNumber}: Reward is required`);
    } else {
      const rewardNum = parseFloat(row.reward);
      if (isNaN(rewardNum) || rewardNum < 0) {
        errors.push(`Row ${rowNumber}: Reward must be a valid number >= 0 (got: ${row.reward})`);
      }
    }

    if ((row.type?.toLowerCase() === 'visit' || row.type?.toLowerCase() === 'share') && (!row.link || row.link.trim() === '')) {
      errors.push(`Row ${rowNumber}: Link is required for type "${row.type}"`);
    }
  }

  // Validate country (optional, but if provided must be valid)
  if (row.country && row.country.trim() !== '') {
    const countryCode = row.country.trim().toLowerCase();
    // Normalize common country code variations
    const countryCodeMap: Record<string, string> = {
      'au': 'aus',
      'australia': 'aus',
      'nz': 'nz',
      'new zealand': 'nz',
      'tw': 'tw',
      'taiwan': 'tw',
      'th': 'th',
      'thailand': 'th'
    };
    
    const normalizedCode = countryCodeMap[countryCode] || countryCode;
    const validCountries = localeStore.availableCountries.map(c => c.code.toLowerCase());
    
    if (!validCountries.includes(normalizedCode)) {
      const countryNames = localeStore.availableCountries.map(c => c.name).join(', ');
      const countryCodes = localeStore.availableCountries.map(c => c.code).join(', ');
      errors.push(`Row ${rowNumber}: Country must be one of: ${countryNames} (codes: ${countryCodes}) or left blank (got: ${row.country})`);
    }
  }

  // Validate language (optional, but if provided must be valid)
  if (row.language && row.language.trim() !== '') {
    const languageCode = row.language.trim().toLowerCase();
    // Normalize common language code variations
    const languageCodeMap: Record<string, string> = {
      'en': 'en',
      'english': 'en',
      'zh-tw': 'zh-TW',
      'zh_tw': 'zh-TW',
      'zh': 'zh-TW',
      'chinese': 'zh-TW',
      'th': 'th',
      'thai': 'th'
    };
    
    const normalizedCode = languageCodeMap[languageCode] || languageCode;
    const validLanguages = localeStore.availableLocales.map(l => l.code.toLowerCase());
    
    if (!validLanguages.includes(normalizedCode.toLowerCase())) {
      const languageNames = localeStore.availableLocales.map(l => l.name).join(', ');
      const languageCodes = localeStore.availableLocales.map(l => l.code).join(', ');
      errors.push(`Row ${rowNumber}: Language must be one of: ${languageNames} (codes: ${languageCodes}) or left blank (got: ${row.language})`);
    }
  }

  return errors;
};

const handleCSVFileSelect = async (file: File | null) => {
  if (!file) {
    csvPreview.value = [];
    csvImportErrors.value = [];
    return;
  }

  csvImportErrors.value = [];
  
  try {
    const text = await file.text();
    const parsed = parseCSV(text);
    csvPreview.value = parsed;
    
    if (parsed.length === 0 && csvImportErrors.value.length === 0) {
      csvImportErrors.value.push('No valid rows found in CSV file');
    }
  } catch (error: any) {
    console.error('Error parsing CSV:', error);
    csvImportErrors.value.push(`Error reading CSV file: ${error.message}`);
    csvPreview.value = [];
  }
};

// Helper function to normalize country and language codes
const normalizeCountryCode = (country: string | null | undefined): string | null => {
  if (!country || country.trim() === '') return null;
  const countryCodeLower = country.trim().toLowerCase();
  const countryCodeMap: Record<string, string> = {
    'au': 'aus',
    'australia': 'aus',
    'nz': 'nz',
    'new zealand': 'nz',
    'tw': 'tw',
    'taiwan': 'tw',
    'th': 'th',
    'thailand': 'th'
  };
  let countryCode = countryCodeMap[countryCodeLower] || countryCodeLower;
  const validCountries = localeStore.availableCountries.map(c => c.code.toLowerCase());
  if (!validCountries.includes(countryCode.toLowerCase())) {
    return null;
  }
  return countryCode;
};

const normalizeLanguageCode = (language: string | null | undefined): string | null => {
  if (!language || language.trim() === '') return null;
  const languageCodeLower = language.trim().toLowerCase();
  const languageCodeMap: Record<string, string> = {
    'en': 'en',
    'english': 'en',
    'zh-tw': 'zh-TW',
    'zh_tw': 'zh-TW',
    'zh': 'zh-TW',
    'chinese': 'zh-TW',
    'th': 'th',
    'thai': 'th'
  };
  let languageCode = languageCodeMap[languageCodeLower] || languageCodeLower;
  const validLanguages = localeStore.availableLocales.map(l => l.code.toLowerCase());
  if (!validLanguages.includes(languageCode.toLowerCase())) {
    return null;
  }
  return languageCode;
};

const importCSV = async () => {
  if (!apolloStore.client || !authStore.jwt || !authStore.userId) {
    $q.notify({
      type: 'negative',
      message: t('notAuthenticated')
    });
    return;
  }

  if (csvPreview.value.length === 0) {
    $q.notify({
      type: 'negative',
      message: importType.value === 'campaigns' ? t('noValidCampaignsToImport') : t('noValidActionsToImport')
    });
    return;
  }

  importingCSV.value = true;
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    for (const row of csvPreview.value) {
      try {
        const countryCode = normalizeCountryCode(row.country);
        const languageCode = normalizeLanguageCode(row.language);

        let variables: any;
        let mutation;

        if (importType.value === 'campaigns') {
          // Campaign import
          const goalTokens = parseFloat(row.goalTokens) || 0;
          variables = {
            title: row.title,
            description: row.description,
            full_details: row.fullDetails || null,
            goal_tokens: goalTokens.toString(),
            category: row.category || null,
            campaign_url: row.campaignUrl || null,
            deadline: row.deadline ? new Date(row.deadline).toISOString() : null,
            country: countryCode,
            language: languageCode,
            is_active: true,
            created_by: authStore.userId
          };

          if (row.imageUrl && row.imageUrl.trim() !== '') {
            variables.image_url = row.imageUrl.trim();
          }

          mutation = gql`
            mutation CreateCampaign($object: campaigns_insert_input!) {
              insert_campaigns_one(object: $object) {
                id
              }
            }
          `;
        } else {
          // Action/Contribution import
          const contributionType = normalizeContributionType(row.type);
          const tokenReward = parseFloat(row.reward) || 0;
          variables = {
            title: row.title,
            description: row.description,
            full_details: row.fullDetails || null,
            contribution_type: contributionType,
            token_reward: tokenReward.toString(),
            action_button_text: row.actionButtonText || 'Complete Action',
            external_link: row.link || null,
            country: countryCode,
            language: languageCode,
            is_active: true,
            created_by: authStore.userId
          };

          if (row.imageUrl && row.imageUrl.trim() !== '') {
            variables.image_url = row.imageUrl.trim();
          }

          mutation = gql`
            mutation CreateContribution($object: contributions_insert_input!) {
              insert_contributions_one(object: $object) {
                id
              }
            }
          `;
        }

        await apolloStore.client.mutate({
          mutation,
          variables: { object: variables },
          context: {
            headers: {
              Authorization: `Bearer ${authStore.jwt}`
            }
          }
        });

        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`Failed to import "${row.title}": ${error.message || 'Unknown error'}`);
        console.error(`Error importing row ${row.index}:`, error);
      }
    }

    // Show results
    if (successCount > 0) {
      $q.notify({
        type: 'positive',
        message: importType.value === 'campaigns' 
          ? t('importedCampaignsSuccessfully', [successCount])
          : t('importedActionsSuccessfully', [successCount])
      });
    }

    if (errorCount > 0) {
      $q.notify({
        type: 'warning',
        message: importType.value === 'campaigns'
          ? t('importedCampaignsWithErrors', [successCount, errorCount])
          : t('importedWithErrors', [successCount, errorCount]),
        timeout: 5000
      });
      console.error('Import errors:', errors);
    }

    // Close dialog and refresh
    csvImportDialog.value = false;
    csvFile.value = null;
    csvPreview.value = [];
    csvImportErrors.value = [];
    
    // Call the success callback if provided
    if (props.onImportSuccess) {
      await props.onImportSuccess();
    }
  } catch (error: any) {
    console.error('Error during CSV import:', error);
    $q.notify({
      type: 'negative',
      message: error.message || t('failedToImportCSV')
    });
  } finally {
    importingCSV.value = false;
  }
};
</script>

<style scoped lang="scss">
// Component-specific styles if needed
</style>

