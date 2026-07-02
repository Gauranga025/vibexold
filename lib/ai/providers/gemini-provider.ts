import { GoogleGenAI } from '@google/genai';

export interface LLMProvider {
  generateResponse(prompt: string, systemPrompt?: string): Promise<string>;
}

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, model: string = 'gemini-2.5-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    
    if (!key) {
      throw new Error(
        'GEMINI_API_KEY is required. Set it in environment variables or pass it to the constructor. ' +
        'Get an API key from https://aistudio.google.com/apikey'
      );
    }

    try {
      this.client = new GoogleGenAI({ apiKey: key });
    } catch (error) {
      throw new Error(
        `Failed to initialize GoogleGenAI client: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    this.model = model;
  }

  async generateResponse(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction: systemPrompt || this.getDefaultSystemPrompt(),
        },
      });

      if (!response || !response.text) {
        throw new Error('Gemini returned empty response');
      }

      const text = response.text;
      
      if (!text || text.trim().length === 0) {
        throw new Error('Gemini returned empty response');
      }

      return text.trim();
    } catch (error) {
      console.error('Gemini generation error:', error);
      
      // Handle SDK ApiError
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string; name?: string };
        
        if (apiError.status === 401 || apiError.message?.includes('API key')) {
          throw new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable.');
        }
        
        if (apiError.status === 403 || apiError.message?.includes('permission')) {
          throw new Error('Permission denied. Check your API key permissions.');
        }
        
        if (apiError.status === 404 || apiError.message?.includes('not found')) {
          throw new Error(`Model '${this.model}' not found. Please check the model name.`);
        }
        
        if (apiError.status === 429 || apiError.message?.includes('quota') || apiError.message?.includes('rate limit')) {
          throw new Error('Gemini API rate limit exceeded. Please try again later or upgrade your plan.');
        }
        
        if (apiError.status === 503 || apiError.message?.includes('unavailable')) {
          throw new Error('Gemini service is temporarily unavailable. Please try again later.');
        }
        
        throw new Error(`Gemini API error (${apiError.status}): ${apiError.message || 'Unknown error'}`);
      }
      
      // Handle generic errors
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('network')) {
          throw new Error('Gemini API request timed out. Please check your network connection.');
        }
        throw new Error(`Gemini error: ${error.message}`);
      }
      
      throw new Error('Failed to generate response from Gemini');
    }
  }

  private getDefaultSystemPrompt(): string {
    return `You are an experienced software engineer and repository analyst. Your role is to analyze codebases and provide accurate, context-aware answers.

CRITICAL RULES:
1. NEVER invent files that don't exist in the provided context
2. NEVER hallucinate functions or code that aren't shown
3. EXPLICITLY state when information is missing from the context
4. Answer ONLY using the supplied repository context whenever possible
5. If the context doesn't contain the answer, say "I don't have enough information about this in the provided repository context"

When answering:
- Be specific and reference actual code with file paths and line numbers
- Explain the "why" not just the "what"
- Provide actionable insights
- Use code examples when helpful
- Admit uncertainty rather than guessing

Output format:
- Use clean markdown with headings, bullet points, and code blocks
- Include file names and function names when referencing code
- Keep responses concise and focused
- Avoid unnecessary text`;
  }
}
