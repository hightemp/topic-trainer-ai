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
.container {
  animation: fadeIn var(--transition-base);
  max-width: 800px;
}

.container h1 {
  margin-bottom: var(--spacing-xl);
}

.card {
  animation: slideInRight var(--transition-base);
  margin-bottom: var(--spacing-xl);
}

.card h3 {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--color-border);
  font-size: var(--font-size-xl);
}

form > div {
  margin-bottom: var(--spacing-lg);
}

label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

input[type="text"],
input[type="password"] {
  transition: all var(--transition-base);
}

input[type="text"]:focus,
input[type="password"]:focus {
  transform: translateY(-2px);
}

.block {
  display: block;
}

.opacity-70 {
  opacity: 0.7;
}

.text-success {
  color: var(--color-success);
  font-weight: var(--font-weight-semibold);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-success-light);
  border-radius: var(--radius-md);
  display: inline-block;
  animation: fadeIn var(--transition-base);
}

.text-danger {
  color: var(--color-danger);
  font-weight: var(--font-weight-semibold);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-danger-light);
  border-radius: var(--radius-md);
  display: inline-block;
  animation: fadeIn var(--transition-base);
}

.secondary {
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%);
  border: 2px solid var(--color-border);
  color: var(--color-text);
  padding: var(--spacing-md) var(--spacing-xl);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.secondary:hover {
  background: linear-gradient(135deg, var(--color-surface-hover) 0%, var(--color-surface) 100%);
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.button-like {
  display: inline-block;
  text-align: center;
}

.flex.items-center.gap-4 {
  flex-wrap: wrap;
}

p.text-sm {
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface-hover);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-info);
}

@media (max-width: 768px) {
  .container {
    padding: var(--spacing-md);
  }

  .flex.gap-4 {
    flex-direction: column;
    align-items: stretch;
  }

  .secondary {
    width: 100%;
    justify-content: center;
  }
}
</style>