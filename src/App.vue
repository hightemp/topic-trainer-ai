<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { Book, Brain, MessageSquare, BarChart2, Settings, Moon, Sun, Menu, X } from 'lucide-vue-next';
import { useSettingsStore } from './stores/settings';

const settingsStore = useSettingsStore();

const isDark = ref(false);
const isMobileMenuOpen = ref(false);

onMounted(async () => {
  await settingsStore.loadSettings();
  
  // Check for saved theme preference or default to system preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDark.value = savedTheme === 'dark';
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  applyTheme();
});

function toggleTheme() {
  isDark.value = !isDark.value;
  applyTheme();
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
}

function applyTheme() {
  if (isDark.value) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false;
}
</script>

<template>
  <div class="app-layout">
    <!-- Mobile Header -->
    <header class="mobile-header">
      <div class="mobile-header-content">
        <div class="logo-mobile">
          <Brain :size="24" class="logo-icon" />
          <span>Topic Trainer</span>
        </div>
        <div class="mobile-actions">
          <button @click="toggleTheme" class="icon-btn theme-toggle" :title="isDark ? 'Светлая тема' : 'Темная тема'">
            <Sun v-if="isDark" :size="20" />
            <Moon v-else :size="20" />
          </button>
          <button @click="toggleMobileMenu" class="icon-btn menu-toggle">
            <X v-if="isMobileMenuOpen" :size="24" />
            <Menu v-else :size="24" />
          </button>
        </div>
      </div>
    </header>

    <!-- Sidebar Navigation -->
    <nav class="sidebar" :class="{ 'mobile-open': isMobileMenuOpen }">
      <div class="sidebar-content">
        <div class="logo">
          <Brain :size="28" class="logo-icon" />
          <span class="logo-text">Topic Trainer</span>
        </div>
        
        <div class="nav-links">
          <RouterLink to="/library" class="nav-item" active-class="active" @click="closeMobileMenu">
            <Book :size="20" />
            <span>Библиотека</span>
          </RouterLink>
          <RouterLink to="/trainer" class="nav-item" active-class="active" @click="closeMobileMenu">
            <Brain :size="20" />
            <span>Тренировка</span>
          </RouterLink>
          <RouterLink to="/chat" class="nav-item" active-class="active" @click="closeMobileMenu">
            <MessageSquare :size="20" />
            <span>AI Чат</span>
          </RouterLink>
          <RouterLink to="/stats" class="nav-item" active-class="active" @click="closeMobileMenu">
            <BarChart2 :size="20" />
            <span>Статистика</span>
          </RouterLink>
          <RouterLink to="/settings" class="nav-item" active-class="active" @click="closeMobileMenu">
            <Settings :size="20" />
            <span>Настройки</span>
          </RouterLink>
        </div>

        <div class="sidebar-footer">
          <button @click="toggleTheme" class="theme-toggle-btn">
            <Sun v-if="isDark" :size="20" />
            <Moon v-else :size="20" />
            <span>{{ isDark ? 'Светлая тема' : 'Темная тема' }}</span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile Menu Overlay -->
    <div v-if="isMobileMenuOpen" class="mobile-overlay" @click="closeMobileMenu"></div>

    <!-- Main Content -->
    <main class="content">
      <RouterView v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--color-bg);
}

/* Mobile Header */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-sm);
}

.mobile-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 var(--spacing-md);
}

.logo-mobile {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.mobile-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.icon-btn {
  background: none;
  border: none;
  padding: var(--spacing-sm);
  cursor: pointer;
  color: var(--color-text);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-primary);
}

/* Sidebar */
.sidebar {
  width: 280px;
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-elevated) 100%);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: var(--z-fixed);
  transition: transform var(--transition-base);
  box-shadow: var(--shadow-lg);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--spacing-xl) var(--spacing-md);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-2xl);
  padding: var(--spacing-md);
  animation: slideInLeft var(--transition-slow);
}

.logo-icon {
  color: var(--color-primary);
  filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.3));
  animation: pulse 3s ease-in-out infinite;
}

.logo-text {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-accent) 100%);
  transform: scaleY(0);
  transition: transform var(--transition-base);
  border-radius: 0 4px 4px 0;
}

.nav-item:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-primary);
  transform: translateX(4px);
}

.nav-item:hover::before {
  transform: scaleY(1);
}

.nav-item.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  color: white;
  box-shadow: var(--shadow-md);
  transform: translateX(4px);
}

.nav-item.active::before {
  transform: scaleY(1);
  background: white;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}

.theme-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.theme-toggle-btn:hover {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Main Content */
.content {
  flex: 1;
  margin-left: 280px;
  padding: var(--spacing-xl);
  overflow-y: auto;
  min-height: 100vh;
  background-color: var(--color-bg);
  transition: margin-left var(--transition-base);
}

/* Page Transitions */
.page-enter-active,
.page-leave-active {
  transition: all var(--transition-base);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Mobile Overlay */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: calc(var(--z-fixed) - 1);
  animation: fadeIn var(--transition-fast);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .sidebar {
    width: 260px;
  }
  
  .content {
    margin-left: 260px;
  }
}

@media (max-width: 768px) {
  .mobile-header {
    display: block;
  }

  .sidebar {
    transform: translateX(-100%);
    width: 280px;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  .sidebar-footer .theme-toggle-btn {
    display: flex;
  }

  .mobile-overlay {
    display: block;
  }

  .content {
    margin-left: 0;
    margin-top: 60px;
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .sidebar {
    width: 100%;
    max-width: 320px;
  }

  .logo-text {
    font-size: var(--font-size-lg);
  }

  .content {
    padding: var(--spacing-sm);
  }
}

/* Animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
