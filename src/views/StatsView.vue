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

  const recentAttempts = attempts.value.slice(0, 20).map(a => {
    const q = dataStore.questions.find(q => q.id === a.questionId);
    return {
      question: q ? q.text : 'Deleted',
      score: a.aiScore,
      userAnswer: a.userAnswer,
      feedback: a.aiFeedback
    };
  });

  const statsSummary = `
  Total Attempts: ${totalAttempts.value}
  Average Score: ${averageScore.value}
  Recent Activity: ${JSON.stringify(recentAttempts)}
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

function getQuestionText(id: string) {
  const q = dataStore.questions.find(q => q.id === id);
  return q ? q.text.substring(0, 100) + (q.text.length > 100 ? '...' : '') : 'Вопрос удален';
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
             <div class="q-text-preview">
               <strong>Вопрос:</strong> {{ getQuestionText(attempt.questionId) }}
             </div>
             <div class="user-answer-preview">
               <strong>Ваш ответ:</strong> {{ attempt.userAnswer }}
             </div>
          </div>
        </div>
        <p v-if="recentActivity.length === 0" class="opacity-70">История пуста.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  animation: fadeIn var(--transition-base);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
  animation: slideInRight var(--transition-base);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%);
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-accent) 100%);
}

.stat-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: var(--shadow-xl);
}

.stat-icon {
  color: white;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  padding: var(--spacing-lg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-base);
}

.stat-card:hover .stat-icon {
  transform: scale(1.1) rotate(5deg);
  box-shadow: var(--shadow-xl);
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.stat-value {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card {
  animation: fadeIn var(--transition-slow);
}

.card h3 {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--color-border);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.history-item {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
  background: var(--color-surface);
}

.history-item:hover {
  background: var(--color-surface-hover);
  transform: translateX(4px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
}

.history-item:last-child {
  border-bottom: none;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
  font-weight: var(--font-weight-medium);
}

.date {
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.score {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
}

.text-success {
  color: var(--color-success);
  background: var(--color-success-light);
  border: 1px solid var(--color-success);
}

.text-danger {
  color: var(--color-danger);
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger);
}

.history-q {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.q-text-preview,
.user-answer-preview {
  padding: var(--spacing-md);
  background: var(--color-surface-hover);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.user-answer-preview {
  border-left-color: var(--color-accent);
}

.q-text-preview strong,
.user-answer-preview strong {
  display: block;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.markdown-body {
  line-height: var(--line-height-relaxed);
  padding: var(--spacing-lg);
  background: var(--color-surface-hover);
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  .stat-card {
    gap: var(--spacing-md);
  }

  .stat-icon {
    padding: var(--spacing-md);
  }

  .stat-value {
    font-size: var(--font-size-3xl);
  }

  .history-item {
    padding: var(--spacing-md);
  }

  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }
}
</style>