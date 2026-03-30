<template>
  <q-page class="full-height relative-position">
    <!-- Full-screen overlay -->
    <div v-if="busy" class="absolute-full bg-white flex flex-center">
      <q-spinner size="50px" />
      <div class="text-subtitle2 q-ml-md">{{ $t('lookingForAccountKeys') }}</div>
    </div>

    <!-- Pending-approval message -->
    <div v-else-if="auth.accountStatus === 'pending'" class="absolute-full bg-grey-1 flex flex-center">
      <q-card>
        <q-card-section class="text-center">
          <div class="text-h6">{{ $t('accountPendingApprovalTitle') }}</div>
          <div class="text-body1 q-mt-sm">
            {{ $t('deviceRegistrationAwaiting') }}<br/>
            {{ $t('pleaseCheckBackLater') }}
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Success message -->
    <div v-else-if="auth.jwt" class="absolute-full bg-positive flex flex-center">
      <q-card>
        <q-card-section class="text-center">
          <div class="text-h6">{{ $t('loginSuccessful') }}</div>
          <div class="text-body1 q-mt-sm">
            {{ $t('redirectingToDashboard') }}
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- If we somehow fall back here -->
    <div v-else-if="auth.accountStatus === 'unknown'">
      <!-- redirecting to /register by script -->
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

defineOptions({
  name: 'LoginPage'
});

const router = useRouter();
const auth = useAuthStore();
const busy = ref(true);

async function checkAndLogin() {
  try {
    // 1) Do we have a stored private key?
    const { value: mnemonic } = await SecureStoragePlugin.get({ key: 'mnemonic' });
    if (!mnemonic) {
      return router.replace('/register');
    }

    // 2) Do we have a stored userId?
    const { value: userId } = await SecureStoragePlugin.get({ key: 'user-id' });
    if (!userId) {
      return router.replace('/register');
    }

    // 3) Attempt login
    auth.userId = userId;
    await auth.login();
    
    // If we get here and have a JWT, redirect to dashboard
    if (auth.jwt) {
      router.replace('/chat');
    }
  } catch (error) {
    console.error('Login check error:', error);
    return router.replace('/register');
    // Error handling is now managed by auth store
  }
}

onMounted(async () => {
  await checkAndLogin();
  busy.value = false;
});
</script>

<style scoped>
.full-height { height: 100vh; }
.absolute-full { position: absolute; top: 0; bottom: 0; left: 0; right: 0; }
.flex { display: flex; }
.flex-center { align-items: center; justify-content: center; }
</style>
