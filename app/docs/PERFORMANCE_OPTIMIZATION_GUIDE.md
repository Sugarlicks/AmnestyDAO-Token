# Improving Loading Times for Actions and Campaigns on Android

## Overview

The Amnesty DAO app experiences slow loading times for actions (contributions) and campaigns on Android due to several performance bottlenecks. This guide outlines the root causes and provides actionable solutions to improve loading performance.

## Identified Bottlenecks

### 1. GraphQL Query Inefficiencies
- **Issue**: All queries use `fetchPolicy: 'network-only'`, forcing fresh network requests on every load
- **Impact**: No caching, increased network latency on mobile
- **Data Volume**: No pagination - all campaigns/contributions loaded at once

### 2. Image Processing Overhead
- **Issue**: Base64 image data converted from Uint8Array in JavaScript on the main thread
- **Impact**: CPU-intensive operations block UI rendering
- **Size**: Large images processed without optimization

### 3. Bundle Size and Loading Strategy
- **Issue**: No code splitting, entire app bundle loaded upfront
- **Impact**: Large initial bundle size delays app startup

### 4. Multiple Network Requests
- **Issue**: Separate queries for main data and user-specific data
- **Impact**: Waterfall effect increases total loading time

### 5. UI Rendering
- **Issue**: No virtual scrolling for potentially large lists
- **Impact**: All items rendered simultaneously

## Recommended Optimizations

### 1. Implement GraphQL Caching and Pagination

**Change fetchPolicy to enable caching:**
```typescript
// In stores/campaigns.ts and stores/contributions.ts
fetchPolicy: 'cache-first', // Use cache when available, fallback to network
```

**Add pagination to queries:**
```typescript
// Example for campaigns
query GetCampaigns($where: campaigns_bool_exp, $limit: Int, $offset: Int) {
  campaigns(where: $where, limit: $limit, offset: $offset) {
    // ... existing fields
  }
  campaigns_aggregate(where: $where) {
    aggregate {
      count
    }
  }
}
```

**Implement infinite scroll in components:**
```vue
<!-- In CampaignsList.vue and ContributionsList.vue -->
<q-infinite-scroll @load="loadMore" :disable="loading || !hasMore">
  <div v-for="item in items" :key="item.id">
    <!-- item content -->
  </div>
</q-infinite-scroll>
```

### 2. Optimize Image Handling

**Move image processing to Web Workers:**
```typescript
// Create imageProcessing.worker.ts
self.onmessage = (e) => {
  const { data, type } = e.data;
  const uint8Array = new Uint8Array(data);
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
  self.postMessage(`data:${type};base64,${base64}`);
};

// In stores, use worker for conversion
const worker = new Worker('./imageProcessing.worker.ts');
```

**Implement image lazy loading for campaigns:**
```vue
<!-- In CampaignsList.vue -->
<q-img
  :src="getImageUrl(campaign)"
  :ratio="16/9"
  loading="lazy"
  @load="handleImageLoad"
  @error="handleImageError"
>
  <!-- loading and error templates -->
</q-img>
```

**Compress images on backend:**
- Use WebP format for better compression
- Implement responsive images with multiple sizes
- Add image optimization pipeline in Hasura actions

### 3. Implement Code Splitting

**Lazy load route components:**
```typescript
// In router/routes.ts
{
  path: '/campaigns',
  component: () => import('pages/CampaignsList.vue'),
  children: [
    {
      path: ':id',
      component: () => import('pages/CampaignDetails.vue')
    }
  ]
}
```

**Dynamic imports for heavy dependencies:**
```typescript
// In stores/blockchain.ts
const { useBlockchainStore } = await import('./blockchain');
```

### 4. Optimize Network Requests

**Combine queries using GraphQL fragments:**
```typescript
query GetCampaignsAndUserData($where: campaigns_bool_exp) {
  campaigns(where: $where) {
    ...CampaignFields
    user_donations(where: { user_id: { _eq: $userId } }) {
      ...DonationFields
    }
  }
}
```

**Implement request batching:**
```typescript
// Use Apollo Link Batch HTTP Link for mobile
import { BatchHttpLink } from '@apollo/client/link/batch-http';

const batchLink = new BatchHttpLink({
  uri: GRAPHQL_ENDPOINT,
  batchMax: 5, // Batch up to 5 operations
  batchInterval: 20 // Wait 20ms for batching
});
```

### 5. Add Virtual Scrolling for Large Lists

**Implement virtual scrolling:**
```vue
<!-- Using quasar virtual-scroll -->
<q-virtual-scroll
  :items="campaigns"
  :item-size="200"
  :items-fn="getItems"
>
  <template v-slot="{ item, index }">
    <campaign-card :campaign="item" />
  </template>
</q-virtual-scroll>
```

### 6. Mobile-Specific Optimizations

**Add Capacitor-specific caching:**
```typescript
// In boot/apollo.ts
import { Capacitor } from '@capacitor/core';

const cacheOptions = Capacitor.isNativePlatform() ? {
  possibleTypes: {}, // Add for better caching
  dataIdFromObject: (object) => object.id
} : {};
```

**Optimize for mobile network conditions:**
```typescript
// Detect network type and adjust loading strategy
import { Network } from '@capacitor/network';

const networkStatus = await Network.getStatus();
const isSlowNetwork = networkStatus.connectionType === '2g' || networkStatus.connectionType === '3g';

// Reduce image quality or disable non-essential features on slow networks
```

### 7. Performance Monitoring

**Add performance tracking:**
```typescript
// In components
onMounted(() => {
  performance.mark('campaigns-load-start');
});

onUpdated(() => {
  performance.mark('campaigns-load-end');
  performance.measure('campaigns-loading', 'campaigns-load-start', 'campaigns-load-end');
  console.log(performance.getEntriesByName('campaigns-loading')[0].duration);
});
```

## Implementation Priority

1. **High Priority** (Immediate impact):
   - Change GraphQL fetchPolicy to 'cache-first'
   - Implement lazy loading for images
   - Add basic pagination

2. **Medium Priority**:
   - Code splitting for routes
   - Combine GraphQL queries
   - Virtual scrolling for large lists

3. **Low Priority** (Future enhancements):
   - Web Workers for image processing
   - Advanced caching strategies
   - Network-aware loading

## Expected Improvements

- **Initial load**: 50-70% faster with caching and pagination
- **Image loading**: 30-50% improvement with lazy loading and optimization
- **Bundle size**: 40-60% reduction in initial load with code splitting
- **Memory usage**: Significant reduction with virtual scrolling

## Testing Recommendations

- Test on various Android devices (low-end to high-end)
- Monitor performance in Chrome DevTools with device simulation
- Use Lighthouse for mobile performance audits
- A/B test loading times before and after optimizations

## Monitoring and Maintenance

- Implement error boundaries for failed optimizations
- Add performance budgets in build process
- Monitor Core Web Vitals in production
- Regularly audit bundle size and loading performance</content>
<parameter name="filePath">frontend/PERFORMANCE_OPTIMIZATION_GUIDE.md