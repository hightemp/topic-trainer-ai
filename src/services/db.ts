import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Category, Question, Attempt, Settings } from '../types';

interface TopicTrainerDB extends DBSchema {
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-parent': string };
  };
  questions: {
    key: string;
    value: Question;
    indexes: { 'by-category': string; 'by-tags': string[] };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { 'by-question': string; 'by-date': number };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

const DB_NAME = 'topic-trainer-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TopicTrainerDB>>;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<TopicTrainerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Categories store
        const catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('by-parent', 'parentId');

        // Questions store
        const qStore = db.createObjectStore('questions', { keyPath: 'id' });
        qStore.createIndex('by-category', 'categoryId');
        qStore.createIndex('by-tags', 'tags', { multiEntry: true });

        // Attempts store
        const attStore = db.createObjectStore('attempts', { keyPath: 'id' });
        attStore.createIndex('by-question', 'questionId');
        attStore.createIndex('by-date', 'date');

        // Settings store (single object usually, but we can use key 'main')
        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
};

export const dbService = {
  async getSettings(): Promise<Settings | undefined> {
    const db = await getDB();
    return db.get('settings', 'main');
  },
  async saveSettings(settings: Settings): Promise<string> {
    const db = await getDB();
    return db.put('settings', settings, 'main');
  },
  
  // Categories
  async getAllCategories(): Promise<Category[]> {
    const db = await getDB();
    return db.getAll('categories');
  },
  async saveCategory(category: Category): Promise<string> {
    const db = await getDB();
    return db.put('categories', category);
  },
  async deleteCategory(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('categories', id);
  },

  // Questions
  async getAllQuestions(): Promise<Question[]> {
    const db = await getDB();
    return db.getAll('questions');
  },
  async getQuestionsByCategory(categoryId: string): Promise<Question[]> {
    const db = await getDB();
    return db.getAllFromIndex('questions', 'by-category', categoryId);
  },
  async saveQuestion(question: Question): Promise<string> {
    const db = await getDB();
    return db.put('questions', question);
  },
  async deleteQuestion(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('questions', id);
  },

  // Attempts
  async saveAttempt(attempt: Attempt): Promise<string> {
    const db = await getDB();
    return db.put('attempts', attempt);
  },
  async getAttemptsByQuestion(questionId: string): Promise<Attempt[]> {
    const db = await getDB();
    return db.getAllFromIndex('attempts', 'by-question', questionId);
  },
  async getAllAttempts(): Promise<Attempt[]> {
    const db = await getDB();
    return db.getAll('attempts');
  },
  async getAttemptsByDateRange(startDate: number, endDate: number): Promise<Attempt[]> {
    const db = await getDB();
    const allAttempts = await db.getAllFromIndex('attempts', 'by-date');
    return allAttempts.filter(a => a.date >= startDate && a.date <= endDate);
  }
};