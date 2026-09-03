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
- 🔁 **Auto Context Hook**: `useChatContext` automatically resolves the correct chat context (classic or ag-ui) without prop-drilling.

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
      api_mode="ag-ui" // "ag-ui" or "classic"
      apiEndpoint="/api/agent"
      a2uiRenderingOption="detached" // "detached" (split pane) or "chat" (inline)
      useA2UI={true}
      a2uiProps={{
        a2uiToolName: "render-dynamic-ui",
        agentId: "orchestratr_agent"
      }}
      theme="dark"
    >
      {/* SessionManager slides out from the left by default */}
      <SessionManager storageMode="api" collapsible={false} className="w-80 shrink-0" />
      
      {/* A2UICanvas renders Generative UI tools. It automatically inherits config from OmniChat! */}
      <A2UICanvas emptyState={<div className="p-4 text-center">Waiting for UI...</div>} />
      
      {/* ChatManager handles the message feed and input */}
      <ChatManager display="embedded" displayOptions={{ collapsible: true }} position="right" />
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
          <ChatManager display="embedded" displayOptions={{ collapsible: true }} position="right" />
        </div>
      </div>
    </AGUIChatProvider>
  );
}
```

### 3. API Route Setup

Depending on your `api_mode`, you need to set up your backend endpoint.

#### Vercel AI SDK Route (`api_mode="classic"`)
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

### 4. `chatApiSchema` — Custom Backend Mapping (`classic` mode)

When `api_mode="classic"`, OmniChatKit uses the Vercel AI SDK's `useChat` hook under the hood, which sends messages in its own standard body shape. If your backend API expects a **different request/response format**, pass a `chatApiSchema` prop to `<OmniChat>` to act as a transparent mapper between the two.

```tsx
<OmniChat
  api_mode="classic"
  apiEndpoint="/api/my-custom-agent"
  chatApiSchema={{
    apiRequestSchema: { /* how to serialize the outbound request */ },
    apiResponseSchema: { /* how to deserialize the inbound response */ },
  }}
>
  <ChatManager />
</OmniChat>
```

> [!NOTE]
> `chatApiSchema` is a **compile-time narrowed prop** — TypeScript will reject it (type error) if you pass it while `api_mode="ag-ui"`.

#### `apiRequestSchema`

Controls how the outgoing payload is built before each request.

| Field | Type | Default | Description |
|---|---|---|---|
| `messagesKey` | `string` | `"messages"` | Top-level key used for the messages array in the body |
| `userMessageKey` | `string` | — | If set, adds an extra key containing only the latest user message text |
| `extraBody` | `Record<string, unknown>` | — | Static fields merged into every request body |
| `transform` | `(payload) => payload` | — | Full custom serializer — receives the default payload, returns the final body |

**Example — rename the messages array and add a static model field:**

```ts
chatApiSchema: {
  apiRequestSchema: {
    messagesKey: 'history',
    extraBody: { model: 'gpt-4o', temperature: 0.7 },
  },
}
// Sends: { history: [...messages], model: 'gpt-4o', temperature: 0.7 }
```

**Example — completely custom body using `transform`:**

```ts
chatApiSchema: {
  apiRequestSchema: {
    transform: (payload) => ({
      query: (payload.messages as any[]).at(-1)?.content ?? '',
      context: payload.messages,
      stream: true,
    }),
  },
}
// Sends: { query: "latest user message", context: [...], stream: true }
```

#### `apiResponseSchema`

Controls how the raw API JSON response is mapped back into OmniChatKit's internal message shape.

| Field | Type | Default | Description |
|---|---|---|---|
| `contentPath` | `string` | `"content"` | Dot-separated path to the assistant text inside the response JSON |
| `transform` | `(raw) => Partial<Message>` | — | Full custom deserializer — receives the raw parsed JSON, returns a message-compatible object |

**Example — your API returns `{ reply: "..." }` instead of `{ content: "..." }`:**

```ts
chatApiSchema: {
  apiResponseSchema: {
    contentPath: 'reply',
  },
}
```

**Example — nested path `data.message.text`:**

```ts
chatApiSchema: {
  apiResponseSchema: {
    contentPath: 'data.message.text',
  },
}
```

**Example — full custom transform:**

```ts
chatApiSchema: {
  apiResponseSchema: {
    transform: (raw) => ({
      role: 'assistant',
      content: (raw as any).output?.text ?? '',
    }),
  },
}
```

#### Accessing `chatApiSchema` from other components

The schema is also stored in the global Zustand store so any downstream component or hook can read it without prop-drilling:

```ts
import { useAIChatStore } from 'omnichatkit';

const chatApiSchema = useAIChatStore((s) => s.chatApiSchema);
// chatApiSchema?.apiRequestSchema, chatApiSchema?.apiResponseSchema
```

---

### 5. Customizing ChatManager

The `ChatManager` component comes with extensive styling and layout capabilities.

#### Layout Props
- **`display`** (`"floating" | "embedded"`): Controls the layout mode of the chat manager. 
- **`displayOptions`** (`object`): Configuration for the selected display mode.
  - `collapsible` (`boolean`): When display is "embedded", renders the component as a floating drawer (`<Sheet>`) with a dynamic toggle button.
  - `isResizable` (`boolean`): When display is "embedded", allows the chat drawer to be resized by the user.
- **`position`** (`"left" | "right" | "top" | "bottom"`): Controls where the drawer docks and automatically aligns the close button correctly.
- **`welcomeScreen`** (`boolean | ReactNode`): Set to `true` (default) to show the default welcome screen, or pass a custom React element.
- **`maxInputCharacter`** (`number`): Optional limit for the maximum number of characters allowed in the chat input box.
- **`autoScroll`** (`boolean`): Automatically scrolls the chat feed to the bottom when new messages arrive. Defaults to `true`. Scrolling up manually will pause auto-scroll and show a "Scroll to bottom" button.
- **`streaming`** (`boolean`): Enable or disable streaming for responses. When set, this flag is forwarded to the backend via the request body. Omit to let the backend decide.
- **`sendHistory`** (`boolean`): Set to `false` to send only the latest message to the API instead of the entire chat history. Defaults to `true`.
- **`showToolCalls`** (`boolean`): Set to `true` to display tool invocations in the chat feed. Defaults to `false`.
- **`showReasoning`** (`boolean`): Set to `true` to display AI reasoning blocks (e.g. `<think>` tags) in the chat feed. Defaults to `false` (or handled automatically in some setups).
- **`inputTypeList`** (`Array<"image" | "document" | "audio" | "video">`): Enables the multimodal attachment menu and specifies which file types users can upload.
- **`promptChips`** (`PromptChips`): Render actionable chips above the input box (e.g., for suggested questions or starter prompts). Includes a `promptChipList` (title, hoverText, prompt) and an `alwaysShow` boolean flag.
- **`toggleButtonProps`** (`object`): Deep customization for the collapse/expand trigger button (replaces old `toggleButtonStyle`).
  - `toggleButtonStyle`: Overall button container styles.
  - `toggleButtonIconProps`: Nested object for `{ toggleButtonIcon, toggleButtonIconStyle }`. By default, renders a `MessageCircle` icon.
  - `toggleButtonLabelProps`: Nested object for `{ toggleButtonLabel, toggleButtonLabelStyle }` to add text alongside the icon.

#### Streaming Toggle

Use the `streaming` prop to explicitly control whether responses are streamed:

```tsx
{/* Disable streaming — receive the full response at once */}
<ChatManager streaming={false} />

{/* Force streaming on (default behavior for most backends) */}
<ChatManager streaming={true} />

{/* Omit the prop entirely to let the backend decide */}
<ChatManager />
```

The `streaming` flag is forwarded in the request body (`{ streaming: true|false }`) on every message send, including prompt chip clicks. Your API route can read and act on this:

```typescript
export async function POST(req: Request) {
  const { messages, streaming } = await req.json();
  const result = streamText({ model: openai('gpt-4o'), messages });
  return streaming === false
    ? result.toTextResponse()
    : result.toDataStreamResponse();
}
```

#### Component Styling (`chatManagerComponentStyles`)
You can deeply customize the appearance of the ChatManager by passing nested style objects. We support `backgroundStyle` for all major layout sections, as well as advanced message and badge styling:

```tsx
import { User, Bot } from 'lucide-react';

<ChatManager
  chatManagerComponentStyles={{
    backgroundStyle: "bg-slate-900", // Main container background
    headerStyle: {
      backgroundStyle: "bg-slate-950 border-b-slate-800",
      titleStyle: "text-blue-400 font-bold",
      collapseButtonStyle: "hover:bg-slate-800"
    },
    // Customize user and agent badges (name tags/icons)
    userBadgeStyle: {
      containerStyle: "bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full flex items-center gap-1",
      textStyle: "text-blue-700 dark:text-blue-300 font-medium text-xs",
      icon: <User size={12} />
    },
    agentBadgeStyle: {
      containerStyle: "bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full flex items-center gap-1",
      textStyle: "text-purple-700 dark:text-purple-300 font-medium text-xs",
      icon: <Bot size={12} />
    },
    messageStyle: {
      backgroundStyle: "bg-slate-900", // Message feed background
      
      // Advanced message layout & styling
      // Note: OmniChatKit automatically applies a sharp "notch" (corner radius) 
      // to the bottom-right or bottom-left depending on the alignment!
      userMessageStyles: {
        alignment: "right", // Align left, right, or center
        bubbleStyle: "bg-blue-600 text-white shadow-md rounded-2xl px-4 py-3",
        containerStyle: "mt-2"
      },
      assistantMessageStyles: {
        alignment: "left", // Defaults to left, but can be overridden to center or right
        bubbleStyle: "bg-slate-800 text-slate-200 shadow-sm rounded-2xl px-4 py-3"
      },
      stopResponseStyle: "text-slate-400" // Styles the Response Stopped divider
    },
    // Customize suggested prompt chips
    promptChipStyles: {
      promptChipContainerStyle: "pt-4 gap-2 border-t-slate-800",
      promptChipTitleStyle: "bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-full border border-slate-700",
      promptChipHoverTextStyle: "transition-colors"
    },
    // Customize the "Scroll to bottom" button (appears when auto-scroll is interrupted)
    scrollButtonStyles: {
      iconStyles: "text-slate-300",
    },
    inputSectionStyle: {
      backgroundStyle: "bg-slate-950",
      containerStyle: "border-t-slate-800",
      inputStyle: "bg-slate-900 border-slate-700 text-white",
      sendButtonStyles: {
        containerStyle: "bg-blue-600 hover:bg-blue-700 text-white"
      },
      attachmentMenuStyles: {
        plusButtonContainerStyles: "text-slate-400 hover:text-white border-slate-700",
        menuContainerStyles: "bg-slate-900 border-slate-700"
      }
    }
  }}
  labels={{
    title: "Support Assistant",
    placeholder: "How can I help you today?",
    sendButton: "Send Message"
  }}
/>
```

### 6. Customizing SessionManager

The `SessionManager` handles chat history.

Enable sessions on `OmniChat` (or either chat provider) before rendering it. Session handling is disabled by default, so chats have no session creation, persistence, or rename requests unless you opt in.

```tsx
<OmniChat api_mode="ag-ui" sessionStorageMode="api">
  <SessionManager />
  <ChatManager />
</OmniChat>
```

#### Props
- **`sessionStorageMode`** (`"disabled" | "api" | "memory"`): Set on `OmniChat` or a chat provider. `"disabled"` is the default; `SessionManager` throws if it is rendered in this mode.
- **`collapsible`** (`boolean`): Enables the drawer view for space-saving layouts.
- **`position`** (`"left" | "right"`): Where the manager should dock.

#### Session list style slots

Use `sessionManagerComponentStyles.listStyle` to replace the list icons or style each action:

```tsx
<SessionManager
  sessionManagerComponentStyles={{
    listStyle: {
      listItemIconStyles: { icon: <MessageSquare />, iconStyle: 'text-primary' },
      listItemPinButtonStyles: { icon: <Pin />, iconStyles: 'text-primary' },
      listItemMenuButtonStyles: { icon: <MoreHorizontal />, iconStyle: 'text-primary' },
      listItemRenameButtonStyles: { icon: <Pencil />, iconStyle: 'text-primary', text: 'Edit', textStyle: 'font-semibold' },
      listItemDeleteButtonStyles: { icon: <Trash2 />, iconStyle: 'text-destructive', text: 'Remove', textStyle: 'font-semibold' },
    },
  }}
/>
```

### 7. `useChatContext` â€” Auto Context Hook

`useChatContext` is a convenience hook that automatically resolves the correct chat context based on whichever provider (`AIChatProvider` or `AGUIChatProvider`) is present in the React tree. Use it instead of calling `useAIChatContext` or `useAGUIChatContext` directly.

```tsx
import { useChatContext } from 'omnichatkit';

function MyCustomChatUI() {
  const { messages, append, status, stop } = useChatContext();

  return (
    <div>
      {messages.map(m => <p key={m.id}>{m.content}</p>)}
      <button onClick={() => append({ role: 'user', content: 'Hello!' })}>
        Send
      </button>
      {status === 'streaming' && (
        <button onClick={stop}>Stop</button>
      )}
    </div>
  );
}
```

**Resolution logic:**
1. **Only one provider in the tree** â†’ returns that context directly. No store lookup needed.
2. **Both providers present** â†’ uses the `api_mode` registered by `<OmniChat>` as a tiebreaker.
3. **Neither present** â†’ throws a descriptive error.

> [!NOTE]
> `useChatContext` is safe to use immediately on first render. It reads context values synchronously from the React tree rather than relying on the store's `apiMode` value, which is set via `useEffect` and would not be available on the initial render.

### 8. Working with AI Reasoning (e.g. DeepSeek `<think>`)
OmniChatKit automatically parses and extracts `<think>` tags from incoming model streams. It strips these out of the primary text response and renders them natively as a beautiful, collapsible "Reasoning" accordion inside the message block! No extra configuration is required.

---

## Core Architecture

OmniChatKit is structured around a few core pillars:

### 1. State Management (`useAIChatStore`)
OmniChatKit abstracts the chat stream state into a global Zustand store. Both `AIChatProvider` and `AGUIChatProvider` map their internal streaming events (Vercel SDK vs AG-UI) into this store. This means your UI components interact exclusively with `useAIChatStore`, completely decoupling your frontend from the backend protocol.

### 2. A2UI Canvas & Catalog
The `A2UICanvas` listens for specific tool invocations from the LLM and dynamically renders registered React components. You can pass your own custom components via the `catalog` prop on the provider, or rely on the robust default catalog bundled within OmniChatKit.

Tool invocations are read from the Vercel AI SDK's `message.parts` array (using `ToolInvocationUIPart` entries) with a transparent fallback to `message.toolInvocations` for AG-UI messages that predate the `parts` API.

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
- `useChatContext` â€” auto-selects the correct context based on the active provider
- `useAIChatContext` â€” explicit classic (Vercel AI SDK) context accessor
- `useAGUIChatContext` â€” explicit AG-UI context accessor
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

Apache-2.0 

