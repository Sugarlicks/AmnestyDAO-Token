import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/SplashScreen.vue') },
      { path: 'actions', component: () => import('pages/ContributionsList.vue') },
      { path: 'contributions', component: () => import('pages/ContributionsList.vue') },
      { path: 'contributions/:id', component: () => import('pages/ContributionDetails.vue') },
      { path: 'campaigns', component: () => import('pages/CampaignsList.vue') },
      { path: 'campaigns/:id', component: () => import('pages/CampaignDetails.vue') },
      { path: 'splash', component: () => import('pages/SplashScreen.vue') },
      { path: 'login', component: () => import('pages/Login.vue') },
      { path: 'register', component: () => import('pages/RegisterUser.vue') },
      { path: 'recovery', component: () => import('pages/Recovery.vue') },
      { path: 'chat', component: () => import('pages/ChatList.vue') },
      { path: 'chat/:id', component: () => import('pages/ChatRoom.vue') },
      { path: 'admin', component: () => import('pages/AdminDashboard.vue') },
      { path: 'admin/contributions', component: () => import('pages/AdminContributions.vue') },
      { path: 'admin/campaigns', component: () => import('pages/AdminCampaigns.vue') },
      { path: 'admin/chats', component: () => import('pages/AdminChat.vue') },
      { path: 'wallet', component: () => import('pages/Wallet.vue') }
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
