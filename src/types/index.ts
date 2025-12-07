export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Question {
  id: string;
  text: string; // Markdown
  correctAnswer: string; // Markdown
  difficulty: number; // 1-5
  tags: string[];
  categoryId: string;
  nextReviewDate: number; // timestamp
  interval: number; // days
  repetitionFactor: number; // E-factor
}

export interface Attempt {
  id: string;
  questionId: string;
  date: number; // timestamp
  userAnswer: string;
  aiScore: number; // 0-10
  aiFeedback: string;
  duration: number; // seconds
}

export interface Settings {
  openRouterKey: string;
  openRouterModel: string;
  userName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  openRouterKey: '',
  openRouterModel: 'google/gemini-2.0-flash-exp',
  userName: 'User',
};