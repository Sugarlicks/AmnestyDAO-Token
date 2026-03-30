<template>
  <q-footer class="footer-bg">
    <q-toolbar>
      <q-btn
        stretch
        flat
        icon="chat"
        to="/chat"
        exact
        color="primary"
      />
      <q-btn
        stretch
        flat
        icon="account_balance_wallet"
        to="/wallet"
        exact
        color="primary"
      />
      <q-btn
        v-if="auth.user.status === 'admin'"
        stretch
        flat
        icon="admin_panel_settings"
        to="/admin"
        exact
        color="primary"
      />
      <q-btn
        stretch
        flat
        icon="logout"
        @click="logout"
        color="primary"
      />
    </q-toolbar>
  </q-footer>
</template>

<script setup lang="ts">
import { useAuthStore } from '../stores/auth';
import { App } from '@capacitor/app';

const auth = useAuthStore();

async function logout() {
  await auth.logout();
  await App.exitApp();
}
</script>

<style scoped>
.q-toolbar {
  justify-content: space-around;
}

.footer-bg {
  background-color: rgba(255, 255, 255, 0.8);
}
</style> 