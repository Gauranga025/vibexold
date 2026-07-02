import { NextRequest, NextResponse } from "next/server";
import { GeminiProvider } from "@/lib/ai/providers";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  mode?: "chat" | "review" | "fix" | "optimize";
}

async function generateAIResponse(messages: ChatMessage[], mode: string = "chat"): Promise<string> {
  const systemPrompts: Record<string, string> = {
    chat: `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice  
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`,
    
    review: `You are a code review expert. Analyze the provided code and provide:
- Detailed suggestions for improvement
- Performance optimizations
- Security considerations
- Best practices recommendations
- Potential bugs or issues

Be thorough and specific with your feedback.`,
    
    fix: `You are a debugging expert. Help fix issues in the code by:
- Identifying bugs and errors
- Explaining the root cause
- Providing specific fixes with code examples
- Suggesting preventive measures
- Testing strategies

Focus on practical solutions.`,
    
    optimize: `You are a performance optimization expert. Analyze the code for:
- Performance bottlenecks
- Memory usage issues
- Algorithmic improvements
- Caching opportunities
- Efficiency gains

Provide actionable optimization suggestions.`
  };

  const systemPrompt = systemPrompts[mode] || systemPrompts.chat;
  
  const prompt = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  try {
    const llmProvider = new GeminiProvider();
    const response = await llmProvider.generateResponse(prompt, systemPrompt);
    return response;
  } catch (error) {
    console.error("AI generation error:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to generate AI response");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, history = [], mode = "chat" } = body;

    // Validate input
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate history format
    const validHistory = Array.isArray(history)
      ? history.filter(
          (msg) =>
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            ["user", "assistant"].includes(msg.role)
        )
      : [];

    const recentHistory = validHistory.slice(-10);

    const messages: ChatMessage[] = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    // Generate AI response with mode
    const aiResponse = await generateAIResponse(messages, mode);

    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
