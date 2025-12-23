# miki

AI-powered Playwright test recorder for React applications. Record user interactions and generate Playwright tests automatically.

## Features

- 🎬 **Record interactions** - Click, hover, drag, input, and more
- 🔍 **Element capture** - Capture specific elements for assertions
- 🔗 **URL capture** - Record URL navigation for testing
- 🎯 **Smart selectors** - Prioritizes `data-testid`, `id`, then class/text
- ⌨️ **Configurable hotkeys** - Customize keyboard shortcuts
- 🌊 **Streaming generation** - Watch tests generate in real-time

## Installation

```bash
npm install miki
# or
pnpm add miki
# or
yarn add miki
```

## Prerequisites

This package uses **Tailwind CSS** for styling. Make sure your project has Tailwind CSS configured.

## Quick Start

```tsx
import { Miki } from "miki";

function App() {
  return (
    <>
      <YourApp />
      <Miki />
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiEndpoint` | `string` | `"/api/generate-test"` | API endpoint for test generation |
| `onStepsChange` | `(steps: RecordedStep[]) => void` | - | Callback when steps change |
| `onGenerateStart` | `(steps: RecordedStep[]) => void` | - | Callback when generation starts |
| `onGenerateComplete` | `(result: string) => void` | - | Callback when generation completes |
| `hotkeys` | `{ display?: string; url?: string }` | `{ display: "d", url: "u" }` | Custom hotkey configuration |
| `defaultOpen` | `boolean` | `true` | Initial sidebar state |

## API Endpoint

The component sends a POST request to your API endpoint with:

```json
{
  "prompt": "1. [CLICK] <button> data-testid=\"submit\" text=\"Submit\"\n2. [INPUT] <input> type=\"text\" value=\"hello\""
}
```

Your endpoint should stream back the generated test code. Example with Next.js and OpenAI:

```ts
// app/api/generate-test/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  
  const result = streamText({
    model: openai("gpt-4o"),
    system: "Generate a Playwright test based on these recorded steps...",
    prompt,
  });
  
  return result.toTextStreamResponse();
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Capture element for display assertion |
| `U` | Capture current URL |
| `Esc` | Cancel element selection |

## Recorded Interaction Types

- `click` - Mouse click
- `hover` - Mouse hover (3s delay)
- `grabStart` / `grabRelease` - Drag interactions
- `input` - Text input (debounced)
- `display` - Element capture for assertions
- `url` - URL navigation

## Tailwind CSS

This package requires Tailwind CSS to be configured in your project. The component uses Tailwind utility classes for styling.

Make sure to include the package in your Tailwind content configuration:

```js
// tailwind.config.js
module.exports = {
  content: [
    // ... your content paths
    "./node_modules/miki/**/*.{js,ts,jsx,tsx}",
  ],
  // ...
}
```

## TypeScript

Full TypeScript support with exported types:

```ts
import type { MikiProps, RecordedStep, InteractionType } from "miki";
```

## License

MIT
