# OmniChatKit

> [!CAUTION]
> Disclaimer: Initial release. Not Everything is working yet. Not yet production ready. Please use with caution.

OmniChatKit is a comprehensive, modular React component library designed for building next-generation AI chat interfaces. It provides robust state management, native support for Generative UI (A2UI), and out-of-the-box compatibility with both the **Vercel AI SDK** and the **AG-UI Protocol**.

OmniChatKit comes with a fully bundled set of pre-styled Shadcn components, meaning you can drop it into any Next.js or React application without having to copy-paste or maintain UI primitives.

## Features

- 🔌 **Dual Protocol Support**: Choose between Vercel's standard Data Stream Protocol (`useChat`) or the advanced AG-UI Protocol (`@ag-ui/client`).
- 🎨 **Self-Contained UI**: Bundles 60+ customized Shadcn/Radix components internally (using `@base-ui/react` and Tailwind CSS).
- 🧩 **Generative UI (A2UI)**: Native support for rendering complex, interactive components dynamically via the `A2UICanvas` and a built-in catalog registry.
- 🏗️ **Unified Wrapper**: A single `<OmniChat>` wrapper component that handles provider injection, A2UI layout (`chat` vs `detached`), and API modes effortlessly.
- 📦 **Zustand State Management**: A unified, reactive state layer (`useAIChatStore`) decoupled from the underlying chat protocol.
- 🧠 **Native Reasoning Support**: Automatically extracts and beautifully renders `<think>` tags (e.g., from DeepSeek R1) as collapsible reasoning blocks.
- 🚦 **Advanced Interaction Control**: Built-in hooks for Human-in-the-Loop (HITL) workflows (`useHITL`) and streaming interrupts (`useInterrupts`).
- 📡 **Event Bus**: A lightweight `surface-bus.ts` to manage cross-component messaging and lifecycle events.

## Installation

You can install OmniChatKit via the repo or from your package manager once published.

```bash
npm install omnichatkit
# or
pnpm add omnichatkit
# or
yarn add omnichatkit
```

*Note: Since OmniChatKit relies on React 19+ and bundles its own Shadcn dependencies, you may occasionally need to use `--legacy-peer-deps` depending on your host application's configuration.*

---

## Comprehensive Guide & Setup

OmniChatKit is designed to be highly flexible. You can use the all-in-one `<OmniChat>` wrapper or manually compose your UI using individual providers and managers.

### 1. The `<OmniChat>` Wrapper (Recommended)

The `<OmniChat>` component is the easiest way to orchestrate providers, generative UI, and chat interfaces. Simply choose your `api_mode` and drop in your components.

```tsx
import { OmniChat, SessionManager } from 'omnichatkit';

export default function ChatPage() {
  return (
    <OmniChat 
      api_mode="ag-ui" // "ag-ui" or "vercel"
      apiRoute="/api/agent"
      a2uiRenderingOption="detached" // "detached" (split pane) or "chat" (inline)
      useA2UI={true}
      a2uiToolName="render-dynamic-ui"
      theme="dark"
    >
      {/* SessionManager slides out from the left by default */}
      <SessionManager storageMode="api" collapsible={false} className="w-80 shrink-0" />
      
      {/* A2UICanvas renders Generative UI tools */}
      <A2UICanvas />
      
      {/* ChatManager handles the message feed and input */}
      <ChatManager collapsible={true} position="right" />
    </OmniChat>
  );
}
```

### 2. Custom Composition

If you need finer control over the layout, you can compose the providers and managers manually:

```tsx
import { AGUIChatProvider, ChatManager, A2UICanvas, SessionManager } from 'omnichatkit';

export default function ChatPage() {
  return (
    <AGUIChatProvider apiRoute="/api/agent">
      <div className="flex h-screen w-full flex-row">
        {/* Sidebar */}
        <SessionManager storageMode="api" collapsible={true} position="left" />
        
        <div className="flex flex-1 flex-col relative">
          {/* ChatManager handles the message feed and input */}
          <ChatManager collapsible={true} position="right" />
        </div>
      </div>
    </AGUIChatProvider>
  );
}
```

### 3. API Route Setup

Depending on your `api_mode`, you need to set up your backend endpoint.

#### Vercel AI SDK Route (`api_mode="vercel"`)
```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });
  return result.toDataStreamResponse();
}
```

#### AG-UI Protocol Route (`api_mode="ag-ui"`)
```typescript
// app/api/agent/route.ts
import { AGUIServer } from '@ag-ui/server';

export async function POST(req: Request) {
  const { messages, session_id } = await req.json();
  
  // Setup your agent stream and return the AG-UI formatted response
  const stream = await myCustomAgent.run(messages);
  return new Response(stream);
}
```

### 4. Customizing ChatManager

The `ChatManager` component comes with extensive styling and layout capabilities.

#### Layout Props
- **`collapsible`** (`boolean`): Renders the component as a floating drawer (`<Sheet>`) with a dynamic toggle button.
- **`position`** (`"left" | "right" | "top" | "bottom"`): Controls where the drawer docks and automatically aligns the close button correctly.
- **`welcomeScreen`** (`boolean | ReactNode`): Set to `true` (default) to show the default welcome screen, or pass a custom React element.

#### Component Styling (`chatManagerComponentStyles`)
You can deeply customize the appearance of the ChatManager by passing nested style objects. We support `backgroundStyle` for all major layout sections:

```tsx
<ChatManager
  chatManagerComponentStyles={{
    backgroundStyle: "bg-slate-900", // Main container background
    headerStyle: {
      backgroundStyle: "bg-slate-950 border-b-slate-800",
      titleStyle: "text-blue-400 font-bold",
      collapseButtonStyle: "hover:bg-slate-800"
    },
    messageStyle: {
      backgroundStyle: "bg-slate-900", // Message feed background
      userMessageStyle: "bg-blue-600 text-white",
      assistantMessageStyle: "bg-slate-800 text-slate-200"
    },
    inputSectionStyle: {
      backgroundStyle: "bg-slate-950",
      containerStyle: "border-t-slate-800",
      inputStyle: "bg-slate-900 border-slate-700 text-white",
      buttonStyle: "bg-blue-600 hover:bg-blue-700"
    }
  }}
  labels={{
    title: "Support Assistant",
    placeholder: "How can I help you today?",
    sendButton: "Send Message"
  }}
/>
```

### 5. Customizing SessionManager

The `SessionManager` handles chat history.

#### Props
- **`storageMode`** (`"api" | "memory"`): Whether to fetch sessions from an API route or store them locally in memory.
- **`collapsible`** (`boolean`): Enables the drawer view for space-saving layouts.
- **`position`** (`"left" | "right"`): Where the manager should dock.

### 6. Working with AI Reasoning (e.g. DeepSeek `<think>`)
OmniChatKit automatically parses and extracts `<think>` tags from incoming model streams. It strips these out of the primary text response and renders them natively as a beautiful, collapsible "Reasoning" accordion inside the message block! No extra configuration is required.

---

## Core Architecture

OmniChatKit is structured around a few core pillars:

### 1. State Management (`useAIChatStore`)
OmniChatKit abstracts the chat stream state into a global Zustand store. Both `AIChatProvider` and `AGUIChatProvider` map their internal streaming events (Vercel SDK vs AG-UI) into this store. This means your UI components interact exclusively with `useAIChatStore`, completely decoupling your frontend from the backend protocol.

### 2. A2UI Canvas & Catalog
The `A2UICanvas` listens for specific tool invocations from the LLM and dynamically renders registered React components. You can pass your own custom components via the `catalog` prop on the provider, or rely on the robust default catalog bundled within OmniChatKit.

### 3. Pre-bundled UI Primitives
Unlike traditional Shadcn implementations that require you to copy source code into your repository, OmniChatKit pre-bundles everything inside `src/components/ui`. This includes highly customized versions of `Button`, `Input`, `ScrollArea`, `Sheet`, and 50+ other components tailored for chat interfaces.

## Available Exports

OmniChatKit exports all necessary hooks, components, and types to give you full control over your chat experience:

**Providers & Managers**
- `OmniChat`
- `AIChatProvider`
- `AGUIChatProvider`
- `ChatManager`
- `SessionManager`

**Hooks**
- `useAIChatStore`
- `useAGUIChat`
- `useHITL`
- `useInterrupts`

**UI & Generative Elements**
- `A2UICanvas`
- All pre-bundled Shadcn components (e.g., `Button`, `Input`, `ScrollArea`, `Sheet`, etc.)

## Development & Building

To contribute to OmniChatKit or build it locally:

```bash
# Install dependencies
npm install

# Run the development watcher
npm run dev

# Build the library (ESM, CJS, and Types)
npm run build

# Run typechecking
npm run lint
```

## License

MIT