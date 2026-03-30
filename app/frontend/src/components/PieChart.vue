<template>
  <div class="pie-chart-container">
    <svg :width="size" :height="size" class="pie-chart-svg">
      <g :transform="`translate(${size / 2}, ${size / 2})`">
        <path
          v-for="(segment, index) in paths"
          :key="`path-${index}`"
          :d="segment.path"
          :fill="segment.color"
          :stroke="strokeColor"
          :stroke-width="strokeWidth"
          class="pie-segment"
        >
          <title>{{ segment.label }}: {{ segment.value }} ({{ segment.percentage }}%)</title>
        </path>
      </g>
      <g v-if="showCenterText" :transform="`translate(${size / 2}, ${size / 2})`">
        <text
          text-anchor="middle"
          dominant-baseline="middle"
          :font-size="centerTextSize"
          :fill="centerTextColor"
          class="pie-center-text"
        >
          {{ centerText }}
        </text>
      </g>
    </svg>
    <div v-if="showLegend" class="pie-legend">
      <div
        v-for="(item, index) in dataWithPercentages"
        :key="index"
        class="legend-item"
      >
        <div
          class="legend-color"
          :style="{ backgroundColor: item.color }"
        />
        <span class="legend-label">{{ item.label }}</span>
        <span class="legend-value">{{ Math.round(item.value * 100) / 100 }} ({{ item.percentage }}%)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: PieChartData[];
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
  showLegend?: boolean;
  showCenterText?: boolean;
  centerText?: string;
  centerTextSize?: number;
  centerTextColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 200,
  strokeColor: '#ffffff',
  strokeWidth: 2,
  showLegend: true,
  showCenterText: false,
  centerText: '',
  centerTextSize: 16,
  centerTextColor: '#000000'
});

const radius = computed(() => props.size / 2 - props.strokeWidth);

const total = computed(() => {
  return props.data.reduce((sum, item) => sum + item.value, 0);
});

const dataWithPercentages = computed(() => {
  return props.data.map(item => ({
    ...item,
    percentage: total.value > 0 ? Math.round((item.value / total.value) * 100) : 0
  }));
});

const paths = computed(() => {
  if (total.value === 0) return [];
  
  const paths: Array<{ path: string; color: string; label: string; value: number; percentage: number }> = [];
  let currentAngle = -90; // Start from top
  
  dataWithPercentages.value.forEach((item) => {
    if (item.value === 0) return;
    
    const angle = (item.value / total.value) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const x1 = radius.value * Math.cos(startAngleRad);
    const y1 = radius.value * Math.sin(startAngleRad);
    const x2 = radius.value * Math.cos(endAngleRad);
    const y2 = radius.value * Math.sin(endAngleRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const path = `M 0 0 L ${x1} ${y1} A ${radius.value} ${radius.value} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    
    paths.push({
      path,
      color: item.color,
      label: item.label,
      value: item.value,
      percentage: item.percentage
    });
    
    currentAngle = endAngle;
  });
  
  return paths;
});

</script>

<style scoped>
.pie-chart-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.pie-chart-svg {
  display: block;
}

.pie-segment {
  cursor: pointer;
  transition: opacity 0.2s;
}

.pie-segment:hover {
  opacity: 0.8;
}

.pie-center-text {
  font-weight: bold;
  pointer-events: none;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  color: #333;
}

.legend-value {
  color: #666;
  font-weight: 500;
}
</style>

