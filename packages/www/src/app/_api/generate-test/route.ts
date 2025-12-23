import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 30;

const systemPrompt = `You are an expert QA engineer specializing in Playwright integration tests. Write me an integration test in Playwright from the actions sequence provided.

Guidelines:
- Use modern Playwright best practices
- Use TypeScript
- Include proper selectors based on the element information provided (class names, text content, tag names)
- Add appropriate assertions for display checks
- Add URL assertions when URL checks are included
- Use page.locator() with appropriate selectors
- Include proper async/await patterns
- Add descriptive test names based on the actions
- Group related actions logically
- Add comments explaining each step

Output a complete, runnable Playwright test file.`;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const userMessage = `Here are the recorded actions to convert into a Playwright test:

${prompt}

Please generate a complete Playwright integration test based on these actions.`;

  const result = streamText({
    model: openai.responses("gpt-5.1"),
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return result.toTextStreamResponse();
}

