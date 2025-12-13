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
        <div class="toolbar-info">
          <span class="message-count">{{ messages.length }} сообщений</span>
        </div>
        <button type="button" @click="clearChat" class="clear-btn" title="Очистить чат">
          <Trash2 :size="18" />
          <span>Очистить</span>
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
  max-width: 1000px;
  margin: 0 auto;
  animation: fadeIn var(--transition-base);
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  background: linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface) 100%);
}

.message {
  display: flex;
  gap: var(--spacing-md);
  max-width: 85%;
  animation: slideInRight var(--transition-base);
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
  animation: slideInLeft var(--transition-base);
}

.message.assistant {
  align-self: flex-start;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border);
  color: white;
  flex-shrink: 0;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}

.message.user .avatar {
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-primary) 100%);
}

.avatar:hover {
  transform: scale(1.1) rotate(5deg);
  box-shadow: var(--shadow-lg);
}

.bubble {
  background-color: var(--color-surface);
  padding: var(--spacing-lg);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  overflow-wrap: break-word;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
  position: relative;
}

.bubble::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.message.assistant .bubble::before {
  left: -8px;
  top: 12px;
  border-width: 8px 8px 8px 0;
  border-color: transparent var(--color-surface) transparent transparent;
}

.message.user .bubble::before {
  right: -8px;
  top: 12px;
  border-width: 8px 0 8px 8px;
  border-color: transparent transparent transparent var(--color-primary);
}

.bubble:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.message.user .bubble {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: white !important;
  border: none;
}

.message.user .bubble * {
  color: white !important;
}

.message.user .markdown-content :deep(*) {
  color: white !important;
}

.bubble.loading {
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-area {
  padding: var(--spacing-lg);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%);
  border-top: 2px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  box-shadow: var(--shadow-lg);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
}

.toolbar-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.message-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface-hover);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
}

.clear-btn {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  cursor: pointer;
  color: var(--color-text);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.clear-btn:hover {
  background-color: var(--color-danger);
  color: white;
  border-color: var(--color-danger);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.input-form {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-end;
  background: var(--color-surface);
  padding: var(--spacing-md);
  border-radius: var(--radius-xl);
  border: 2px solid var(--color-border);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

.input-form:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.chat-input {
  flex: 1;
  resize: none;
  min-height: 44px;
  max-height: 200px;
  padding: var(--spacing-md);
  line-height: var(--line-height-relaxed);
  border: none;
  background: transparent;
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.chat-input:focus {
  outline: none;
  border: none;
  box-shadow: none;
}

.input-form button {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stop-btn {
  background-color: var(--color-danger);
  color: white;
  border: none;
}

.stop-btn:hover {
  background-color: var(--color-danger-hover);
  transform: scale(1.1);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-badge {
  font-size: var(--font-size-xs);
  opacity: 0.8;
  margin-top: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  display: inline-block;
}

/* Markdown Styles within bubble */
.markdown-content :deep(p) {
  margin: 0 0 var(--spacing-md) 0;
  line-height: var(--line-height-relaxed);
}

.markdown-content :deep(p:last-child) {
  margin: 0;
}

.markdown-content :deep(pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: var(--spacing-md) 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.markdown-content :deep(code) {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: var(--spacing-md) 0;
  padding-left: var(--spacing-xl);
}

.markdown-content :deep(li) {
  margin-bottom: var(--spacing-sm);
}

.message.user .markdown-content :deep(pre) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .chat-container {
    padding: var(--spacing-md);
    gap: var(--spacing-md);
  }

  .message {
    max-width: 90%;
  }

  .avatar {
    width: 36px;
    height: 36px;
  }

  .bubble {
    padding: var(--spacing-md);
  }

  .input-area {
    padding: var(--spacing-md);
  }

  .input-form {
    padding: var(--spacing-sm);
  }

  .chat-input {
    min-height: 40px;
    font-size: var(--font-size-sm);
  }
}
</style>