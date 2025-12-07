import { useSettingsStore } from '../stores/settings';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export class AIService {
  private get apiKey() {
    return useSettingsStore().settings.openRouterKey;
  }

  private get model() {
    return useSettingsStore().settings.openRouterModel || 'google/gemini-2.0-flash-exp';
  }

  private get tools() {
    return [
      {
        type: 'function',
        function: {
          name: 'create_category',
          description: 'Create a new category for questions',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the category' },
              parentId: { type: 'string', description: 'ID of the parent category (optional)', nullable: true }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_question',
          description: 'Create a new question',
          parameters: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The question text (Markdown supported)' },
              correctAnswer: { type: 'string', description: 'The correct answer (Markdown supported)' },
              difficulty: { type: 'number', description: 'Difficulty level 1-5' },
              tags: { type: 'array', items: { type: 'string' }, description: 'List of tags' },
              categoryId: { type: 'string', description: 'ID of the category this question belongs to' }
            },
            required: ['text', 'correctAnswer', 'difficulty', 'categoryId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_categories',
          description: 'Get list of existing categories to find IDs',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_category',
          description: 'Update an existing category',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID of the category to update' },
              name: { type: 'string', description: 'New name (optional)' },
              parentId: { type: 'string', description: 'New parent ID (optional)', nullable: true }
            },
            required: ['id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'delete_category',
          description: 'Delete a category',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID of the category to delete' }
            },
            required: ['id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_questions',
          description: 'Get list of questions (optionally filtered by category)',
          parameters: {
            type: 'object',
            properties: {
              categoryId: { type: 'string', description: 'Filter by category ID (optional)' },
              limit: { type: 'number', description: 'Max number of questions to return (default 20)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_question',
          description: 'Update an existing question',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID of the question to update' },
              text: { type: 'string', description: 'New text (optional)' },
              correctAnswer: { type: 'string', description: 'New correct answer (optional)' },
              difficulty: { type: 'number', description: 'New difficulty (optional)' },
              tags: { type: 'array', items: { type: 'string' }, description: 'New tags (optional)' },
              categoryId: { type: 'string', description: 'New category ID (optional)' }
            },
            required: ['id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'delete_question',
          description: 'Delete a question',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID of the question to delete' }
            },
            required: ['id']
          }
        }
      }
    ];
  }

  async chat(messages: Message[], onToolCall: (toolName: string, args: any) => Promise<any>, signal?: AbortSignal): Promise<Message> {
    if (!this.apiKey) {
      throw new Error('API Key not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Topic Trainer AI'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: this.tools
      }),
      signal
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'AI Request failed');
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    if (message.tool_calls) {
      // Handle tool calls sequentially
      const toolMessages: Message[] = [];
      
      // Add assistant message with tool calls
      toolMessages.push(message);

      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        let result;
        try {
          result = await onToolCall(toolCall.function.name, args);
        } catch (e: any) {
          result = { error: e.message };
        }

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(result)
        });
      }

      // Recursively call chat with tool results
      return this.chat([...messages, ...toolMessages], onToolCall, signal);
    }

    return message;
  }

  async evaluateAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<{ score: number; feedback: string }> {
    const prompt = `
      Question: ${question}
      Correct Answer: ${correctAnswer}
      User Answer: ${userAnswer}

      Evaluate the user's answer. 
      1. Give a score from 0 to 10 (0 = completely wrong, 10 = perfect).
      2. Provide brief feedback explaining the score and correcting any mistakes.
      
      Return JSON: { "score": number, "feedback": "string" }
    `;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Topic Trainer AI'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    try {
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error('Failed to parse AI evaluation', data);
      return { score: 0, feedback: 'Error parsing AI response' };
    }
  }
}

export const aiService = new AIService();