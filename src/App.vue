<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { Book, Brain, MessageSquare, BarChart2, Settings } from 'lucide-vue-next';
import { useSettingsStore } from './stores/settings';

const settingsStore = useSettingsStore();

onMounted(async () => {
  await settingsStore.loadSettings();
});
</script>

<template>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="logo">
        Topic Trainer
      </div>
      <div class="nav-links">
        <RouterLink to="/library" class="nav-item" active-class="active">
          <Book :size="20" />
          <span>Библиотека</span>
        </RouterLink>
        <RouterLink to="/trainer" class="nav-item" active-class="active">
          <Brain :size="20" />
          <span>Тренировка</span>
        </RouterLink>
        <RouterLink to="/chat" class="nav-item" active-class="active">
          <MessageSquare :size="20" />
          <span>AI Чат</span>
        </RouterLink>
        <RouterLink to="/stats" class="nav-item" active-class="active">
          <BarChart2 :size="20" />
          <span>Статистика</span>
        </RouterLink>
        <RouterLink to="/settings" class="nav-item" active-class="active">
          <Settings :size="20" />
          <span>Настройки</span>
        </RouterLink>
      </div>
    </nav>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 250px;
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: var(--spacing-xl);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  color: var(--color-text);
  transition: background-color 0.2s, color 0.2s;
}

.nav-item:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-primary);
}

.nav-item.active {
  background-color: var(--color-primary);
  color: white;
}

.content {
  flex: 1;
  padding: var(--spacing-xl);
  overflow-y: auto;
}
</style>
