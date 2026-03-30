<template>
    <q-drawer
      :model-value="true"
      :mini="mini"
      show-if-above
      bordered
      class="bg-grey-4"
      :width="200"
      :breakpoint="500"
    >
      <q-list>
        <q-item clickable v-ripple exact to="/chat">
          <q-item-section avatar>
            <q-icon name="chat" color="hrdao-light" />
          </q-item-section>
          <q-item-section>
            {{ $t('chat') }}
          </q-item-section>
        </q-item>
        
        <q-separator color="hrdao-light" />

        <q-item clickable v-ripple exact to="/wallet">
          <q-item-section avatar>
            <q-icon name="account_balance_wallet" color="hrdao-light" />
          </q-item-section>
          <q-item-section>
            {{ $t('wallet') }}
          </q-item-section>
        </q-item>

        <q-separator color="hrdao-light" />

        <q-item v-if="auth.user.status === 'admin'" clickable v-ripple to="/admin" exact>
          <q-item-section avatar>
            <q-icon name="admin_panel_settings" color="hrdao-light" />
          </q-item-section>
          <q-item-section>
            {{ $t('adminDashboard') }}
          </q-item-section>
        </q-item>

        <q-separator color="hrdao-light" />
        
        <q-item clickable v-ripple exact @click="logout">
          <q-item-section avatar>
            <q-icon name="logout" color="hrdao-light" />
          </q-item-section>
          <q-item-section>
            {{ $t('closeApp') }}
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>
</template>

<script setup lang="ts">
import { useAuthStore } from '../stores/auth';
import { App } from '@capacitor/app';
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const mini = ref(false);

// Watch route to set mini state
watch(() => router.currentRoute.value.path, (path) => {
  mini.value = path.startsWith('/chat');
}, { immediate: true });

async function logout() {
  await auth.logout();
  await App.exitApp();
}

</script>

<style scoped>
.chat-panel {
  position: fixed;
  left: 56px;
  top: 0;
  width: 150px;
  height: 100vh;
  background: var(--q-accent);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 100;
  border-right: 1px solid rgba(0,0,0,0.12);
}

.chat-panel-open {
  transform: translateX(0);
}
</style> 