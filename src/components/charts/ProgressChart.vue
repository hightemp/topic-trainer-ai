<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Filler
} from 'chart.js';

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Filler
);

interface DailyProgress {
  date: string;
  averageScore: number;
  totalAttempts: number;
}

const props = defineProps<{
  progress: DailyProgress[];
}>();

const chartData = computed(() => ({
  labels: props.progress.map(p => p.date),
  datasets: [
    {
      label: 'Средний балл',
      data: props.progress.map(p => p.averageScore),
      borderColor: 'rgba(99, 102, 241, 1)',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: 'rgba(99, 102, 241, 1)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointHoverBackgroundColor: 'rgba(99, 102, 241, 1)',
      pointHoverBorderColor: '#fff',
    }
  ]
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
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
          const progress = props.progress[context.dataIndex];
          return progress ? `Попыток: ${progress.totalAttempts}` : '';
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
        color: 'rgba(75, 85, 99, 0.2)'
      }
    }
  }
}));
</script>

<template>
  <div class="chart-container">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}
</style>
