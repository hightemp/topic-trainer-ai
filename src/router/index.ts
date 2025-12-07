import { createRouter, createWebHashHistory } from 'vue-router';
import SettingsView from '../views/SettingsView.vue';

const routes = [
  {
    path: '/',
    redirect: '/library'
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('../views/LibraryView.vue')
  },
  {
    path: '/trainer',
    name: 'trainer',
    component: () => import('../views/TrainerView.vue')
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('../views/ChatView.vue')
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('../views/StatsView.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;