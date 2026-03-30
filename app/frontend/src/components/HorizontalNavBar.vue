<template>
  <div class="horizontal-navbar bg-white">
    <div class="navbar-container">
      <q-btn
        flat
        class="nav-item"
        :class="{ active: isActive('/actions') }"
        to="/actions"
        exact
      >
        <q-icon name="check_circle_outline" size="20px" class="nav-icon" />
        <span class="nav-label">{{ $t('actions')}}</span>
      </q-btn>
      
      <q-btn
        flat
        class="nav-item"
        :class="{ active: isActive('/campaigns') }"
        to="/campaigns"
        exact
      >
        <q-icon name="gps_fixed" size="20px" class="nav-icon" />
        <span class="nav-label">{{ $t('campaigns') }}</span>
      </q-btn>
      
      <q-btn
        flat
        class="nav-item"
        :class="{ active: isActive('/chat') }"
        to="/chat"
        exact
      >
        <q-icon name="chat_bubble_outline" size="20px" class="nav-icon" />
        <span class="nav-label">{{ $t('chat') }}</span>
      </q-btn>
    </div>
    <q-separator />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

defineOptions({
  name: 'HorizontalNavBar'
});

const route = useRoute();

function isActive(path: string): boolean {
  if (path === '/actions') {
    return route.path === '/actions' || route.path === '/contributions' || route.path === '/';
  }
  return route.path.startsWith(path);
}
</script>

<style scoped lang="scss">
.horizontal-navbar {
  border-top: 1px solid #e0e0e0;
  width: 100%;
}

.navbar-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0px 8px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  color: #424242;
  min-width: 80px;
  
  .nav-icon {
    color: #424242;
    margin-bottom: 2px;
  }
  
  .nav-label {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: capitalize;
    padding-left: 5px;
  }
  
  &.active {
    color: $accent;
    font-weight: 1000;
    
    .nav-icon {
      color: $accent;
      opacity: 1;
    }
    
    .nav-label {
      font-weight: 500;
    }
  }
  
  &:not(.active) {
    opacity: 0.8;
    
    .nav-icon {
      opacity: 0.8;
    }
  }
}

.q-separator {
  margin: 0;
  border-color: #e0e0e0;
}
</style>

