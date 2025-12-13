<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDataStore } from '../stores/data';
import { aiService } from '../services/ai';
import { dbService } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { renderMarkdown } from '../utils/markdown';
import { Play, CheckCircle, XCircle, Clock, AlertCircle, ListTree, Circle } from 'lucide-vue-next';
import type { Question, Attempt } from '../types';

const dataStore = useDataStore();
const mode = ref<'setup' | 'training' | 'result'>('setup');

// Setup
const selectedCategories = ref<Set<string>>(new Set());
const selectedTags = ref<Set<string>>(new Set());
const useTimer = ref(true);
const sessionQuestions = ref<Question[]>([]);
const currentQuestionIndex = ref(0);

// Training
const currentAnswer = ref('');
const isSubmitting = ref(false);
const startTime = ref(0);
const currentFeedback = ref<{ score: number; feedback: string } | null>(null);
const showTree = ref(false);

// Stats
const sessionResults = ref<Attempt[]>([]);

onMounted(async () => {
  if (!dataStore.isLoaded) await dataStore.loadData();
});

const allTags = computed(() => {
  const tags = new Set<string>();
  dataStore.questions.forEach(q => q.tags.forEach(t => tags.add(t)));
  return Array.from(tags);
});

function toggleCategory(id: string) {
  if (selectedCategories.value.has(id)) selectedCategories.value.delete(id);
  else selectedCategories.value.add(id);
}

function toggleTag(tag: string) {
  if (selectedTags.value.has(tag)) selectedTags.value.delete(tag);
  else selectedTags.value.add(tag);
}

function startSession() {
  const now = Date.now();
  
  // Helper to get all descendant category IDs
  const getDescendantIds = (parentId: string): string[] => {
    const children = dataStore.categories.filter(c => c.parentId === parentId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendantIds(c.id)];
    });
    return ids;
  };

  // Expand selected categories to include children
  const expandedCategories = new Set<string>();
  selectedCategories.value.forEach(catId => {
    expandedCategories.add(catId);
    getDescendantIds(catId).forEach(id => expandedCategories.add(id));
  });

  // Filter questions based on selection and due date (Spaced Repetition)
  let candidates = dataStore.questions.filter(q => {
    // Category filter (include descendants)
    // If no categories selected, include all (or handle as "no filter")
    // But if categories ARE selected, we must check if question belongs to one of them OR their descendants.
    if (selectedCategories.value.size > 0) {
       if (!expandedCategories.has(q.categoryId)) return false;
    }
    
    // Tag filter (if tags selected, must match at least one)
    if (selectedTags.value.size > 0 && !q.tags.some(t => selectedTags.value.has(t))) return false;
    return true;
  });

  // Sort by due date (overdue first)
  candidates.sort((a, b) => a.nextReviewDate - b.nextReviewDate);

  // Take top 20 or all
  // sessionQuestions.value = candidates.slice(0, 20);
  sessionQuestions.value = candidates;
  
  if (sessionQuestions.value.length === 0) {
    alert('Нет вопросов, соответствующих критериям.');
    return;
  }

  currentQuestionIndex.value = 0;
  sessionResults.value = [];
  mode.value = 'training';
  startQuestion();
}

function startQuestion() {
  currentAnswer.value = '';
  currentFeedback.value = null;
  startTime.value = Date.now();
}

async function submitAnswer() {
  if (!currentAnswer.value.trim()) return;
  isSubmitting.value = true;

  const question = sessionQuestions.value[currentQuestionIndex.value];
  if (!question) return;

  const duration = (Date.now() - startTime.value) / 1000;

  try {
    const result = await aiService.evaluateAnswer(question.text, question.correctAnswer, currentAnswer.value);
    currentFeedback.value = result;

    // Update SM-2
    // Quality: 0-5 scale for SM-2. AI gives 0-10. Map 0-10 -> 0-5.
    const quality = Math.round(result.score / 2);
    updateSpacedRepetition(question, quality);

    // Save Attempt
    const attempt: Attempt = {
      id: uuidv4(),
      questionId: question.id,
      date: Date.now(),
      userAnswer: currentAnswer.value,
      aiScore: result.score,
      aiFeedback: result.feedback,
      duration
    };
    await dbService.saveAttempt(attempt);
    sessionResults.value.push(attempt);

  } catch (e) {
    console.error(e);
    alert('Ошибка проверки ответа');
  } finally {
    isSubmitting.value = false;
  }
}

function updateSpacedRepetition(question: Question, quality: number) {
  // SM-2 Algorithm
  // q: 0-5
  // If q < 3, start over.
  
  let interval = 0;
  let repetitions = 0; // We don't store repetitions count in Question interface explicitly, 
                       // but we can infer or just use interval logic.
                       // Let's assume if interval == 0, it's new.
  
  // Simplified SM-2 implementation based on stored fields
  // We need to track 'repetitions' count properly for full SM-2, 
  // but let's approximate: if interval > 0, it's not first time.
  
  // Actually, let's just update interval and factor.
  let newFactor = question.repetitionFactor;
  let newInterval = question.interval;

  if (quality < 3) {
    newInterval = 1; // Start over
  } else {
    if (newInterval === 0) {
      newInterval = 1;
    } else if (newInterval === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(newInterval * newFactor);
    }
    
    // Update E-Factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    newFactor = newFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newFactor < 1.3) newFactor = 1.3;
  }

  const nextDate = Date.now() + (newInterval * 24 * 60 * 60 * 1000);
  
  // Update store
  dataStore.updateQuestion({
    ...question,
    interval: newInterval,
    repetitionFactor: newFactor,
    nextReviewDate: nextDate
  });
}

function nextQuestion() {
  if (currentQuestionIndex.value < sessionQuestions.value.length - 1) {
    currentQuestionIndex.value++;
    startQuestion();
  } else {
    mode.value = 'result';
  }
}

function getCategoryName(id: string) {
  const cat = dataStore.categories.find(c => c.id === id);
  return cat ? cat.name : 'Unknown';
}
</script>

<template>
  <div class="container">
    <!-- SETUP MODE -->
    <div v-if="mode === 'setup'" class="setup-screen">
      <h1>Настройка тренировки</h1>
      
      <div class="card mt-4">
        <h3>Категории</h3>
        <div class="tags-cloud">
          <button 
            v-for="cat in dataStore.categories" 
            :key="cat.id"
            class="chip"
            :class="{ active: selectedCategories.has(cat.id) }"
            @click="toggleCategory(cat.id)"
          >
            {{ cat.name }}
          </button>
        </div>
      </div>

      <div class="card mt-4">
        <h3>Теги</h3>
        <div class="tags-cloud">
          <button 
            v-for="tag in allTags" 
            :key="tag"
            class="chip"
            :class="{ active: selectedTags.has(tag) }"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <div class="actions mt-4">
        <button class="primary large" @click="startSession">
          <Play :size="24" /> Начать
        </button>
      </div>
    </div>

    <!-- TRAINING MODE -->
    <div v-else-if="mode === 'training'" class="training-screen">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${((currentQuestionIndex + 1) / sessionQuestions.length) * 100}%` }"
        ></div>
      </div>
      
      <div class="question-header">
        <span>Вопрос {{ currentQuestionIndex + 1 }} из {{ sessionQuestions.length }}</span>
        <button class="icon-btn" @click="showTree = true" title="Показать дерево вопросов">
          <ListTree :size="16" />
        </button>
        <span v-if="useTimer" class="timer"><Clock :size="16"/> ...</span>
      </div>

      <div v-if="showTree" class="modal-overlay" @click="showTree = false">
        <div class="modal-content" @click.stop>
          <h3>Вопросы в сессии</h3>
          <ul class="session-tree">
            <li v-for="(q, idx) in sessionQuestions" :key="q.id" :class="{ active: idx === currentQuestionIndex }">
              <span class="status-icon">
                <CheckCircle v-if="idx < currentQuestionIndex" :size="14" class="text-success" />
                <Circle v-else :size="14" />
              </span>
              <div class="q-info">
                <span class="q-cat">{{ getCategoryName(q.categoryId) }}</span>
                <span class="q-text">{{ q.text.substring(0, 50) }}...</span>
              </div>
            </li>
          </ul>
          <button class="primary mt-4" @click="showTree = false">Закрыть</button>
        </div>
      </div>

      <div class="card question-card" v-if="sessionQuestions[currentQuestionIndex]">
        <div class="markdown-body" v-html="renderMarkdown(sessionQuestions[currentQuestionIndex]?.text || '')"></div>
      </div>

      <div class="answer-section mt-4">
        <textarea 
          v-model="currentAnswer" 
          rows="6" 
          placeholder="Ваш ответ..."
          :disabled="!!currentFeedback || isSubmitting"
        ></textarea>
      </div>

      <div v-if="currentFeedback" class="feedback-section mt-4" :class="currentFeedback.score >= 7 ? 'good' : 'bad'">
        <div class="feedback-header">
          <CheckCircle v-if="currentFeedback.score >= 7" :size="24" />
          <AlertCircle v-else :size="24" />
          <span class="score">Оценка: {{ currentFeedback.score }}/10</span>
        </div>
        <p>{{ currentFeedback.feedback }}</p>
        
        <div class="correct-answer mt-4" v-if="sessionQuestions[currentQuestionIndex]">
          <strong>Правильный ответ:</strong>
          <div v-html="renderMarkdown(sessionQuestions[currentQuestionIndex]?.correctAnswer || '')"></div>
        </div>
      </div>

      <div class="actions mt-4">
        <button v-if="!currentFeedback" class="primary" @click="submitAnswer" :disabled="isSubmitting">
          {{ isSubmitting ? 'Проверка...' : 'Ответить' }}
        </button>
        <button v-else class="primary" @click="nextQuestion">
          {{ currentQuestionIndex < sessionQuestions.length - 1 ? 'Следующий вопрос' : 'Завершить' }}
        </button>
      </div>
    </div>

    <!-- RESULT MODE -->
    <div v-else class="result-screen">
      <h1>Результаты тренировки</h1>
      <div class="card mt-4">
        <div v-for="(res, idx) in sessionResults" :key="res.id" class="result-item">
          <div class="result-header">
            <strong>Вопрос {{ idx + 1 }}</strong>
            <span :class="res.aiScore >= 7 ? 'text-success' : 'text-danger'">{{ res.aiScore }}/10</span>
          </div>
          <p class="text-sm">{{ res.aiFeedback }}</p>
        </div>
      </div>
      <button class="primary mt-4" @click="mode = 'setup'">Новая тренировка</button>
    </div>
  </div>
</template>

<style scoped>
.setup-screen,
.training-screen,
.result-screen {
  animation: fadeIn var(--transition-base);
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.chip {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-full);
  border: 2px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  transition: all var(--transition-base);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  position: relative;
  overflow: hidden;
}

.chip::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.1);
  transform: translate(-50%, -50%);
  transition: width var(--transition-base), height var(--transition-base);
}

.chip:hover::before {
  width: 200px;
  height: 200px;
}

.chip:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.chip.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: white;
  border-color: transparent;
  box-shadow: var(--shadow-lg);
  transform: scale(1.05);
}

.large {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-xl);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  box-shadow: var(--shadow-lg);
}

.large:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-xl);
}

.progress-bar {
  height: 8px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  margin-bottom: var(--spacing-lg);
  overflow: hidden;
  box-shadow: var(--shadow-inner);
  position: relative;
}

.progress-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-accent) 100%);
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
  position: relative;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.question-card {
  animation: slideInRight var(--transition-base);
}

.feedback-section {
  padding: var(--spacing-lg);
  border-radius: var(--radius-xl);
  border: 2px solid;
  animation: fadeIn var(--transition-base);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
}

.feedback-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, transparent, currentColor, transparent);
}

.feedback-section.good {
  background: linear-gradient(135deg, var(--color-success-light) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-color: var(--color-success);
  color: var(--color-success);
}

.feedback-section.bad {
  background: linear-gradient(135deg, var(--color-danger-light) 0%, rgba(239, 68, 68, 0.05) 100%);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-lg);
}

.feedback-section p {
  color: var(--color-text);
  line-height: var(--line-height-relaxed);
}

.correct-answer {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
}

.result-item {
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-lg) 0;
  transition: all var(--transition-base);
  animation: fadeIn var(--transition-base);
}

.result-item:hover {
  background: var(--color-surface-hover);
  padding-left: var(--spacing-md);
  border-radius: var(--radius-md);
}

.result-item:last-child {
  border-bottom: none;
}

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-semibold);
}

.text-success {
  color: var(--color-success);
  font-weight: var(--font-weight-bold);
}

.text-danger {
  color: var(--color-danger);
  font-weight: var(--font-weight-bold);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
  animation: fadeIn var(--transition-fast);
}

.modal-content {
  background: var(--color-surface);
  padding: var(--spacing-xl);
  border-radius: var(--radius-2xl);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-2xl);
  animation: slideInRight var(--transition-base);
  border: 1px solid var(--color-border);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: var(--spacing-lg);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.session-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}

.session-tree li {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xs);
}

.session-tree li:hover {
  background-color: var(--color-surface-hover);
  transform: translateX(4px);
}

.session-tree li.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: white;
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-md);
}

.status-icon {
  display: flex;
  align-items: center;
  margin-top: 2px;
  flex-shrink: 0;
}

.q-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.q-cat {
  font-size: var(--font-size-xs);
  opacity: 0.7;
  font-weight: var(--font-weight-medium);
}

.q-text {
  line-height: var(--line-height-normal);
}

.answer-section textarea {
  min-height: 150px;
  font-family: var(--font-family);
  line-height: var(--line-height-relaxed);
}

.actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  flex-wrap: wrap;
}

.timer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

@media (max-width: 768px) {
  .chip {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-size-xs);
  }

  .large {
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: var(--font-size-lg);
  }

  .modal-content {
    width: 95%;
    padding: var(--spacing-lg);
  }

  .question-header {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: flex-start;
  }
}
</style>