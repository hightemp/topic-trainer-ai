<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { Send, Bot, User, Loader2 } from 'lucide-vue-next';
import { aiService } from '../services/ai';
import { useDataStore } from '../stores/data';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';

const dataStore = useDataStore();
const messages = ref<any[]>([]);
const input = ref('');
const isLoading = ref(false);
const chatContainer = ref<HTMLElement | null>(null);

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

  return { error: 'Unknown tool' };
}

async function sendMessage() {
  if (!input.value.trim() || isLoading.value) return;

  const userMsg = { role: 'user', content: input.value };
  messages.value.push(userMsg);
  input.value = '';
  isLoading.value = true;
  scrollToBottom();

  try {
    // Filter out UI-only messages or process history correctly
    const history = messages.value.map(m => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
      name: m.name
    }));

    const response = await aiService.chat(history, handleToolCall);
    
    // If response has content, add it
    if (response.content) {
      messages.value.push({ role: 'assistant', content: response.content });
    } else if (response.tool_calls) {
       // If it was just tool calls (which we handled inside chat() recursion), 
       // the final response might be a summary or empty if the model decided so.
       // But our simple recursion in ai.chat returns the FINAL message.
       // If the final message is from tool, we might need to wait for assistant to summarize.
       // Actually, my implementation of ai.chat recurses until assistant gives a text response or stops calling tools.
       // So response should be the final assistant message.
       messages.value.push({ role: 'assistant', content: response.content || 'Готово.' });
    }

  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Ошибка: ${e.message}` });
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
}

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
      <form @submit.prevent="sendMessage" class="input-form">
        <input 
          v-model="input" 
          type="text" 
          placeholder="Сгенерируй 5 вопросов по Vue 3 Composition API..." 
          :disabled="isLoading"
        />
        <button type="submit" :disabled="isLoading || !input.trim()">
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
}

.input-form {
  display: flex;
  gap: var(--spacing-md);
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