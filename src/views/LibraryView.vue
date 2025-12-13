<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDataStore } from '../stores/data';
import { storeToRefs } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2 } from 'lucide-vue-next';
import CategoryTree from '../components/CategoryTree.vue';
import QuestionEditor from '../components/QuestionEditor.vue';
import type { Category, Question } from '../types';
import { renderMarkdownInline } from '../utils/markdown';

const dataStore = useDataStore();
const { categoriesTree, questions } = storeToRefs(dataStore);

const selectedCategoryId = ref<string | null>(null);
const showQuestionEditor = ref(false);
const editingQuestion = ref<Question | null>(null);
const sidebarWidth = ref(300);
const isResizing = ref(false);
const categorySearch = ref('');
const questionSearch = ref('');

onMounted(async () => {
  if (!dataStore.isLoaded) {
    await dataStore.loadData();
  }
  
  // Load saved sidebar width
  const savedWidth = localStorage.getItem('library-sidebar-width');
  if (savedWidth) {
    sidebarWidth.value = parseInt(savedWidth, 10);
  }
});

const filteredQuestions = computed(() => {
  if (!selectedCategoryId.value) return [];
  let qs = questions.value.filter(q => q.categoryId === selectedCategoryId.value);
  
  if (questionSearch.value.trim()) {
    const term = questionSearch.value.toLowerCase();
    qs = qs.filter(q =>
      q.text.toLowerCase().includes(term) ||
      q.tags.some(t => t.toLowerCase().includes(term))
    );
  }
  return qs;
});

const filteredCategoriesTree = computed(() => {
  if (!categorySearch.value.trim()) return categoriesTree.value;
  
  const term = categorySearch.value.toLowerCase();
  
  // Recursive filter function
  const filterNodes = (nodes: any[]): any[] => {
    return nodes.reduce((acc, node) => {
      const matches = node.name.toLowerCase().includes(term);
      const filteredChildren = filterNodes(node.children || []);
      
      if (matches || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren
        });
      }
      return acc;
    }, []);
  };

  return filterNodes(categoriesTree.value);
});

const selectedCategoryName = computed(() => {
  if (!selectedCategoryId.value) return '';
  const cat = dataStore.categories.find(c => c.id === selectedCategoryId.value);
  return cat ? cat.name : '';
});

// Category Actions
function selectCategory(id: string) {
  selectedCategoryId.value = id;
  showQuestionEditor.value = false;
}

async function addCategory(parentId: string | null) {
  const name = prompt('Введите название категории:');
  if (!name) return;
  
  await dataStore.addCategory({
    id: uuidv4(),
    name,
    parentId
  });
}

async function editCategory(category: Category) {
  const name = prompt('Новое название:', category.name);
  if (!name || name === category.name) return;
  
  await dataStore.updateCategory({ ...category, name });
}

async function deleteCategory(id: string) {
  if (!confirm('Удалить категорию и все вложенные вопросы?')) return;
  // TODO: Recursive delete logic or prevent if has children
  await dataStore.removeCategory(id);
  if (selectedCategoryId.value === id) selectedCategoryId.value = null;
}

// Question Actions
function openAddQuestion() {
  editingQuestion.value = null;
  showQuestionEditor.value = true;
}

function editQuestion(question: Question) {
  editingQuestion.value = question;
  showQuestionEditor.value = true;
}

async function saveQuestion(question: Question) {
  if (editingQuestion.value) {
    await dataStore.updateQuestion(question);
  } else {
    await dataStore.addQuestion(question);
  }
  showQuestionEditor.value = false;
  editingQuestion.value = null;
}

async function deleteQuestion(id: string) {
  if (!confirm('Удалить вопрос?')) return;
  await dataStore.removeQuestion(id);
}

// Drag & Drop Logic
const draggedNode = ref<any>(null);

function onDragStart(event: DragEvent, node: any) {
  draggedNode.value = node;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', node.id);
  }
}


// Question Drag & Drop
const draggedQuestion = ref<Question | null>(null);

function onQuestionDragStart(event: DragEvent, question: Question) {
  draggedQuestion.value = question;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', question.id);
    event.dataTransfer.setData('type', 'question');
  }
}

// Update onDrop to handle questions
async function onDrop(event: DragEvent, targetNode: any) {
  const type = event.dataTransfer?.getData('type');
  
  if (type === 'question' && draggedQuestion.value) {
    // Move question to category
    if (draggedQuestion.value.categoryId !== targetNode.id) {
      await dataStore.updateQuestion({
        ...draggedQuestion.value,
        categoryId: targetNode.id
      });
      // If current view is filtered by old category, question will disappear (correct behavior)
    }
    draggedQuestion.value = null;
    return;
  }

  // Existing category logic
  const draggedId = draggedNode.value?.id;
  if (!draggedId || draggedId === targetNode.id) return;

  const category = dataStore.categories.find(c => c.id === draggedId);
  if (category) {
    await dataStore.updateCategory({
      ...category,
      parentId: targetNode.id
    });
  }
  draggedNode.value = null;
}

function getDifficultyLabel(diff: number) {
  const labels = ['Легкий', 'Простой', 'Средний', 'Сложный', 'Эксперт'];
  return labels[diff - 1] || diff;
}

function getDifficultyClass(diff: number) {
  if (diff <= 2) return 'diff-easy';
  if (diff === 3) return 'diff-medium';
  return 'diff-hard';
}

// Resizer Logic
function startResize(e: MouseEvent) {
  isResizing.value = true;
  e.preventDefault();
}

function stopResize() {
  if (isResizing.value) {
    isResizing.value = false;
    // Save sidebar width to localStorage
    localStorage.setItem('library-sidebar-width', sidebarWidth.value.toString());
  }
}

function onResizerMove(e: MouseEvent) {
  if (!isResizing.value) return;
  
  // Calculate width relative to the viewport
  // Main sidebar is 280px (from App.vue), content starts after that
  const mainSidebarWidth = 280;
  const w = e.clientX - mainSidebarWidth;
  
  if (w >= 200 && w <= 600) {
    sidebarWidth.value = w;
  }
}

// Drop to root functionality
async function onDropToRoot(event: DragEvent) {
  event.preventDefault();
  const type = event.dataTransfer?.getData('type');
  
  if (type === 'question') {
    // Questions can't be in root
    return;
  }
  
  // Move category to root
  const draggedId = draggedNode.value?.id;
  if (!draggedId) return;
  
  const category = dataStore.categories.find(c => c.id === draggedId);
  if (category) {
    await dataStore.updateCategory({
      ...category,
      parentId: null
    });
  }
  draggedNode.value = null;
}

function onDragOverRoot(event: DragEvent) {
  event.preventDefault();
  const type = event.dataTransfer?.getData('type');
  if (type !== 'question') {
    event.dataTransfer!.dropEffect = 'move';
  }
}
</script>

<template>
  <div class="library-layout" @mousemove="onResizerMove" @mouseup="stopResize" @mouseleave="stopResize">
    <aside class="categories-sidebar" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-header">
        <h2>Категории</h2>
        <button class="icon-btn" @click="addCategory(null)" title="Добавить корневую категорию">
          <Plus :size="20" />
        </button>
      </div>
      <div class="search-box mb-2">
        <input v-model="categorySearch" type="text" placeholder="Поиск категорий..." class="search-input" />
      </div>
      <div
        class="drop-to-root-zone"
        @drop="onDropToRoot"
        @dragover="onDragOverRoot"
      >
        <span class="drop-hint">📁 Перетащите сюда для перемещения в корень</span>
      </div>
      <div class="tree-container">
        <CategoryTree
          :nodes="filteredCategoriesTree"
          :selectedId="selectedCategoryId"
          @select="selectCategory"
          @add="addCategory"
          @edit="editCategory"
          @delete="deleteCategory"
          @dragstart="onDragStart"
          @drop="onDrop"
        />
      </div>
    </aside>
    
    <div class="resizer" @mousedown="startResize"></div>

    <main class="questions-main">
      <div v-if="selectedCategoryId">
        <div class="main-header">
          <h2>{{ selectedCategoryName }} <span class="count">({{ filteredQuestions.length }})</span></h2>
          <div class="header-actions">
            <input v-model="questionSearch" type="text" placeholder="Поиск вопросов..." class="search-input question-search" />
            <button v-if="!showQuestionEditor" class="primary" @click="openAddQuestion">
              <Plus :size="16" style="margin-right: 8px" />
              Добавить вопрос
            </button>
          </div>
        </div>

        <div v-if="showQuestionEditor" class="mt-4">
          <QuestionEditor 
            :question="editingQuestion" 
            :categoryId="selectedCategoryId"
            @save="saveQuestion"
            @cancel="showQuestionEditor = false"
          />
        </div>

        <div v-else class="questions-list mt-4">
          <div v-for="q in filteredQuestions" :key="q.id" class="question-card">
            <div
              class="q-content"
              draggable="true"
              @dragstart="onQuestionDragStart($event, q)"
            >
              <div class="q-text markdown-content" v-html="renderMarkdownInline(q.text)"></div>
              <div class="q-meta">
                <span class="badge" :class="getDifficultyClass(q.difficulty)">
                  {{ getDifficultyLabel(q.difficulty) }}
                </span>
                <span v-for="tag in q.tags" :key="tag" class="badge tag">{{ tag }}</span>
              </div>
            </div>
            <div class="q-actions">
              <button class="icon-btn" @click="editQuestion(q)">
                <Edit2 :size="16" />
              </button>
              <button class="icon-btn danger" @click="deleteQuestion(q.id)">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
          <p v-if="filteredQuestions.length === 0" class="empty-state">
            В этой категории пока нет вопросов.
          </p>
        </div>
      </div>
      <div v-else class="empty-state-main">
        <p>Выберите категорию слева, чтобы управлять вопросами.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.library-layout {
  display: flex;
  height: calc(100vh - 4rem);
  gap: 0;
  animation: fadeIn var(--transition-base);
}

.categories-sidebar {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%);
  border-right: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}

.resizer {
  width: 6px;
  cursor: col-resize;
  background-color: var(--color-border);
  transition: all var(--transition-base);
  position: relative;
}

.resizer::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 40px;
  background-color: var(--color-border-dark);
  border-radius: var(--radius-full);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.resizer:hover,
.resizer:active {
  background: linear-gradient(90deg, transparent 0%, var(--color-primary) 50%, transparent 100%);
}

.resizer:hover::before {
  opacity: 1;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--color-border);
}

.sidebar-header h2 {
  font-size: var(--font-size-xl);
  margin: 0;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.drop-to-root-zone {
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-hover);
  text-align: center;
  transition: all var(--transition-base);
  cursor: pointer;
}

.drop-to-root-zone:hover,
.drop-to-root-zone:dragover {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  transform: scale(1.02);
}

.drop-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.drop-to-root-zone:hover .drop-hint {
  color: var(--color-primary);
}

.tree-container {
  flex: 1;
  overflow-y: auto;
  padding-right: var(--spacing-sm);
}

.questions-main {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  background-color: var(--color-bg);
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--color-border);
  animation: slideInRight var(--transition-base);
}

.main-header h2 {
  margin: 0;
  font-size: var(--font-size-2xl);
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.search-box {
  margin-bottom: var(--spacing-md);
}

.search-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.question-search {
  width: 250px;
}

.count {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
  margin-left: var(--spacing-sm);
}

.question-card {
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
  animation: fadeIn var(--transition-base);
}

.question-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.q-content {
  flex: 1;
  cursor: move;
}

.q-text {
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-md);
  white-space: pre-wrap;
  color: var(--color-text);
  line-height: var(--line-height-relaxed);
}

.q-meta {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.badge {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
  background-color: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  transition: all var(--transition-fast);
}

.badge.tag {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
}

.badge.tag:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
  transform: scale(1.05);
}

.diff-easy {
  color: var(--color-success);
  border-color: var(--color-success);
  background: linear-gradient(135deg, var(--color-success-light) 0%, rgba(16, 185, 129, 0.15) 100%);
}

.diff-medium {
  color: var(--color-warning);
  border-color: var(--color-warning);
  background: linear-gradient(135deg, var(--color-warning-light) 0%, rgba(245, 158, 11, 0.15) 100%);
}

.diff-hard {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: linear-gradient(135deg, var(--color-danger-light) 0%, rgba(239, 68, 68, 0.15) 100%);
}

.q-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: var(--spacing-md);
}

.icon-btn {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  padding: var(--spacing-sm);
  cursor: pointer;
  color: var(--color-text);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
}

.icon-btn.danger:hover {
  background-color: var(--color-danger);
  border-color: var(--color-danger);
  color: white;
}

.empty-state,
.empty-state-main {
  text-align: center;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-2xl);
  padding: var(--spacing-2xl);
  animation: fadeIn var(--transition-slow);
}

.empty-state-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--font-size-lg);
}

.questions-list {
  animation: fadeIn var(--transition-base);
}

@media (max-width: 768px) {
  .library-layout {
    flex-direction: column;
    height: auto;
  }

  .categories-sidebar {
    width: 100% !important;
    max-height: 300px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .resizer {
    display: none;
  }

  .questions-main {
    padding: var(--spacing-md);
  }

  .main-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .question-search {
    width: 100%;
  }

  .question-card {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .q-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }
}
</style>