export interface LLMProvider {
  generateResponse(prompt: string, systemPrompt?: string): Promise<string>;
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'codellama:latest') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateResponse(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.response) {
        throw new Error('No response from Ollama');
      }

      return data.response.trim();
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
