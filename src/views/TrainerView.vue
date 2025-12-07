<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDataStore } from '../stores/data';
import { aiService } from '../services/ai';
import { dbService } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
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

function renderMarkdown(text: string) {
  return marked(text || '');
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
.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.chip {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s;
}

.chip.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.large {
  padding: 12px 24px;
  font-size: 1.2em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.3s;
}

.question-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  opacity: 0.7;
}

.feedback-section {
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid;
}

.feedback-section.good {
  background-color: rgba(34, 197, 94, 0.1);
  border-color: var(--color-success);
}

.feedback-section.bad {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: var(--color-danger);
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  margin-bottom: 8px;
}

.result-item {
  border-bottom: 1px solid var(--color-border);
  padding: 12px 0;
}

.result-item:last-child {
  border-bottom: none;
}

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--color-surface);
  padding: 20px;
  border-radius: var(--radius-lg);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.session-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}

.session-tree li {
  padding: 8px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.9em;
}

.session-tree li.active {
  background-color: var(--color-surface-hover);
  font-weight: bold;
}

.status-icon {
  display: flex;
  align-items: center;
  margin-top: 3px;
}

.q-info {
  display: flex;
  flex-direction: column;
}

.q-cat {
  font-size: 0.8em;
  opacity: 0.6;
}
</style>