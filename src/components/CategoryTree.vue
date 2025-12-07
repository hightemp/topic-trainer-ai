<script setup lang="ts">
import { ref } from 'vue';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, Edit2 } from 'lucide-vue-next';
import type { Category } from '../types';

const props = defineProps<{
  nodes: any[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'add', parentId: string | null): void;
  (e: 'edit', category: Category): void;
  (e: 'delete', id: string): void;
  (e: 'dragstart', event: DragEvent, node: any): void;
  (e: 'drop', event: DragEvent, node: any): void;
}>();

import { watch } from 'vue';

const expanded = ref<Set<string>>(new Set());

// Initialize expanded state
const initExpanded = (nodes: any[]) => {
  nodes.forEach(node => {
    expanded.value.add(node.id);
    if (node.children && node.children.length > 0) {
      initExpanded(node.children);
    }
  });
};

// Watch for nodes changes to auto-expand new nodes or initial load
watch(() => props.nodes, (newNodes) => {
  // Only expand if it's the first load or we want to auto-expand everything
  // For now, let's just ensure all are expanded on load if set is empty
  if (expanded.value.size === 0 && newNodes.length > 0) {
    initExpanded(newNodes);
  }
}, { immediate: true });

function toggle(id: string) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id);
  } else {
    expanded.value.add(id);
  }
}

function select(id: string) {
  emit('select', id);
}
</script>

<template>
  <ul class="tree-list">
    <li v-for="node in nodes" :key="node.id" class="tree-item">
      <div
        class="tree-content"
        :class="{ 'selected': selectedId === node.id }"
        @click="select(node.id)"
        draggable="true"
        @dragstart="emit('dragstart', $event, node)"
        @drop="emit('drop', $event, node)"
        @dragover.prevent
      >
        <button 
          v-if="node.children && node.children.length > 0" 
          class="icon-btn toggle-btn" 
          @click.stop="toggle(node.id)"
        >
          <ChevronDown v-if="expanded.has(node.id)" :size="16" />
          <ChevronRight v-else :size="16" />
        </button>
        <span v-else class="spacer"></span>

        <FolderOpen v-if="expanded.has(node.id)" :size="18" class="folder-icon" />
        <Folder v-else :size="18" class="folder-icon" />

        <span class="node-name">{{ node.name }}</span>

        <div class="actions">
          <button class="icon-btn" @click.stop="emit('add', node.id)" title="Add Subcategory">
            <Plus :size="14" />
          </button>
          <button class="icon-btn" @click.stop="emit('edit', node)" title="Edit">
            <Edit2 :size="14" />
          </button>
          <button class="icon-btn danger" @click.stop="emit('delete', node.id)" title="Delete">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <div v-if="expanded.has(node.id) && node.children.length > 0" class="children">
        <CategoryTree
          :nodes="node.children"
          :selectedId="selectedId"
          @select="emit('select', $event)"
          @add="emit('add', $event)"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
          @dragstart="(e, n) => emit('dragstart', e, n)"
          @drop="(e, n) => emit('drop', e, n)"
        />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.tree-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tree-item {
  margin-bottom: 2px;
}

.tree-content {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s;
}

.tree-content:hover {
  background-color: var(--color-surface-hover);
}

.tree-content.selected {
  background-color: var(--color-primary);
  color: white;
}

.tree-content.selected .icon-btn {
  color: white;
}

.tree-content.selected .icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.icon-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.icon-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.icon-btn.danger:hover {
  color: var(--color-danger);
}

.toggle-btn {
  margin-right: 4px;
}

.spacer {
  width: 24px;
}

.folder-icon {
  margin-right: 8px;
}

.node-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-content:hover .actions {
  opacity: 1;
}

.children {
  padding-left: 20px;
  border-left: 1px solid var(--color-border);
  margin-left: 12px;
}
</style>