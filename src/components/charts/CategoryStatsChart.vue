<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

interface CategoryStat {
  categoryName: string;
  averageScore: number;
  totalAttempts: number;
}

const props = defineProps<{
  stats: CategoryStat[];
}>();

const chartData = computed(() => ({
  labels: props.stats.map(s => s.categoryName),
  datasets: [
    {
      label: 'Средний балл',
      data: props.stats.map(s => s.averageScore),
      backgroundColor: 'rgba(99, 102, 241, 0.8)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 2,
      borderRadius: 8,
    }
  ]
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: 'rgb(156, 163, 175)',
        font: {
          size: 12,
          family: "'Inter', sans-serif"
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      titleColor: 'rgb(243, 244, 246)',
      bodyColor: 'rgb(209, 213, 219)',
      borderColor: 'rgba(99, 102, 241, 0.5)',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        afterLabel: (context: any) => {
          const stat = props.stats[context.dataIndex];
          return stat ? `Попыток: ${stat.totalAttempts}` : '';
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 10,
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          size: 11
        }
      },
      grid: {
        color: 'rgba(75, 85, 99, 0.3)'
      }
    },
    x: {
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          size: 11
        },
        maxRotation: 45,
        minRotation: 0
      },
      grid: {
        display: false
      }
    }
  }
}));
</script>

<template>
  <div class="chart-container">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}
</style>
