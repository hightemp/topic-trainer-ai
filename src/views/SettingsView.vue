<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useDataStore } from '../stores/data';
import { storeToRefs } from 'pinia';

const settingsStore = useSettingsStore();
const dataStore = useDataStore();
const { settings } = storeToRefs(settingsStore);

const form = ref({
  openRouterKey: '',
  openRouterModel: '',
  userName: ''
});

const isSaving = ref(false);
const message = ref('');

onMounted(async () => {
  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings();
  }
  form.value = { ...settings.value };
});

async function save() {
  isSaving.value = true;
  message.value = '';
  try {
    await settingsStore.updateSettings(form.value);
    message.value = 'Настройки сохранены!';
    setTimeout(() => message.value = '', 3000);
  } catch (e) {
    message.value = 'Ошибка сохранения';
    console.error(e);
  } finally {
    isSaving.value = false;
  }
}

async function exportData() {
  if (!dataStore.isLoaded) await dataStore.loadData();
  
  const data = {
    settings: settings.value,
    categories: dataStore.categories,
    questions: dataStore.questions
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `topic-trainer-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (!confirm('Это действие перезапишет текущие настройки и добавит данные. Продолжить?')) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      
      if (data.settings) {
        await settingsStore.updateSettings(data.settings);
        form.value = { ...data.settings };
      }

      if (Array.isArray(data.categories)) {
        for (const cat of data.categories) {
          // Avoid duplicates if ID exists? Or overwrite?
          // Simple approach: overwrite or add if not exists
          const exists = dataStore.categories.find(c => c.id === cat.id);
          if (exists) {
             await dataStore.updateCategory(cat);
          } else {
             await dataStore.addCategory(cat);
          }
        }
      }

      if (Array.isArray(data.questions)) {
        for (const q of data.questions) {
          const exists = dataStore.questions.find(eq => eq.id === q.id);
          if (exists) {
            await dataStore.updateQuestion(q);
          } else {
            await dataStore.addQuestion(q);
          }
        }
      }

      alert('Данные успешно импортированы!');
    } catch (err) {
      console.error(err);
      alert('Ошибка импорта файла');
    }
  };
  reader.readAsText(file);
}
</script>

<template>
  <div class="container">
    <h1>Настройки</h1>
    
    <div class="card mt-4">
      <form @submit.prevent="save" class="flex flex-col gap-4">
        <div>
          <label class="block mb-2 font-bold">Имя пользователя</label>
          <input v-model="form.userName" type="text" placeholder="Ваше имя" />
        </div>

        <div>
          <label class="block mb-2 font-bold">OpenRouter API Key</label>
          <input v-model="form.openRouterKey" type="password" placeholder="sk-or-..." />
          <p class="text-sm mt-2 opacity-70">Ключ хранится только в вашем браузере.</p>
        </div>

        <div>
          <label class="block mb-2 font-bold">AI Model</label>
          <input v-model="form.openRouterModel" type="text" placeholder="google/gemini-2.0-flash-exp" />
          <p class="text-sm mt-2 opacity-70">ID модели из OpenRouter (например: google/gemini-2.0-flash-exp, anthropic/claude-3-haiku)</p>
        </div>

        <div class="flex items-center gap-4 mt-4">
          <button type="submit" class="primary" :disabled="isSaving">
            {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
          </button>
          <span v-if="message" :class="{'text-success': message.includes('сохранены'), 'text-danger': message.includes('Ошибка')}">
            {{ message }}
          </span>
        </div>
      </form>
    </div>

    <div class="card mt-4">
      <h3>Управление данными</h3>
      <div class="flex gap-4 mt-4">
        <button @click="exportData" class="secondary">Экспорт данных</button>
        <label class="secondary button-like">
          Импорт данных
          <input type="file" @change="importData" accept=".json" style="display: none;" />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.block { display: block; }
.opacity-70 { opacity: 0.7; }
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }

.secondary {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 0.6em 1.2em;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
}

.secondary:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.button-like {
  display: inline-block;
  text-align: center;
}
</style>