<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { Send, Bot, User, Loader2, Square, Trash2 } from 'lucide-vue-next';
import { aiService } from '../services/ai';
import { useDataStore } from '../stores/data';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';

const dataStore = useDataStore();
const messages = ref<any[]>([]);
const input = ref('');
const isLoading = ref(false);
const chatContainer = ref<HTMLElement | null>(null);
const abortController = ref<AbortController | null>(null);

onMounted(() => {
  messages.value.push({
    role: 'assistant',
    content: 'Привет! Я помогу создать вопросы и категории. Просто скажи, по какой теме нужно сгенерировать вопросы.'
  });
});

async function scrollToBottom() {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
}

async function handleToolCall(name: string, args: any) {
  console.log('Tool Call:', name, args);
  
  if (name === 'create_category') {
    const id = uuidv4();
    await dataStore.addCategory({
      id,
      name: args.name,
      parentId: args.parentId || null
    });
    return { success: true, id, message: `Category "${args.name}" created.` };
  }

  if (name === 'create_question') {
    const id = uuidv4();
    await dataStore.addQuestion({
      id,
      text: args.text,
      correctAnswer: args.correctAnswer,
      difficulty: args.difficulty,
      tags: args.tags || [],
      categoryId: args.categoryId,
      nextReviewDate: Date.now(),
      interval: 0,
      repetitionFactor: 2.5
    });
    return { success: true, id, message: 'Question created.' };
  }

  if (name === 'get_categories') {
    return dataStore.categories.map(c => ({ id: c.id, name: c.name, parentId: c.parentId }));
  }

  if (name === 'update_category') {
    const cat = dataStore.categories.find(c => c.id === args.id);
    if (!cat) return { error: 'Category not found' };
    await dataStore.updateCategory({
      ...cat,
      name: args.name || cat.name,
      parentId: args.parentId !== undefined ? args.parentId : cat.parentId
    });
    return { success: true, message: 'Category updated.' };
  }

  if (name === 'delete_category') {
    await dataStore.removeCategory(args.id);
    return { success: true, message: 'Category deleted.' };
  }

  if (name === 'get_questions') {
    let qs = dataStore.questions;
    if (args.categoryId) {
      qs = qs.filter(q => q.categoryId === args.categoryId);
    }
    const limit = args.limit || 20;
    return qs.slice(0, limit).map(q => ({
      id: q.id,
      text: q.text,
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty,
      tags: q.tags,
      categoryId: q.categoryId
    }));
  }

  if (name === 'update_question') {
    const q = dataStore.questions.find(q => q.id === args.id);
    if (!q) return { error: 'Question not found' };
    await dataStore.updateQuestion({
      ...q,
      text: args.text || q.text,
      correctAnswer: args.correctAnswer || q.correctAnswer,
      difficulty: args.difficulty || q.difficulty,
      tags: args.tags || q.tags,
      categoryId: args.categoryId || q.categoryId
    });
    return { success: true, message: 'Question updated.' };
  }

  if (name === 'delete_question') {
    await dataStore.removeQuestion(args.id);
    return { success: true, message: 'Question deleted.' };
  }

  return { error: 'Unknown tool' };
}

function stopGeneration() {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    isLoading.value = false;
    messages.value.push({ role: 'assistant', content: 'Генерация остановлена.' });
    scrollToBottom();
  }
}

function clearChat() {
  if (confirm('Очистить историю чата?')) {
    messages.value = [{
      role: 'assistant',
      content: 'Привет! Я помогу создать вопросы и категории. Просто скажи, по какой теме нужно сгенерировать вопросы.'
    }];
  }
}

async function sendMessage() {
  if (!input.value.trim() || isLoading.value) return;

  const userMsg = { role: 'user', content: input.value };
  messages.value.push(userMsg);
  input.value = '';
  isLoading.value = true;
  scrollToBottom();

  abortController.value = new AbortController();

  try {
    // Filter out UI-only messages or process history correctly
    const history = messages.value.map(m => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
      name: m.name
    }));

    const response = await aiService.chat(history, handleToolCall, abortController.value.signal);
    
    // If response has content, add it
    if (response.content) {
      messages.value.push({ role: 'assistant', content: response.content });
    } else if (response.tool_calls) {
       messages.value.push({ role: 'assistant', content: response.content || 'Готово.' });
    }

  } catch (e: any) {
    if (e.name === 'AbortError') {
      // Handled in stopGeneration
    } else {
      messages.value.push({ role: 'assistant', content: `Ошибка: ${e.message}` });
    }
  } finally {
    if (abortController.value) {
      isLoading.value = false;
      abortController.value = null;
    }
    scrollToBottom();
  }
}

onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort();
  }
});

function renderMarkdown(text: string) {
  return marked(text || '');
}
</script>

<template>
  <div class="chat-layout">
    <div class="chat-container" ref="chatContainer">
      <div v-for="(msg, index) in messages" :key="index" class="message" :class="msg.role">
        <div class="avatar">
          <Bot v-if="msg.role === 'assistant'" :size="24" />
          <User v-else :size="24" />
        </div>
        <div class="bubble">
          <div v-if="msg.content" v-html="renderMarkdown(msg.content)" class="markdown-content"></div>
          <div v-if="msg.tool_calls" class="tool-calls">
            <div v-for="tool in msg.tool_calls" :key="tool.id" class="tool-badge">
              🛠️ {{ tool.function.name }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="isLoading" class="message assistant">
        <div class="avatar"><Bot :size="24" /></div>
        <div class="bubble loading">
          <Loader2 :size="20" class="spin" />
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="toolbar">
        <button type="button" @click="clearChat" class="icon-btn" title="Очистить чат">
          <Trash2 :size="18" />
        </button>
      </div>
      <form @submit.prevent="sendMessage" class="input-form">
        <textarea
          v-model="input"
          placeholder="Сгенерируй 5 вопросов по Vue 3 Composition API..."
          :disabled="isLoading"
          @keydown.enter.exact.prevent="sendMessage"
          rows="1"
          class="chat-input"
        ></textarea>
        <button v-if="isLoading" type="button" @click="stopGeneration" class="stop-btn" title="Остановить">
          <Square :size="20" fill="currentColor" />
        </button>
        <button v-else type="submit" :disabled="!input.trim()">
          <Send :size="20" />
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
  max-width: 900px;
  margin: 0 auto;
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.message {
  display: flex;
  gap: var(--spacing-md);
  max-width: 80%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
}

.bubble {
  background-color: var(--color-surface);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow-wrap: break-word;
}

.message.user .bubble {
  background-color: var(--color-primary);
  color: white;
  border: none;
}

.input-area {
  padding: var(--spacing-md);
  background-color: var(--color-bg);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.6;
  padding: 4px;
  border-radius: 4px;
}

.icon-btn:hover {
  opacity: 1;
  background-color: var(--color-surface-hover);
}

.input-form {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  resize: none;
  min-height: 42px;
  max-height: 150px;
  padding: 10px;
  line-height: 1.5;
}

.stop-btn {
  color: var(--color-danger);
}

.stop-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: var(--color-danger);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-badge {
  font-size: 0.8em;
  opacity: 0.7;
  margin-top: 4px;
  font-style: italic;
}

/* Markdown Styles within bubble */
.markdown-content :deep(p) { margin: 0 0 0.5em 0; }
.markdown-content :deep(p:last-child) { margin: 0; }
.markdown-content :deep(pre) { 
  background: rgba(0,0,0,0.1); 
  padding: 0.5em; 
  border-radius: 4px; 
  overflow-x: auto;
}
</style>