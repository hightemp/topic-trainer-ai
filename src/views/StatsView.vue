<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDataStore } from '../stores/data';
import { dbService } from '../services/db';
import { aiService } from '../services/ai';
import { BarChart2, TrendingUp, Brain, Target, Award, Calendar } from 'lucide-vue-next';
import type { Attempt } from '../types';
import { renderMarkdown } from '../utils/markdown';
import CategoryStatsChart from '../components/charts/CategoryStatsChart.vue';
import ProgressChart from '../components/charts/ProgressChart.vue';

const dataStore = useDataStore();
const attempts = ref<Attempt[]>([]);
const isLoading = ref(true);
const aiAnalysis = ref('');
const isAnalyzing = ref(false);
const selectedPeriod = ref<'7' | '30' | 'all'>('30');

onMounted(async () => {
  if (!dataStore.isLoaded) await dataStore.loadData();
  
  // Оптимизированная загрузка - один запрос вместо N+1
  attempts.value = await dbService.getAllAttempts();
  attempts.value.sort((a, b) => b.date - a.date);
  
  isLoading.value = false;
});

// Базовые метрики
const totalAttempts = computed(() => attempts.value.length);

const averageScore = computed(() => {
  if (totalAttempts.value === 0) return 0;
  const sum = attempts.value.reduce((acc, curr) => acc + curr.aiScore, 0);
  return (sum / totalAttempts.value).toFixed(1);
});

const successRate = computed(() => {
  if (totalAttempts.value === 0) return 0;
  const successfulAttempts = attempts.value.filter(a => a.aiScore >= 7).length;
  return ((successfulAttempts / totalAttempts.value) * 100).toFixed(1);
});

const totalStudyTime = computed(() => {
  const totalSeconds = attempts.value.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
});

// Статистика по категориям
const categoryStats = computed(() => {
  const statsByCategory = new Map<string, { scores: number[]; categoryName: string }>();
  
  attempts.value.forEach(attempt => {
    const question = dataStore.questions.find(q => q.id === attempt.questionId);
    if (!question) return;
    
    const category = dataStore.categories.find(c => c.id === question.categoryId);
    const categoryName = category?.name || 'Без категории';
    
    if (!statsByCategory.has(question.categoryId)) {
      statsByCategory.set(question.categoryId, { scores: [], categoryName });
    }
    
    statsByCategory.get(question.categoryId)!.scores.push(attempt.aiScore);
  });
  
  return Array.from(statsByCategory.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.categoryName,
      averageScore: Number((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)),
      totalAttempts: data.scores.length
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
});

// Динамика прогресса
const progressData = computed(() => {
  const now = Date.now();
  const daysToShow = selectedPeriod.value === 'all' ? 365 : parseInt(selectedPeriod.value);
  const startDate = now - (daysToShow * 24 * 60 * 60 * 1000);
  
  const filteredAttempts = attempts.value.filter(a => a.date >= startDate);
  
  // Группировка по дням
  const dailyData = new Map<string, number[]>();
  
  filteredAttempts.forEach(attempt => {
    const dateKey = new Date(attempt.date).toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit' 
    });
    
    if (!dailyData.has(dateKey)) {
      dailyData.set(dateKey, []);
    }
    
    dailyData.get(dateKey)!.push(attempt.aiScore);
  });
  
  return Array.from(dailyData.entries())
    .map(([date, scores]) => ({
      date,
      averageScore: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
      totalAttempts: scores.length
    }))
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('.').map(n => parseInt(n));
      const [dayB, monthB] = b.date.split('.').map(n => parseInt(n));
      const monthDiff = (monthA || 0) - (monthB || 0);
      return monthDiff !== 0 ? monthDiff : (dayA || 0) - (dayB || 0);
    })
    .slice(-30); // Показываем максимум последние 30 точек
});

const recentActivity = computed(() => attempts.value.slice(0, 10));

async function analyzeStats() {
  if (attempts.value.length === 0) return;
  isAnalyzing.value = true;

  const recentAttempts = attempts.value.slice(0, 20).map(a => {
    const q = dataStore.questions.find(q => q.id === a.questionId);
    return {
      question: q ? q.text.substring(0, 100) : 'Deleted',
      score: a.aiScore,
      userAnswer: a.userAnswer.substring(0, 100),
      feedback: a.aiFeedback.substring(0, 100)
    };
  });

  const statsSummary = `
  Всего попыток: ${totalAttempts.value}
  Средний балл: ${averageScore.value}
  Процент успеха (≥7): ${successRate.value}%
  Общее время обучения: ${totalStudyTime.value}
  
  Статистика по категориям:
  ${categoryStats.value.map(c => `- ${c.categoryName}: ${c.averageScore} (${c.totalAttempts} попыток)`).join('\n')}
  
  Последние попытки: ${JSON.stringify(recentAttempts)}
`;

  try {
    const response = await aiService.chat([
      {
        role: 'system',
        content: 'Ты аналитик обучения. Проанализируй статистику пользователя и дай конкретные советы по улучшению знаний. Укажи сильные и слабые стороны, рекомендации по темам для повторения. Будь краток и конструктивен.'
      },
      {
        role: 'user',
        content: `Вот моя статистика:\n${statsSummary}`
      }
    ], async () => ({}));

    aiAnalysis.value = response.content || 'Не удалось получить анализ.';
  } catch (e) {
    console.error(e);
    aiAnalysis.value = 'Ошибка анализа. Проверьте настройки API.';
  } finally {
    isAnalyzing.value = false;
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('ru-RU') + ' ' + new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function getQuestionText(id: string) {
  const q = dataStore.questions.find(q => q.id === id);
  return q ? q.text.substring(0, 100) + (q.text.length > 100 ? '...' : '') : 'Вопрос удален';
}
</script>

<template>
  <div class="container">
    <h1>📊 Статистика</h1>

    <div v-if="isLoading" class="loading">
      <p>Загрузка статистики...</p>
    </div>

    <template v-else>
      <!-- Основные метрики -->
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

        <div class="card stat-card">
          <div class="stat-icon"><Target :size="32" /></div>
          <div class="stat-info">
            <span class="stat-value">{{ successRate }}%</span>
            <span class="stat-label">Успешность</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-icon"><Calendar :size="32" /></div>
          <div class="stat-info">
            <span class="stat-value">{{ totalStudyTime }}</span>
            <span class="stat-label">Время обучения</span>
          </div>
        </div>
      </div>

      <!-- График динамики прогресса -->
      <div class="card mt-4" v-if="progressData.length > 0">
        <div class="flex justify-between items-center mb-4">
          <h3>📈 Динамика прогресса</h3>
          <div class="period-selector">
            <button 
              :class="{ active: selectedPeriod === '7' }" 
              @click="selectedPeriod = '7'"
            >
              7 дней
            </button>
            <button 
              :class="{ active: selectedPeriod === '30' }" 
              @click="selectedPeriod = '30'"
            >
              30 дней
            </button>
            <button 
              :class="{ active: selectedPeriod === 'all' }" 
              @click="selectedPeriod = 'all'"
            >
              Всё время
            </button>
          </div>
        </div>
        <ProgressChart :progress="progressData" />
      </div>

      <!-- График по категориям -->
      <div class="card mt-4" v-if="categoryStats.length > 0">
        <h3>📚 Статистика по категориям</h3>
        <CategoryStatsChart :stats="categoryStats" />
        
        <!-- Таблица с детальной статистикой -->
        <div class="category-table mt-4">
          <table>
            <thead>
              <tr>
                <th>Категория</th>
                <th>Средний балл</th>
                <th>Попыток</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in categoryStats" :key="stat.categoryId">
                <td class="category-name">{{ stat.categoryName }}</td>
                <td class="score-cell">
                  <span class="score-badge" :class="getScoreClass(stat.averageScore)">
                    {{ stat.averageScore }}
                  </span>
                </td>
                <td>{{ stat.totalAttempts }}</td>
                <td>
                  <span class="status-badge" :class="getStatusClass(stat.averageScore)">
                    {{ getStatusText(stat.averageScore) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- AI Анализ -->
      <div class="card mt-4">
        <div class="flex justify-between items-center mb-4">
          <h3><Brain :size="20" style="display: inline; margin-right: 8px;" />AI Анализ</h3>
          <button class="primary" @click="analyzeStats" :disabled="isAnalyzing || totalAttempts === 0">
            <Brain :size="16" style="margin-right: 8px" />
            {{ isAnalyzing ? 'Анализ...' : 'Анализировать' }}
          </button>
        </div>
        <div v-if="aiAnalysis" class="markdown-body" v-html="renderMarkdown(aiAnalysis)"></div>
        <p v-else class="opacity-70">Нажмите кнопку, чтобы получить персональные советы от AI на основе вашей статистики.</p>
      </div>

      <!-- История активности -->
      <div class="card mt-4">
        <h3>🕐 История активности</h3>
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
                 <strong>Ваш ответ:</strong> {{ attempt.userAnswer.substring(0, 150) }}{{ attempt.userAnswer.length > 150 ? '...' : '' }}
               </div>
            </div>
          </div>
          <p v-if="recentActivity.length === 0" class="opacity-70">История пуста. Начните тренировку!</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  methods: {
    getScoreClass(score: number) {
      if (score >= 8) return 'excellent';
      if (score >= 7) return 'good';
      if (score >= 5) return 'average';
      return 'poor';
    },
    getStatusClass(score: number) {
      if (score >= 8) return 'status-excellent';
      if (score >= 7) return 'status-good';
      if (score >= 5) return 'status-average';
      return 'status-poor';
    },
    getStatusText(score: number) {
      if (score >= 8) return '🏆 Отлично';
      if (score >= 7) return '✅ Хорошо';
      if (score >= 5) return '⚠️ Средне';
      return '❌ Требует внимания';
    }
  }
};
</script>

<style scoped>
.container {
  animation: fadeIn var(--transition-base);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
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
  display: flex;
  align-items: center;
}

.period-selector {
  display: flex;
  gap: var(--spacing-xs);
  background: var(--color-surface-hover);
  padding: var(--spacing-xs);
  border-radius: var(--radius-lg);
}

.period-selector button {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.period-selector button:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.period-selector button.active {
  background: var(--color-primary);
  color: white;
}

.category-table {
  overflow-x: auto;
}

.category-table table {
  width: 100%;
  border-collapse: collapse;
}

.category-table th {
  text-align: left;
  padding: var(--spacing-md);
  background: var(--color-surface-hover);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.category-table td {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.category-name {
  font-weight: var(--font-weight-medium);
}

.score-cell {
  text-align: center;
}

.score-badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
}

.score-badge.excellent {
  background: var(--color-success-light);
  color: var(--color-success);
  border: 1px solid var(--color-success);
}

.score-badge.good {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  border: 1px solid rgb(59, 130, 246);
}

.score-badge.average {
  background: rgba(251, 191, 36, 0.1);
  color: rgb(251, 191, 36);
  border: 1px solid rgb(251, 191, 36);
}

.score-badge.poor {
  background: var(--color-danger-light);
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.status-badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.status-badge.status-excellent {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-badge.status-good {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
}

.status-badge.status-average {
  background: rgba(251, 191, 36, 0.1);
  color: rgb(251, 191, 36);
}

.status-badge.status-poor {
  background: var(--color-danger-light);
  color: var(--color-danger);
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
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }

  .stat-card {
    gap: var(--spacing-md);
  }

  .stat-icon {
    padding: var(--spacing-md);
  }

  .stat-value {
    font-size: var(--font-size-2xl);
  }

  .history-item {
    padding: var(--spacing-md);
  }

  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .period-selector {
    flex-direction: column;
    width: 100%;
  }

  .period-selector button {
    width: 100%;
  }

  .category-table {
    font-size: var(--font-size-sm);
  }
}
</style>
