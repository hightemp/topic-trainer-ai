<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDataStore } from '../stores/data';
import { dbService } from '../services/db';
import { aiService } from '../services/ai';
import { BarChart2, TrendingUp, Brain } from 'lucide-vue-next';
import type { Attempt } from '../types';
import { marked } from 'marked';

const dataStore = useDataStore();
const attempts = ref<Attempt[]>([]);
const isLoading = ref(true);
const aiAnalysis = ref('');
const isAnalyzing = ref(false);

onMounted(async () => {
  if (!dataStore.isLoaded) await dataStore.loadData();
  
  // Load all attempts (inefficient for large DB, but ok for MVP)
  // Ideally we should have an index or query by date range
  
  const allAttempts: Attempt[] = [];
  for (const q of dataStore.questions) {
    const qAttempts = await dbService.getAttemptsByQuestion(q.id);
    allAttempts.push(...qAttempts);
  }
  
  attempts.value = allAttempts.sort((a, b) => b.date - a.date);
  isLoading.value = false;
});

const totalAttempts = computed(() => attempts.value.length);
const averageScore = computed(() => {
  if (totalAttempts.value === 0) return 0;
  const sum = attempts.value.reduce((acc, curr) => acc + curr.aiScore, 0);
  return (sum / totalAttempts.value).toFixed(1);
});

const recentActivity = computed(() => attempts.value.slice(0, 10));

async function analyzeStats() {
  if (attempts.value.length === 0) return;
  isAnalyzing.value = true;

  const statsSummary = `
    Total Attempts: ${totalAttempts.value}
    Average Score: ${averageScore.value}
    Recent Scores: ${attempts.value.slice(0, 20).map(a => a.aiScore).join(', ')}
    Weakest Questions (IDs): ...
  `;

  try {
    const response = await aiService.chat([
      {
        role: 'system',
        content: 'Ты аналитик обучения. Проанализируй статистику пользователя и дай советы по улучшению знаний. Будь краток и конструктивен.'
      },
      {
        role: 'user',
        content: `Вот моя статистика:\n${statsSummary}`
      }
    ], async () => ({})); // No tools needed here

    aiAnalysis.value = response.content || 'Не удалось получить анализ.';
  } catch (e) {
    console.error(e);
    aiAnalysis.value = 'Ошибка анализа.';
  } finally {
    isAnalyzing.value = false;
  }
}

function renderMarkdown(text: string) {
  return marked(text || '');
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString() + ' ' + new Date(ts).toLocaleTimeString();
}
</script>

<template>
  <div class="container">
    <h1>Статистика</h1>

    <div class="stats-grid mt-4">
      <div class="card stat-card">
        <div class="stat-icon"><BarChart2 :size="32" /></div>
        <div class="stat-info">
          <span class="stat-value">{{ totalAttempts }}</span>
          <span class="stat-label">Всего ответов</span>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon"><TrendingUp :size="32" /></div>
        <div class="stat-info">
          <span class="stat-value">{{ averageScore }}</span>
          <span class="stat-label">Средний балл</span>
        </div>
      </div>
    </div>

    <div class="card mt-4">
      <div class="flex justify-between items-center mb-4">
        <h3>AI Анализ</h3>
        <button class="primary" @click="analyzeStats" :disabled="isAnalyzing || totalAttempts === 0">
          <Brain :size="16" style="margin-right: 8px" />
          {{ isAnalyzing ? 'Анализ...' : 'Анализировать' }}
        </button>
      </div>
      <div v-if="aiAnalysis" class="markdown-body" v-html="renderMarkdown(aiAnalysis)"></div>
      <p v-else class="opacity-70">Нажмите кнопку, чтобы получить советы от AI на основе вашей статистики.</p>
    </div>

    <div class="card mt-4">
      <h3>История активности</h3>
      <div class="history-list mt-4">
        <div v-for="attempt in recentActivity" :key="attempt.id" class="history-item">
          <div class="history-header">
            <span class="date">{{ formatDate(attempt.date) }}</span>
            <span class="score" :class="attempt.aiScore >= 7 ? 'text-success' : 'text-danger'">
              {{ attempt.aiScore }}/10
            </span>
          </div>
          <div class="history-q">
             <!-- We need to find question text, but it might be deleted. -->
             <!-- Ideally store question snapshot in attempt, but for now lookup -->
             Question ID: {{ attempt.questionId.substring(0, 8) }}...
          </div>
        </div>
        <p v-if="recentActivity.length === 0" class="opacity-70">История пуста.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.stat-icon {
  color: var(--color-primary);
  background-color: rgba(100, 108, 255, 0.1);
  padding: 12px;
  border-radius: 50%;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 2em;
  font-weight: bold;
}

.stat-label {
  opacity: 0.7;
}

.history-list {
  display: flex;
  flex-direction: column;
}

.history-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.history-item:last-child {
  border-bottom: none;
}

.history-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
  margin-bottom: 4px;
}

.date { opacity: 0.6; }

.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }
</style>