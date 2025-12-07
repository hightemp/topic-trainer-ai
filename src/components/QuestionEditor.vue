<script setup lang="ts">
import { ref, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { Question } from '../types';

const props = defineProps<{
  question?: Question | null;
  categoryId: string;
}>();

const emit = defineEmits<{
  (e: 'save', question: Question): void;
  (e: 'cancel'): void;
}>();

const form = ref<Partial<Question>>({
  text: '',
  correctAnswer: '',
  difficulty: 1,
  tags: [],
});

const tagsInput = ref('');

watch(() => props.question, (newQ) => {
  if (newQ) {
    form.value = { ...newQ };
    tagsInput.value = newQ.tags.join(', ');
  } else {
    form.value = {
      text: '',
      correctAnswer: '',
      difficulty: 1,
      tags: [],
    };
    tagsInput.value = '';
  }
}, { immediate: true });

function save() {
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
  
  const questionToSave: Question = {
    id: form.value.id || uuidv4(),
    text: form.value.text || '',
    correctAnswer: form.value.correctAnswer || '',
    difficulty: form.value.difficulty || 1,
    tags,
    categoryId: props.categoryId,
    nextReviewDate: form.value.nextReviewDate || Date.now(),
    interval: form.value.interval || 0,
    repetitionFactor: form.value.repetitionFactor || 2.5,
  };

  emit('save', questionToSave);
}
</script>

<template>
  <div class="editor-card">
    <h3>{{ question ? 'Редактировать вопрос' : 'Новый вопрос' }}</h3>
    <form @submit.prevent="save" class="flex flex-col gap-4">
      <div>
        <label class="block mb-2 font-bold">Вопрос (Markdown)</label>
        <textarea v-model="form.text" rows="4" required></textarea>
      </div>

      <div>
        <label class="block mb-2 font-bold">Правильный ответ (Markdown)</label>
        <textarea v-model="form.correctAnswer" rows="4" required></textarea>
      </div>

      <div class="flex gap-4">
        <div class="flex-1">
          <label class="block mb-2 font-bold">Сложность (1-5)</label>
          <input v-model.number="form.difficulty" type="number" min="1" max="5" required />
        </div>
        <div class="flex-1">
          <label class="block mb-2 font-bold">Теги (через запятую)</label>
          <input v-model="tagsInput" type="text" placeholder="js, vue, basics" />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button type="button" @click="emit('cancel')">Отмена</button>
        <button type="submit" class="primary">Сохранить</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.editor-card {
  background-color: var(--color-surface);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}
</style>