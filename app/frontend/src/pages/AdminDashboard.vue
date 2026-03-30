<template>
  <q-page class="admin-dashboard-page" padding>
    <!-- Header with Back Button and Title -->
    <div class="dashboard-header q-mb-lg">
      <div class="row items-center q-mb-md">
        <q-btn
          flat
          round
          icon="arrow_back"
          color="black"
          @click="$router.back()"
          class="q-mr-sm"
        />
        <div>
          <h4 class="dashboard-title">{{ $t('adminDashboard') }}</h4>
          <div class="dashboard-subtitle">{{ $t('monitorManageDao') }}</div>
        </div>
      </div>
      
      <!-- Period Filter Buttons -->
      <div class="row q-gutter-xs">
        <q-btn
          v-for="period in periodOptions"
          :key="period.value"
          :label="period.label"
          :class="['period-filter-btn', { 'period-filter-btn-active': selectedPeriod === period.value }]"
          size="sm"
          unelevated
          @click="selectedPeriod = period.value"
        />
      </div>
    </div>

    <!-- Key Statistics Cards (2x2 Grid) -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-6 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon-yellow">
              <q-icon name="people" size="24px" />
            </div>
            <div class="stat-label">{{ $t('totalUsers') }}</div>
            <div class="stat-value">{{ formatNumber(approvedUsersCount) }}</div>
            <q-icon name="trending_up" size="16px" class="stat-trend-icon" />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon-yellow">
              <q-icon name="check_circle" size="24px" />
            </div>
            <div class="stat-label">{{ $t('totalActionsCompleted') }}</div>
            <div class="stat-value">{{ totalCompletedActions }}</div>
            <q-icon name="trending_up" size="16px" class="stat-trend-icon" />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon-pink">
              <q-icon name="volunteer_activism" size="24px" />
            </div>
            <div class="stat-label">{{ $t('totalDonations') }}</div>
            <div class="stat-value">{{ totalDonations }}</div>
            <q-icon name="trending_up" size="16px" class="stat-trend-icon" />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-sm-6 col-md-3">
        <q-card class="stat-card">
          <q-card-section class="stat-card-content">
            <div class="stat-icon-wrapper stat-icon-yellow">
              <q-icon name="chat" size="24px" />
            </div>
            <div class="stat-label">{{ $t('totalMessages') }}</div>
            <div class="stat-value">{{ formatNumber(totalMessages) }}</div>
            <q-icon name="trending_up" size="16px" class="stat-trend-icon" />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Treasury Overview Section -->
    <div class="section-header-dark q-mb-md">
      <span class="section-title">{{ $t('treasuryOverview') }}</span>
    </div>
    
    <!-- Current Balance Card -->
    <q-card class="q-mb-md card-light">
      <q-card-section>
        <div class="treasury-stat-card">
          <div class="treasury-stat-label">{{ $t('currentBalance') }}</div>
          <div class="treasury-stat-value">{{ formatNumber(treasuryBalance) }}
            <span class="treasury-stat-unit">{{ $t('hrTokens') }}</span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Inflow and Outflow Cards -->
    <div class="row q-col-gutter-md q-mb-md">
      <!-- Total Outflow -->
      <div class="col-6">
        <q-card class="card-light">
          <q-card-section>
            <div class="treasury-stat-card">
              <div class="treasury-stat-label">{{ $t('totalOutflow') }} ({{ selectedPeriod }})</div>
              <div class="treasury-stat-row">
                <q-icon name="arrow_upward" size="20px" class="text-negative" />
                <div class="treasury-stat-value text-accent">
                  {{ formatNumber(treasuryOutflow) }}
                </div>
              </div>
              <div class="treasury-stat-unit text-accent">{{ $t('hrTokens') }}</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Total Inflow -->
      <div class="col-6">
        <q-card class="card-light">
          <q-card-section>
            <div class="treasury-stat-card">
              <div class="treasury-stat-label">{{ $t('totalInflow') }} ({{ selectedPeriod }})</div>
              <div class="treasury-stat-row">
                <q-icon name="arrow_downward" size="20px" class="text-secondary" />
                <div class="treasury-stat-value text-secondary">
                  {{ formatNumber(treasuryInflow) }}
                </div>
              </div>
              <div class="treasury-stat-unit text-secondary">{{ $t('hrTokens') }}</div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Transactions Card -->
    <q-card class="q-mb-lg card-light">
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="section-title">{{ $t('treasuryTransactionsTitle') }}</div>
          <div class="row items-center">
            <q-btn
              flat
              icon="search"
              round
              @click="showTreasurySearch = !showTreasurySearch"
            />
            <q-slide-transition>
              <div v-show="showTreasurySearch">
                <q-input
                  v-model="treasurySearchQuery"
                  dense
                  outlined
                  :placeholder="$t('searchTransactions')"
                  class="q-mr-sm dark-input"
                  style="width: 200px"
                >
                  <template v-slot:append>
                    <q-icon name="search" />
                  </template>
                </q-input>
              </div>
            </q-slide-transition>
            <q-btn
              flat
              icon="refresh"
              round
              @click="tokenStore.fetchTreasuryTransactions()"
              :loading="tokenStore.loading.treasuryTransactions"
            />
          </div>
        </div>
        <q-table
          :rows="filteredTreasuryTransactions"
          :columns="treasuryTransactionColumns"
          row-key="id"
          :loading="tokenStore.loading.treasuryTransactions"
          flat
          :rows-per-page-options="[10, 25, 50]"
          class="dark-table"
        >
          <template v-slot:body-cell-icon="props">
            <q-td :props="props">
              <div 
                class="transaction-icon-table"
                :class="{ 
                  'icon-positive': isPositiveAmount(props.row), 
                  'icon-negative': !isPositiveAmount(props.row),
                  'icon-rotate-incoming': isPositiveAmount(props.row),
                  'icon-rotate-outgoing': !isPositiveAmount(props.row)
                }"
              >
                <q-icon 
                  :name="isPositiveAmount(props.row) ? 'arrow_downward' : 'arrow_upward'" 
                  size="20px" 
                  :color="isPositiveAmount(props.row) ? 'green' : 'red'"
                />
              </div>
            </q-td>
          </template>

          <template v-slot:body-cell-title="props">
            <q-td :props="props">
              <div class="transaction-title-table">{{ getTransactionTitle(props.row, 'treasury', t) }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-user="props">
            <q-td :props="props">
              <div class="transaction-user-table">{{ getTransactionUserName(props.row, t) }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-actionCampaign="props">
            <q-td :props="props">
              <div class="transaction-action-campaign-table">{{ getTransactionActionCampaign(props.row, t) }}</div>
            </q-td>
          </template>

          <template v-slot:body-cell-amount="props">
            <q-td :props="props" :class="{ 'amount-positive': isPositiveAmount(props.row), 'amount-negative': !isPositiveAmount(props.row) }">
              {{ isPositiveAmount(props.row) ? '+' : '-' }}{{ formatTokenBalance(Math.abs(props.row.tokenAmount ?? props.row.token_amount ?? props.row.amount ?? 0)) }}
            </q-td>
          </template>

          <template v-slot:body-cell-time="props">
            <q-td :props="props">
              <div class="transaction-time-table">{{ formatTransactionTime(props.row.timestamp, t) }}</div>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
      

    <!-- Actions & Token Rewards Section -->
    <div class="section-header-dark q-mb-md q-mt-lg">
      <span class="section-title">{{ $t('actionsTokenRewards') }}</span>
    </div>

    <div class="row q-col-gutter-md q-mb-lg">
      <!-- Token Distribution Pie Chart -->
      <div class="col-12 col-md-6">
        <q-card class="dark-card">
          <q-card-section>
            <div class="row items-center justify-between q-mb-md">
              <div class="section-title">{{ $t('tokenDistribution') }}</div>
              <div class="row">
                <q-btn
                  :label="$t('tokens')"
                  :class="['chart-toggle-btn', { 'chart-toggle-btn-active': chartViewMode === 'tokens' }]"
                  size="sm"
                  unelevated
                  @click="chartViewMode = 'tokens'"
                />
                <q-btn
                  :label="$t('actions')"
                  :class="['chart-toggle-btn', { 'chart-toggle-btn-active': chartViewMode === 'actions' }]"
                  size="sm"
                  unelevated
                  @click="chartViewMode = 'actions'"
                />
              </div>
            </div>
            <PieChart
              :data="chartData"
              :size="isMobile ? 200 : 250"
              stroke-color="#1a1a1a"
              :stroke-width="3"
              :show-legend="true"
            />
          </q-card-section>
        </q-card>
      </div>

      <!-- Action Performance -->
      <div class="col-12 col-md-6">
        <div class="section-title q-mb-md">{{ $t('actionPerformance') }}</div>
        <div>
          <div
            v-for="actionType in actionTypeStats.slice(0, 3)"
            :key="actionType.type"
            class="action-performance-card card-light"
            :style="{ backgroundColor: actionType.color }"
          >
            <div class="action-performance-title">{{ actionType.label }}</div>
            <div class="action-performance-row">
              <q-icon :name="actionType.icon" size="30px" class="q-pt-xs"/>
              <div class="action-performance-item">
                <div class="action-performance-number">{{ formatNumber(actionType.completed) }}</div>
                <div class="action-performance-caption">{{ $t('actions') }}</div>
              </div>
              <q-icon name="mdi-circle-multiple-outline" size="30px" class="q-pt-xs"/>
              <div class="action-performance-item">
                <div class="action-performance-number">{{ formatNumber(actionType.tokensAwarded) }}</div>
                <div class="action-performance-caption">{{ $t('tkns') }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Campaigns & Token Donations Section -->
    <div class="section-header-dark q-mb-md q-mt-lg">
      <span class="section-title">{{ $t('campaignsTokenDonations') }}</span>
    </div>

    <div class="row q-col-gutter-md q-mb-lg">
      <!-- Campaign Distribution Pie Chart -->
      <div class="col-12 col-md-6">
        <q-card class="dark-card">
          <q-card-section>
            <div class="row items-center justify-between q-mb-md">
              <div class="section-title">{{ $t('campaignDistribution') }}</div>
              <div class="row">
                <q-btn
                  :label="$t('tokens')"
                  :class="['chart-toggle-btn', { 'chart-toggle-btn-active': campaignChartViewMode === 'tokens' }]"
                  size="sm"
                  unelevated
                  @click="campaignChartViewMode = 'tokens'"
                />
                <q-btn
                  :label="$t('supporters')"
                  :class="['chart-toggle-btn', { 'chart-toggle-btn-active': campaignChartViewMode === 'supporters' }]"
                  size="sm"
                  unelevated
                  @click="campaignChartViewMode = 'supporters'"
                />
              </div>
            </div>
            <PieChart
              :data="campaignChartData"
              :size="isMobile ? 200 : 250"
              stroke-color="#1a1a1a"
              :stroke-width="3"
              :show-legend="true"
            />
          </q-card-section>
        </q-card>
      </div>

      <!-- Campaign Performance -->
      <div class="col-12 col-md-6">
        <div class="section-title q-mb-md">{{ $t('campaignPerformance') }}</div>
        <div>
          <div
            v-for="campaign in campaignStats"
            :key="campaign.id"
            class="action-performance-card card-light"
          >
            <div class="action-performance-title">{{ campaign.title }}</div>
            <div class="action-performance-row">
              <q-icon name="people" size="30px" class="q-pt-xs"/>
              <div class="action-performance-item">
                <div class="action-performance-number">{{ formatNumber(campaign.supporterCount) }}</div>
                <div class="action-performance-caption">{{ $t('supporters') }}</div>
              </div>
              <q-icon :name="campaign.icon" size="30px" class="q-pt-xs"/>
              <div class="action-performance-item">
                <div class="action-performance-number">{{ formatNumber(campaign.tokensRaised) }}</div>
                <div class="action-performance-caption">{{ $t('tkns') }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Users Section -->
    <div class="section-header-dark q-mb-md q-mt-lg">
      <span class="section-title">{{ $t('users') }}</span>
    </div>


    <!-- Users Table -->
    <q-card class="dark-card q-mb-lg">
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="section-title">{{ $t('users') }}</div>
          <div class="row items-center">
            <q-btn
              flat
              icon="search"
              round
              @click="showUserSearch = !showUserSearch"
            />
            <q-slide-transition>
              <div v-show="showUserSearch">
            <q-input
              v-model="searchQuery"
              dense
              outlined
              :placeholder="$t('searchUsers')"
              class="q-mr-sm dark-input"
              style="width: 200px"
            >
                  <template v-slot:append>
                    <q-icon name="search" />
                  </template>
                </q-input>
              </div>
            </q-slide-transition>
            <q-btn
              flat
              icon="refresh"
              round
              @click="loadUsers"
              :loading="loading"
            />
          </div>
        </div>
        <q-table
          :rows="filteredUsers"
          :columns="columns"
          row-key="id"
          :loading="loading"
          flat
          :rows-per-page-options="[10, 25, 50]"
          class="dark-table"
        >
          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-select
                v-model="props.row.status"
                :options="statusOptions"
                dense
                outlined
                emit-value
                map-options
                @update:model-value="updateUserStatus(props.row.id, $event)"
                :loading="props.row.updating"
              >
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label :class="getStatusClass(scope.opt)">
                        {{ scope.opt }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
                <template v-slot:selected>
                  <span :class="getStatusClass(props.row.status)">
                    {{ props.row.status }}
                  </span>
                </template>
              </q-select>
            </q-td>
          </template>
          
          <template v-slot:body-cell-profileImage="props">
            <q-td :props="props">
              <q-avatar size="40px">
                <img v-if="props.row.profileImage" :src="props.row.profileImage">
                <q-icon v-else name="person" size="40px" />
              </q-avatar>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { QTableColumn } from 'quasar';
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { logger } from '../utils/logger';
import { useTokenStore } from '../stores/token';
import { useContributionsStore } from '../stores/contributions';
import { useCampaignsStore } from '../stores/campaigns';
import { useApolloStore } from '../stores/apollo';
import { useQuasar } from 'quasar';
import { format, subDays, subYears } from 'date-fns';
import { gql } from '@apollo/client/core';
import { useI18n } from 'vue-i18n';
import PieChart from '../components/PieChart.vue';
import {
  isPositiveTransaction,
  formatTokenBalance,
  formatTransactionTime,
  getTransactionTitle,
  getTransactionUserName,
  getTransactionActionCampaign
} from '../utils/transactionUtils';
import {
  getContributionTypeColors,
  getContributionTypeLabels,
  getContributionTypeIcons,
  getContributionTypeQuasarColors,
  getContributionTypeConfig
} from '../config/contributionTypes';

const { t } = useI18n();

type UserStatus = 'approved' | 'rejected' | 'admin';
type PeriodOption = '7d' | '30d' | '90d' | '1y';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  profileImage: string | null;
  affiliations: string | null;
  status: UserStatus;
  createdAt?: string;
  updating?: boolean;
  tokenBalance?: number;
}

interface TokenBalance {
  user_id: string;
  balance: number;
  last_updated: string;
}

defineOptions({
  name: 'AdminDashboard'
});

const $q = useQuasar();
const auth = useAuthStore();
const chatStore = useChatStore();
const tokenStore = useTokenStore();
const contributionsStore = useContributionsStore();
const campaignsStore = useCampaignsStore();
const apolloStore = useApolloStore();
const loading = ref(false);
const searchQuery = ref('');
const showUserSearch = ref(false);
const treasurySearchQuery = ref('');
const showTreasurySearch = ref(false);
const isMobile = ref($q.screen.lt.sm);
const selectedPeriod = ref<PeriodOption>('30d');
const chartViewMode = ref<'tokens' | 'actions'>('tokens');
const campaignChartViewMode = ref<'tokens' | 'supporters'>('tokens');

const periodOptions = [
  { label: '7d', value: '7d' as PeriodOption },
  { label: '30d', value: '30d' as PeriodOption },
  { label: '90d', value: '90d' as PeriodOption },
  { label: '1y', value: '1y' as PeriodOption }
];

const statusOptions: UserStatus[] = ['approved', 'rejected', 'admin'];

const statusOrder: Record<UserStatus, number> = {
  'admin': 0,
  'approved': 1,
  'rejected': 2
};

// Period filter helper
const getPeriodDates = (period: PeriodOption) => {
  const now = new Date();
  let start: Date;
  
  switch (period) {
    case '7d':
      start = subDays(now, 7);
      break;
    case '30d':
      start = subDays(now, 30);
      break;
    case '90d':
      start = subDays(now, 90);
      break;
    case '1y':
      start = subYears(now, 1);
      break;
    default:
      start = subDays(now, 30);
  }
  
  return { start, end: now };
};

// Format number helper
const formatNumber = (num: number) => {
  return Math.round(num * 100) / 100;
};


const filteredUsers = computed(() => {
  let filtered = users.value || [];
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase();
    filtered = filtered.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const preferredName = user.preferredName?.toLowerCase() || '';
      return fullName.includes(query) || preferredName.includes(query);
    });
  }
  
  return filtered.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });
});

const getStatusClass = (status: string) => {
  switch (status) {
    case 'approved':
      return 'text-positive';
    case 'rejected':
      return 'text-negative';
    case 'admin':
      return 'text-primary';
    default:
      return 'text-grey';
  }
};

const columns: QTableColumn[] = [
  {
    name: 'profileImage',
    required: true,
    label: t('profileLabel'),
    field: 'profileImage',
    align: 'center',
    sortable: false
  },
  {
    name: 'firstName',
    required: true,
    label: t('firstNameLabel'),
    field: 'firstName',
    align: 'left',
    sortable: true
  },
  {
    name: 'lastName',
    required: true,
    label: t('lastNameLabel'),
    field: 'lastName',
    align: 'left',
    sortable: true
  },
  {
    name: 'preferredName',
    required: false,
    label: t('preferredName'),
    field: 'preferredName',
    align: 'left',
    sortable: true
  },
  {
    name: 'status',
    required: true,
    label: t('status'),
    field: 'status',
    align: 'left',
    sortable: true,
    sort: (a: UserStatus, b: UserStatus) => statusOrder[a] - statusOrder[b]
  }
];

const treasuryTransactionColumns: QTableColumn[] = [
  {
    name: 'icon',
    required: true,
    label: '',
    field: 'type',
    align: 'center',
    sortable: false,
    style: 'width: 60px'
  },
  {
    name: 'title',
    required: true,
    label: t('transaction'),
    field: 'description',
    align: 'left',
    sortable: true
  },
  {
    name: 'user',
    required: true,
    label: t('user'),
    field: 'user',
    align: 'left',
    sortable: true
  },
  {
    name: 'actionCampaign',
    required: true,
    label: t('actionCampaign'),
    field: 'actionCampaign',
    align: 'left',
    sortable: true
  },
  {
    name: 'amount',
    required: true,
    label: t('amountLabel'),
    field: 'amount',
    align: 'right',
    sortable: true,
    format: (val: number, row: any) => {
      const amount = row.tokenAmount ?? row.token_amount ?? row.amount ?? 0;
      const isPositive = isPositiveAmount(row);
      return `${isPositive ? '+' : '-'}${formatTokenBalance(Math.abs(amount))}`;
    }
  },
  {
    name: 'time',
    required: true,
    label: t('time'),
    field: 'timestamp',
    align: 'right',
    sortable: true,
    format: (val: string) => formatTransactionTime(val, t)
  }
];

const users = ref<User[]>([]);

const loadUsers = async () => {
  try {
    loading.value = true;
    await auth.fetchAllUsersWithStatus();
    
    const result = await apolloStore.client?.query({
      query: gql`
        query GetAllUserBalances {
          token_balances {
            user_id
            balance
            last_updated
          }
        }
      `,
      fetchPolicy: 'network-only'
    });

    const balances = result?.data?.token_balances || [];
    
    users.value = auth.users.map(user => ({ 
      ...user, 
      updating: false,
      status: user.status as UserStatus,
      tokenBalance: balances.find((b: TokenBalance) => b.user_id === user.id)?.balance || 0
    }));
  } catch (error) {
    console.error('Failed to load users:', error);
  } finally {
    loading.value = false;
  }
};

watch(() => tokenStore.getUserTokenBalances, (newBalances) => {
  users.value = users.value.map(user => {
    const updatedBalance = newBalances.find(b => b.user_id === user.id);
    if (updatedBalance) {
      return { ...user, tokenBalance: updatedBalance.balance };
    }
    return user;
  });
}, { deep: true });

const updateUserStatus = async (userId: string, newStatus: string) => {
  const user = users.value.find(u => u.id === userId);
  if (!user) return;

  user.updating = true;
  try {
    await auth.updateUserStatus(userId, newStatus);
    $q.notify({
      type: 'positive',
      message: t('userStatusUpdated', [newStatus]),
      position: 'top',
      timeout: 2000
    });
  } catch (error) {
    console.error('Failed to update user status:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToUpdateUserStatus'),
      position: 'top',
      timeout: 2000
    });
    await loadUsers();
  } finally {
    user.updating = false;
  }
};

// Treasury statistics with period filter and search
const filteredTreasuryTransactions = computed(() => {
  const { start, end } = getPeriodDates(selectedPeriod.value);
  const transactions = treasuryTransactions.value || [];
  let filtered = transactions.filter(t => {
    const txDate = new Date(t.timestamp);
    return txDate >= start && txDate <= end;
  });
  
  // Apply search filter
  if (treasurySearchQuery.value.trim()) {
    const query = treasurySearchQuery.value.trim().toLowerCase();
    filtered = filtered.filter(transaction => {
      const title = getTransactionTitle(transaction, 'treasury', t).toLowerCase();
      const userName = getTransactionUserName(transaction, t).toLowerCase();
      const actionCampaign = getTransactionActionCampaign(transaction, t).toLowerCase();
      const description = transaction.description?.toLowerCase() || '';
      const amount = formatTokenBalance(Math.abs(transaction.tokenAmount ?? transaction.token_amount ?? transaction.amount ?? 0)).toLowerCase();
      
      return title.includes(query) ||
             userName.includes(query) ||
             actionCampaign.includes(query) ||
             description.includes(query) ||
             amount.includes(query);
    });
  }
  
  return filtered;
});

const treasuryBalance = computed(() => tokenStore.getTreasuryBalance);
const treasuryTransactions = computed(() => tokenStore.getTreasuryTransactions);

const treasuryInflow = computed(() => {
  return filteredTreasuryTransactions.value
    .filter(t => {
      const txType = t.transactionType || t.type;
      return txType === 'TREASURY_DEPOSIT' || txType === 'TRANSFER' || txType === 'DONATION';
    })
    .reduce((sum, t) => sum + (t.tokenAmount ?? t.token_amount ?? t.amount ?? 0), 0);
});

const treasuryOutflow = computed(() => {
  return filteredTreasuryTransactions.value
    .filter(t => {
      const txType = t.transactionType || t.type;
      return txType === 'TREASURY_WITHDRAWAL' || txType === 'REWARD';
    })
    .reduce((sum, t) => sum + (t.tokenAmount ?? t.token_amount ?? t.amount ?? 0), 0);
});

// Transaction helpers - use utilities from transactionUtils
const isPositiveAmount = (transaction: any): boolean => {
  return isPositiveTransaction(transaction, 'treasury');
};

// Actions & Token Rewards statistics
const actionTypeDistribution = computed(() => {
  const { start, end } = getPeriodDates(selectedPeriod.value);
  const typeMap = new Map<string, number>();
  
  contributionsStore.contributions.forEach(contribution => {
    const completed = contributionsStore.userContributions.filter(uc => {
      const completedDate = new Date(uc.completedAt);
      return uc.contributionId === contribution.id && completedDate >= start && completedDate <= end;
    });
    
    const totalTokens = completed.reduce((sum, uc) => sum + uc.tokensAwarded, 0);
    const current = typeMap.get(contribution.contributionType) || 0;
    typeMap.set(contribution.contributionType, current + totalTokens);
  });
  
  const colors = getContributionTypeColors();
  const labelKeys = getContributionTypeLabels();
  
  return Array.from(typeMap.entries()).map(([type, value]) => ({
    label: t(labelKeys[type] || type),
    value,
    color: colors[type] || '#999999'
  })).filter(item => item.value > 0);
});

// Action count distribution (number of actions completed)
const actionCountDistribution = computed(() => {
  const { start, end } = getPeriodDates(selectedPeriod.value);
  const typeMap = new Map<string, number>();
  
  contributionsStore.contributions.forEach(contribution => {
    const completed = contributionsStore.userContributions.filter(uc => {
      const completedDate = new Date(uc.completedAt);
      return uc.contributionId === contribution.id && completedDate >= start && completedDate <= end;
    });
    
    const actionCount = completed.length;
    const current = typeMap.get(contribution.contributionType) || 0;
    typeMap.set(contribution.contributionType, current + actionCount);
  });
  
  const colors = getContributionTypeColors();
  const labelKeys = getContributionTypeLabels();
  
  return Array.from(typeMap.entries()).map(([type, value]) => ({
    label: t(labelKeys[type] || type),
    value,
    color: colors[type] || '#999999'
  })).filter(item => item.value > 0);
});

// Chart data based on view mode
const chartData = computed(() => {
  return chartViewMode.value === 'tokens' ? actionTypeDistribution.value : actionCountDistribution.value;
});

const actionTypeStats = computed(() => {
  const { start, end } = getPeriodDates(selectedPeriod.value);
  const statsMap = new Map<string, {
    type: string;
    label: string;
    completed: number;
    tokensAwarded: number;
    total: number;
    icon: string;
    color: string;
  }>();
  
  contributionsStore.contributions.forEach(contribution => {
    const completed = contributionsStore.userContributions.filter(uc => {
      const completedDate = new Date(uc.completedAt);
      return uc.contributionId === contribution.id && completedDate >= start && completedDate <= end;
    });
    
    const current = statsMap.get(contribution.contributionType) || {
      type: contribution.contributionType,
      label: '',
      completed: 0,
      tokensAwarded: 0,
      total: 0,
      icon: '',
      color: ''
    };
    
    current.completed += completed.length;
    current.tokensAwarded += completed.reduce((sum, uc) => sum + uc.tokensAwarded, 0);
    current.total += contribution.targetParticipants || 0;
    
    statsMap.set(contribution.contributionType, current);
  });
  
  const icons = getContributionTypeIcons();
  const quasarColors = getContributionTypeQuasarColors();
  const labelKeys = getContributionTypeLabels();
  
  return Array.from(statsMap.values()).map(stat => {
    const config = getContributionTypeConfig(stat.type);
    return {
      ...stat,
      label: t(labelKeys[stat.type] || stat.type),
      icon: icons[stat.type] || 'help',
      color: quasarColors[stat.type] || 'grey',
      completionRate: stat.total > 0 ? Math.min(stat.completed / stat.total, 1) : 0
    };
  });
});

// User statistics
const approvedUsersCount = computed(() => 
  users.value.filter(user => user.status == 'approved' || user.status == 'admin').length
);

// Total completed actions across all users
const totalCompletedActions = computed(() => {
  return contributionsStore.userContributions.length;
});


// Total number of donations (count) from all users
const allDonationsCount = ref(0);
const totalDonations = computed(() => {
  // Return the count of donations, not the sum of tokens
  return allDonationsCount.value;
});

const topCampaigns = computed(() => {
  return campaignsStore.campaigns
    .sort((a, b) => b.tokensRaised - a.tokensRaised)
    .slice(0, 5)
    .map(campaign => ({
      ...campaign,
      progress: campaign.goalTokens > 0 ? Math.min(campaign.tokensRaised / campaign.goalTokens, 1) : 0
    }));
});

// Campaign distribution for pie chart (tokens)
const campaignTokenDistribution = computed(() => {
  return topCampaigns.value.map(campaign => ({
    label: campaign.title,
    value: campaign.tokensRaised,
    color: campaign.progress >= 1 ? '#65c802' : '#EE4790'
  })).filter(item => item.value > 0);
});

// Campaign distribution for pie chart (supporters)
const campaignSupporterDistribution = computed(() => {
  return topCampaigns.value.map(campaign => ({
    label: campaign.title,
    value: campaign.supporterCount,
    color: campaign.progress >= 1 ? '#65c802' : '#EE4790'
  })).filter(item => item.value > 0);
});

// Chart data based on view mode
const campaignChartData = computed(() => {
  return campaignChartViewMode.value === 'tokens' ? campaignTokenDistribution.value : campaignSupporterDistribution.value;
});

// Campaign stats for performance cards
const campaignStats = computed(() => {
  const hexColors = ['#B8C540', '#EE4790', '#009DC1'];
  const icons = ['campaign', 'favorite', 'trending_up'];
  
  return topCampaigns.value.slice(0, 3).map((campaign, index) => {
    return {
      id: campaign.id,
      title: campaign.title,
      tokensRaised: campaign.tokensRaised,
      supporterCount: campaign.supporterCount,
      progress: campaign.progress,
      icon: icons[index] || 'campaign',
      color: hexColors[index] || '#999999'
    };
  });
});

// Chat statistics
const totalMessages = computed(() => {
  return chatStore.chats.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0);
});


const fetchAllDonationsCount = async () => {
  try {
    if (!apolloStore.client || !auth.jwt) {
      console.warn('Apollo client or auth token not available');
      return;
    }

    // Query donations through campaigns relationship
    // Note: Even through campaigns, donations are still filtered by user_id permissions
    // So this will only show the admin's own donations unless permissions are different
    const result = await apolloStore.client.query({
      query: gql`
        query GetDonationsCountThroughCampaigns {
          campaigns {
            id
            donations_aggregate {
              aggregate {
                count
              }
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      context: {
        headers: {
          Authorization: `Bearer ${auth.jwt}`
        }
      }
    });

    // Sum up donation counts from all campaigns
    const campaigns = result?.data?.campaigns || [];
    const totalCount = campaigns.reduce((sum: number, campaign: any) => {
      const count = campaign.donations_aggregate?.aggregate?.count || 0;
      return sum + count;
    }, 0);
    
    // If we got a count > 0, use it (might be filtered to admin's donations only)
    if (totalCount > 0) {
      allDonationsCount.value = totalCount;
      // Note: This might only show admin's own donations due to permissions
      // If this seems incorrect, we'll need to add admin permissions to campaign_donations table
      return;
    }
    
    // If count is 0, try fallback methods (don't throw error - 0 is a valid state)
  } catch (error: any) {
    logger.error('Failed to fetch donations count through campaigns', error);
  }
  
  // Fallback: Try direct aggregate query (may be restricted by permissions)
  // This runs both when count is 0 and when there's an error
  try {
    const result = await apolloStore.client?.query({
      query: gql`
        query GetAllDonationsCount {
          campaign_donations_aggregate(where: {}) {
            aggregate {
              count
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      context: {
        headers: {
          Authorization: `Bearer ${auth.jwt}`
        }
      }
    });
    
    const count = result?.data?.campaign_donations_aggregate?.aggregate?.count;
    if (count !== undefined && count !== null) {
      allDonationsCount.value = count;
      return;
    }
  } catch (fallbackError: any) {
    console.error('Failed to fetch donations count via direct aggregate:', fallbackError);
  }
  
  // Last fallback: Since we can't get actual donation counts due to permissions,
  // we'll use supporter_count as an approximation
  // Note: supporter_count is unique supporters, not total donations
  // A better solution would be to add admin permissions to campaign_donations table
  if (campaignsStore.campaigns.length > 0) {
    // Sum all supporter counts - this is an approximation (unique supporters, not total donations)
    const estimatedCount = campaignsStore.campaigns.reduce((sum, c) => sum + (c.supporterCount || 0), 0);
    allDonationsCount.value = estimatedCount;
    console.warn('Using estimated count from supporter counts (approximation):', estimatedCount);
    console.warn('Note: This shows unique supporters, not total donation records. Consider adding admin permissions to campaign_donations table.');
  } else {
    allDonationsCount.value = 0;
  }
};

const initializeData = async () => {
  try {
    await Promise.all([
      tokenStore.refreshBalances(),
      tokenStore.fetchTreasuryTransactions(),
      contributionsStore.fetchContributions(),
      campaignsStore.fetchCampaigns(),
      chatStore.fetchChats(),
      fetchAllDonationsCount()
    ]);

    await loadUsers();
  } catch (error) {
    console.error('Failed to load data:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadDashboardData')
    });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  loading.value = true;
  try {
    await initializeData();
  } catch (error) {
    console.error('Failed to load data:', error);
    $q.notify({
      type: 'negative',
      message: t('failedToLoadDashboardData')
    });
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.card-light {
  background: #f5f5f5;
  border-radius: 16px;
  border: none;
}
.admin-dashboard-page {
  background: white;
  min-height: 100vh;
  color: #1a1a1a;
}

.dashboard-header {
  .dashboard-title {
    color: #1a1a1a;
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .dashboard-subtitle {
    color: #666;
    font-size: 0.875rem;
    margin-top: 4px;
  }
}

.period-filter-btn {
  background: #f5f5f5 !important;
  color: #1a1a1a !important;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 500;

  &.period-filter-btn-active {
    background: #FFFF00 !important;
    color: #1a1a1a !important;
    font-weight: 600;
  }
}

.chart-toggle-btn {
  background: #e8e8e8 !important;
  color: #1a1a1a !important;
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 500;
  font-size: 0.875rem;

  &.chart-toggle-btn-active {
    background: #FFFF00 !important;
    color: #1a1a1a !important;
    font-weight: 600;
  }
}

.stat-card {
  background: #f5f5f5 !important;
  border-radius: 16px;
  border: none;

  .stat-card-content {
    position: relative;
    padding: 16px;
  }

  .stat-icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;

    &.stat-icon-yellow {
      background: rgba(154, 165, 198, 0.2);
      color: #1aa3d6;
    }

    &.stat-icon-pink {
      background: rgba(238, 71, 144, 0.2);
      color: #EE4790;
    }

    &.stat-icon-green {
      background: rgba(184, 197, 64, 0.2);
      color: #B8C540;
    }
  }

  .stat-label {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 8px;
  }

  .stat-value {
    color: #1a1a1a;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .stat-trend-icon {
    position: absolute;
    top: 16px;
    right: 16px;
    color: #999;
    opacity: 0.5;
  }
}

.section-header-dark {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;

  .section-title {
    color: #1a1a1a;
    font-size: 1.25rem;
    font-weight: 600;
  }
}

.dark-card {
  background: #f5f5f5 !important;
  border-radius: 16px;
  border: none;
  color: #1a1a1a;
}


  .treasury-stat-label {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 8px;
  }

  .treasury-stat-value {
    color: #1a1a1a;
    font-size: 2rem;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .treasury-stat-unit {
    font-size: 0.875rem;
    margin-left: 4px;
  }

  .treasury-stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }


.action-performance-card {
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.2), 0 2px 2px rgba(0, 0, 0, 0.14), 0 3px 1px -2px rgba(0, 0, 0, 0.12);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;

  .action-performance-title {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }

  .action-performance-row {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }

  .action-performance-item {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .action-performance-number {
    color: #1a1a1a;
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 4px;
    line-height: 1.2;

    &.action-performance-tokens {
      color: #FFFF00;
    }
  }

  .action-performance-caption {
    color: #666;
    font-size: 0.75rem;
    line-height: 1.2;
  }
}


.transaction-icon-table {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;

  &.icon-positive {
    background: #dfffe0; // Light green circle
  }
  
  &.icon-negative {
    background: #ffe7e7; // Light red circle
  }
  
  &.icon-rotate-incoming {
    .q-icon {
      transform: rotate(45deg); // Rotate to point down-left
    }
  }
  
  &.icon-rotate-outgoing {
    .q-icon {
      transform: rotate(45deg); // Rotate to point up-right
    }
  }
}

.transaction-title-table {
  color: #1a1a1a;
  font-size: 0.9375rem;
  font-weight: 500;
}

.transaction-user-table {
  color: #1a1a1a;
  font-size: 0.875rem;
}

.transaction-action-campaign-table {
  color: #1a1a1a;
  font-size: 0.875rem;
}

.transaction-time-table {
  font-size: 0.875rem;
  color: #666;
}

.dark-table {
  background: transparent !important;
  color: #1a1a1a !important;

  :deep(.q-table__top) {
    background: transparent;
    color: #1a1a1a;
  }

  :deep(.q-table thead th) {
    background: transparent;
    color: #666;
    border-bottom: 1px solid #ddd;
  }

  :deep(.q-table tbody td) {
    background: transparent;
    color: #1a1a1a;
    border-bottom: 1px solid #ddd;
  }

  :deep(.q-table tbody tr:hover) {
    background: rgba(0, 0, 0, 0.05);
  }

  :deep(.q-table tbody td.amount-positive) {
    color: #65c802;
    font-weight: 600;
  }

  :deep(.q-table tbody td.amount-negative) {
    color: #EE4790;
    font-weight: 600;
  }
}

.dark-input {
  :deep(.q-field__control) {
    background: #f5f5f5;
    color: #1a1a1a;
  }

  :deep(.q-field__native) {
    color: #1a1a1a;
  }
}


@media (max-width: 599px) {
  .dashboard-title {
    font-size: 1.25rem !important;
  }

  .stat-value {
    font-size: 1.25rem !important;
  }

  .treasury-stat-value {
    font-size: 1.5rem !important;
  }
}
</style>
