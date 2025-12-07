import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dbService } from '../services/db';
import { type Settings, DEFAULT_SETTINGS } from '../types';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
  const isLoaded = ref(false);

  async function loadSettings() {
    const saved = await dbService.getSettings();
    if (saved) {
      settings.value = { ...DEFAULT_SETTINGS, ...saved };
    }
    isLoaded.value = true;
  }

  async function updateSettings(newSettings: Partial<Settings>) {
    settings.value = { ...settings.value, ...newSettings };
    // Clone to plain object to avoid Proxy issues with IndexedDB
    await dbService.saveSettings(JSON.parse(JSON.stringify(settings.value)));
  }

  return {
    settings,
    isLoaded,
    loadSettings,
    updateSettings
  };
});