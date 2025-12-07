<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDataStore } from '../stores/data';
import { storeToRefs } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2 } from 'lucide-vue-next';
import CategoryTree from '../components/CategoryTree.vue';
import QuestionEditor from '../components/QuestionEditor.vue';
import type { Category, Question } from '../types';

const dataStore = useDataStore();
const { categoriesTree, questions } = storeToRefs(dataStore);

const selectedCategoryId = ref<string | null>(null);
const showQuestionEditor = ref(false);
const editingQuestion = ref<Question | null>(null);

onMounted(async () => {
  if (!dataStore.isLoaded) {
    await dataStore.loadData();
  }
});

const filteredQuestions = computed(() => {
  if (!selectedCategoryId.value) return [];
  return questions.value.filter(q => q.categoryId === selectedCategoryId.value);
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

async function onDrop(_event: DragEvent, targetNode: any) {
  const draggedId = draggedNode.value?.id;
  if (!draggedId || draggedId === targetNode.id) return;

  // Prevent circular dependency (cannot drop parent into child)
  // Simple check: if targetNode is a descendant of draggedNode
  // We need a way to check descendants. For now, let's just allow move and handle basic cases.
  // A better check would be traversing up from targetNode to see if draggedNode is an ancestor.
  
  // Update parentId
  const category = dataStore.categories.find(c => c.id === draggedId);
  if (category) {
    await dataStore.updateCategory({
      ...category,
      parentId: targetNode.id
    });
  }
  draggedNode.value = null;
}
</script>

<template>
  <div class="library-layout">
    <aside class="categories-sidebar">
      <div class="sidebar-header">
        <h2>Категории</h2>
        <button class="icon-btn" @click="addCategory(null)" title="Add Root Category">
          <Plus :size="20" />
        </button>
      </div>
      <div class="tree-container">
        <CategoryTree
          :nodes="categoriesTree"
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

    <main class="questions-main">
      <div v-if="selectedCategoryId">
        <div class="main-header">
          <h2>{{ selectedCategoryName }} <span class="count">({{ filteredQuestions.length }})</span></h2>
          <button v-if="!showQuestionEditor" class="primary" @click="openAddQuestion">
            <Plus :size="16" style="margin-right: 8px" />
            Добавить вопрос
          </button>
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
            <div class="q-content">
              <div class="q-text">{{ q.text }}</div>
              <div class="q-meta">
                <span class="badge">Diff: {{ q.difficulty }}</span>
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
  height: calc(100vh - 4rem); /* Adjust based on app padding */
  gap: var(--spacing-lg);
}

.categories-sidebar {
  width: 300px;
  border-right: 1px solid var(--color-border);
  padding-right: var(--spacing-md);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.tree-container {
  flex: 1;
  overflow-y: auto;
}

.questions-main {
  flex: 1;
  overflow-y: auto;
  padding-right: var(--spacing-md);
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-md);
}

.count {
  color: var(--color-text);
  opacity: 0.6;
  font-size: 0.8em;
}

.question-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.q-content {
  flex: 1;
}

.q-text {
  font-weight: 500;
  margin-bottom: var(--spacing-sm);
  white-space: pre-wrap;
}

.q-meta {
  display: flex;
  gap: var(--spacing-sm);
}

.badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-hover);
  border: 1px solid var(--color-border);
}

.badge.tag {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background-color: rgba(100, 108, 255, 0.1);
}

.q-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: var(--spacing-md);
}

.icon-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text);
  border-radius: var(--radius-sm);
}

.icon-btn:hover {
  background-color: var(--color-surface-hover);
}

.icon-btn.danger:hover {
  color: var(--color-danger);
}

.empty-state, .empty-state-main {
  text-align: center;
  opacity: 0.6;
  margin-top: var(--spacing-xl);
}

.empty-state-main {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>