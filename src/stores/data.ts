import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { dbService } from '../services/db';
import type { Category, Question } from '../types';

export const useDataStore = defineStore('data', () => {
  const categories = ref<Category[]>([]);
  const questions = ref<Question[]>([]);
  const isLoaded = ref(false);

  async function loadData() {
    const [cats, quests] = await Promise.all([
      dbService.getAllCategories(),
      dbService.getAllQuestions()
    ]);
    categories.value = cats;
    questions.value = quests;
    isLoaded.value = true;
  }

  async function addCategory(category: Category) {
    await dbService.saveCategory(category);
    categories.value.push(category);
  }

  async function updateCategory(category: Category) {
    await dbService.saveCategory(category);
    const index = categories.value.findIndex(c => c.id === category.id);
    if (index !== -1) categories.value[index] = category;
  }

  async function removeCategory(id: string) {
    await dbService.deleteCategory(id);
    categories.value = categories.value.filter(c => c.id !== id);
  }

  async function addQuestion(question: Question) {
    await dbService.saveQuestion(question);
    questions.value.push(question);
  }

  async function updateQuestion(question: Question) {
    await dbService.saveQuestion(question);
    const index = questions.value.findIndex(q => q.id === question.id);
    if (index !== -1) questions.value[index] = question;
  }

  async function removeQuestion(id: string) {
    await dbService.deleteQuestion(id);
    questions.value = questions.value.filter(q => q.id !== id);
  }

  const categoriesTree = computed(() => {
    const map = new Map<string, Category & { children: any[] }>();
    const roots: any[] = [];

    categories.value.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    categories.value.forEach(cat => {
      const node = map.get(cat.id);
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  });

  return {
    categories,
    questions,
    isLoaded,
    loadData,
    addCategory,
    updateCategory,
    removeCategory,
    addQuestion,
    updateQuestion,
    removeQuestion,
    categoriesTree
  };
});