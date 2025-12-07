<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { storeToRefs } from 'pinia';

const settingsStore = useSettingsStore();
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
  </div>
</template>

<style scoped>
.block { display: block; }
.opacity-70 { opacity: 0.7; }
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }
</style>