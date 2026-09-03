import { ReactNode } from 'react';
import type { Message as AiMessage, CreateMessage } from 'ai';

/**
 * Available built-in themes for the chat interface.
 */
export type ChatTheme = 'standard' | 'dark' | 'light';

/**
 * Determines how chat sessions are persisted across reloads.
 * - 'disabled': Sessions are not tracked at all.
 * - 'memory': Sessions are saved to the browser's `sessionStorage`.
 * - 'api': Sessions are loaded from and saved to a remote server.
 */
export type StorageMode = 'disabled' | 'memory' | 'api';

/**
 * Determines the layout behavior for the Agentic UI (A2UI) canvas.
 * - 'inline': Rendered within the message list.
 * - 'split': Rendered in a separate detached canvas next to the chat.
 */
export type A2UILayout = 'inline' | 'split';

/**
 * Position of the chat component relative to its container.
 */
export type ComponentPosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * Visual display mode for the chat manager.
 * - 'embedded': Rendered inline with the normal document flow.
 * - 'floating': Rendered as a floating widget on top of the page.
 */
export type DisplayMode = 'embedded' | 'floating';

/**
 * A mapping of component names to React functional components.
 * Used for rendering dynamic UI from the Agentic UI (A2UI) system.
 */
export interface A2UICatalog {
  [componentName: string]: React.FC<any>;
}

export interface LabelStyles {
  titleStyle?: React.CSSProperties | string;
  subtitleStyle?: React.CSSProperties | string;
  disclaimerStyle?: React.CSSProperties | string;
  backgroundStyle?: React.CSSProperties | string;
}

export interface HeaderStyles {
  titleStyle?: React.CSSProperties | string;
  subtitleStyle?: React.CSSProperties | string;
  collapseButtonStyle?: React.CSSProperties | string;
  backgroundStyle?: React.CSSProperties | string;
}

export interface ChatLabels {
  title: string;
  subtitle?: string | ReactNode;
  placeholder: string;
  sendButton: string;
  stopButton?: string;
  reloadButton?: string;
  disclaimer: string | ReactNode;
  labelStyles?: LabelStyles;
  userLabel?: string | ReactNode;
  assistantLabel?: string | ReactNode;
}

export interface WelcomeScreenProps {}
export type SlotValue<T> = T | ReactNode;

/**
 * Internal representation of a chat message. Extends the Vercel AI SDK Message.
 */
export interface Message extends Omit<AiMessage, 'role' | 'content'> {
  /** The author of the message. Typically 'user' or 'assistant', but supports custom roles. */
  role: 'user' | 'assistant' | 'system' | 'tool' | 'developer' | 'activity' | 'reasoning' | string;
  /** The message text or array of rich input content (like images/documents). */
  content?: string | InputContent[];
  /** Optional display name of the message sender. */
  name?: string;
  /** Encrypted or masked content for sensitive information. */
  encryptedContent?: string;
  /** Arbitrary metadata attached to the message. */
  metadata?: Record<string, any>;
  /** Defines the Agentic UI component to render for this message. */
  componentPayload?: {
    /** The name of the component, matching an entry in the A2UICatalog. */
    name: string;
    /** The props to pass to the component. */
    props: Record<string, any>;
  };
  /** Indicates if a human-in-the-loop review is required before continuing. */
  hitlRequired?: boolean;
}

export interface AIChatServerOptions {
  apiKey: string;
  endpoint?: string;
  headers?: Record<string, string>;
}

export type InputContent =
  | TextInputContent
  | ImageInputContent
  | AudioInputContent
  | VideoInputContent
  | DocumentInputContent;

export interface InputContentDataSource {
  type: "data";
  value: string;
  mimeType: string;
}

export interface InputContentUrlSource {
  type: "url";
  value: string;
  mimeType?: string;
}

export type InputContentSource = InputContentDataSource | InputContentUrlSource;

export interface TextInputContent {
  type: "text";
  text: string;
}

export interface ImageInputContent {
  type: "image";
  source: InputContentSource;
  metadata?: Record<string, unknown>;
}

export interface AudioInputContent {
  type: "audio";
  source: InputContentSource;
  metadata?: Record<string, unknown>;
}

export interface VideoInputContent {
  type: "video";
  source: InputContentSource;
  metadata?: Record<string, unknown>;
}

export interface DocumentInputContent {
  type: "document";
  source: InputContentSource;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ApiSchema — maps OmniChatKit's internal message shape to a custom backend
// ---------------------------------------------------------------------------

/**
 * Describes how to serialize the outbound chat payload before it is sent to
 * the backend. Each field is an optional key that overrides the default field
 * name used by the Vercel AI SDK `useChat` body.
 *
 * Example — if your API expects `{ query, history }` instead of `{ messages }`:
 * ```ts
 * apiRequestSchema: {
 *   messagesKey: 'history',
 *   userMessageKey: 'query',
 *   transform: (payload) => ({ query: payload.messages.at(-1)?.content, history: payload.messages }),
 * }
 * ```
 */
export interface ApiRequestSchema {
  /** The top-level key used for the messages array (default: `'messages'`). */
  messagesKey?: string;
  /** The key used for a single user message string (default: `'content'`). */
  userMessageKey?: string;
  /** Additional static fields merged into every request body. */
  extraBody?: Record<string, unknown>;
  /**
   * Full custom serializer. When provided, receives the default payload and
   * must return the final body object that will be JSON-stringified and sent.
   */
  transform?: (payload: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Describes how to deserialize the backend response back into the internal
 * `Message` shape consumed by OmniChatKit.
 *
 * Example — if your API returns `{ reply: string, metadata: object }`:
 * ```ts
 * apiResponseSchema: {
 *   contentPath: 'reply',
 *   transform: (raw) => ({ role: 'assistant', content: raw.reply }),
 * }
 * ```
 */
export interface ApiResponseSchema {
  /**
   * Dot-separated path to the assistant message text within the JSON response
   * (default: `'content'`).
   * E.g. `'data.message.text'` resolves `response.data.message.text`.
   */
  contentPath?: string;
  /**
   * Full custom deserializer. When provided, receives the raw parsed JSON and
   * must return a partial `Message`-compatible object.
   */
  transform?: (raw: Record<string, unknown>) => Partial<{ role: string; content: string; [key: string]: unknown }>;
}

/** Combined schema that pairs a request serializer with a response deserializer. */
export interface ApiSchema {
  apiRequestSchema?: ApiRequestSchema;
  apiResponseSchema?: ApiResponseSchema;
}

/**
 * Props for configuring the AIChatProvider (classic mode).
 */
export interface AIChatProviderProps {
  children: ReactNode;
  /** Visual theme for the chat. */
  theme?: ChatTheme;
  /** The endpoint route for the Vercel AI SDK `useChat`. */
  apiEndpoint?: string; 
  /** Optional identifier for the current agent context. */
  agentId?: string;
  /** Unique ID for the current chat session. */
  sessionId?: string;
  /** How session state should be managed. */
  sessionStorageMode?: StorageMode;
  /** The endpoint to use when session storage is set to 'api'. */
  sessionRoute?: string;
  /** Schema that maps OmniChatKit's internal message format to the backend API. Only used in `classic` mode. */
  chatApiSchema?: ApiSchema;
}

export type ToggleButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface MessageContentStyles {
  containerStyle?: React.CSSProperties | string;
  bubbleStyle?: React.CSSProperties | string;
  alignment?: 'left' | 'right' | 'center';
  badgeStyle?: BadgeStyles | string;
  attachmentPreviewStyles?: {
    containerStyle?: React.CSSProperties | string;
    itemStyle?: React.CSSProperties | string;
  };
}

export interface AssistantMessageContentStyles extends MessageContentStyles {
  subAgentBadgeStyle?: BadgeStyles | string;
}

export interface ThinkingStepStyles {
  containerStyle?: React.CSSProperties | string;
  iconStyles?: {
    icon?: ReactNode;
    iconStyle?: React.CSSProperties | string;
  };
  titleStyle?: React.CSSProperties | string;
  dataStyle?: React.CSSProperties | string;
}

export interface ToolCallStepStyles {
  containerStyle?: React.CSSProperties | string;
  headerStyles?: {
    iconStyles?: {
      icon?: ReactNode;
      iconStyle?: React.CSSProperties | string;
    };
    titleStyles?: {
      titleStyle?: React.CSSProperties | string;
      toolNameStyle?: React.CSSProperties | string;
    };
  };
  requestDataStyles?: {
    icon?: ReactNode;
    iconStyle?: React.CSSProperties | string;
    titleStyle?: React.CSSProperties | string;
    dataStyle?: React.CSSProperties | string;
  };
  responseDataStyles?: {
    icon?: ReactNode;
    iconStyle?: React.CSSProperties | string;
    titleStyle?: React.CSSProperties | string;
    dataStyle?: React.CSSProperties | string;
  };
}

export interface MessageStyles {
  assistantMessageStyles?: React.CSSProperties | string | AssistantMessageContentStyles;
  userMessageStyles?: React.CSSProperties | string | MessageContentStyles;
  developerMessageStyles?: React.CSSProperties | string | MessageContentStyles;
  activityMessageStyles?: React.CSSProperties | string | MessageContentStyles;
  thinkingStepStyles?: ThinkingStepStyles;
  toolCallStepStyles?: ToolCallStepStyles;
  stopResponseStyle?: React.CSSProperties | string;
  backgroundStyle?: React.CSSProperties | string;
}

export interface InputStyles {
  inputStyle?: React.CSSProperties | string;
  sendButtonStyles?: {
    icon?: ReactNode;
    iconStyles?: React.CSSProperties | string;
    labelStyles?: React.CSSProperties | string;
    containerStyle?: React.CSSProperties | string;
  };
  attachmentMenuStyles?: {
    plusButtonIcon?: ReactNode;
    plusButtonIconStyles?: React.CSSProperties | string;
    plusButtonContainerStyles?: React.CSSProperties | string;
    menuContainerStyles?: React.CSSProperties | string;
    menuItemStyles?: React.CSSProperties | string;
    menuItemIconStyles?: React.CSSProperties | string;
    previewContainerStyles?: React.CSSProperties | string;
    previewItemContainerStyles?: React.CSSProperties | string;
    previewDialogContainerStyles?: React.CSSProperties | string;
    previewDialogMediaStyles?: React.CSSProperties | string;
  };
  containerStyle?: React.CSSProperties | string;
  backgroundStyle?: React.CSSProperties | string;
}

export interface BadgeStyles {
  containerStyle?: React.CSSProperties | string;
  textStyle?: React.CSSProperties | string;
  icon?: ReactNode;
}

export interface PromptChip {
  title: string | ReactNode;
  hoverText?: string;
  prompt: string;
}

export interface PromptChips {
  promptChipList: PromptChip[];
  alwaysShow?: boolean;
}

export interface PromptChipStyles {
  promptChipContainerStyle?: React.CSSProperties | string;
  promptChipTitleStyle?: React.CSSProperties | string;
  promptChipHoverTextStyle?: React.CSSProperties | string;
}

export interface SkeletonStyles {
  containerStyle?: React.CSSProperties | string;
  headerStyle?: React.CSSProperties | string;
  messageStyle?: React.CSSProperties | string;
  inputStyle?: React.CSSProperties | string;
}

export interface ChatManagerComponentStyles {
  skeletonStyles?: SkeletonStyles;
  messageStyle?: MessageStyles;
  inputSectionStyle?: InputStyles;
  headerStyle?: HeaderStyles;
  promptChipStyles?: PromptChipStyles;
  scrollButtonStyles?: {
    icon?: ReactNode;
    iconStyles?: React.CSSProperties | string;
  };
  backgroundStyle?: React.CSSProperties | string;
}

/**
 * Core configuration properties for the ChatManager component.
 */
export type ChatManagerBaseProps = { 
  /** Theme to apply to the ChatManager. */
  theme?: ChatTheme;
  /** Additional CSS class names. */
  className?: string;
  /** Inline styles for the root container. */
  style?: React.CSSProperties;
  /** Advanced custom styling for internal components. */
  chatManagerComponentStyles?: ChatManagerComponentStyles;
  /** Allowed types of attachments the user can upload. */
  inputTypeList?: Array<'image' | 'audio' | 'video' | 'document'>;
  /** Position of the component. */
  position?: ComponentPosition;
  /** Where to place the collapse toggle button. */
  collapseToggleButtonPosition?: ToggleButtonPosition;
  /** Customization options for the toggle button. */
  toggleButtonProps?: {
    toggleButtonStyle?: React.CSSProperties | string;
    toggleButtonIconProps?: {
      toggleButtonIcon?: React.ReactNode;
      toggleButtonIconStyle?: React.CSSProperties | string;
    };
    toggleButtonLabelProps?: {
      toggleButtonLabel?: string | React.ReactNode;
      toggleButtonLabelStyle?: React.CSSProperties | string;
    };
  };
  /** Whether the chat is open by default on mount. */
  defaultOpen?: boolean;
  /** If true, the chat automatically scrolls to the bottom on new messages. */
  autoScroll?: boolean;
  /** Props forwarded to the native input element. */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Optional welcome screen rendered when the chat is empty. */
  welcomeScreen?: SlotValue<React.FC<WelcomeScreenProps>> | boolean;
  /** Localization and override labels for UI text. */
  labels?: Partial<ChatLabels>;
  /** Suggested prompts to display to the user. */
  promptChips?: PromptChips;
  /** The active agent's ID. */
  agentId?: string;
  /** The active session ID. */
  sessionId?: string;
  /** Position for the detached A2UI canvas (used when layout is 'split'). */
  a2uiPosition?: ComponentPosition; 
  /** Whether the split A2UI canvas is collapsible. */
  collapsibleA2UI?: boolean; 
  /** Maximum character limit for the user input. */
  maxInputCharacter?: number;
  /** Whether the chat backend streams responses. */
  streaming?: boolean;
  /** Whether to display tool calls in the message list. */
  showToolCalls?: boolean;
  /** Whether to display model reasoning steps in the message list. */
  showReasoning?: boolean;
  /** Whether to send the full message history on each request. */
  sendHistory?: boolean;
};

/**
 * Complete properties for the ChatManager component, which combines base properties
 * with display mode specific options.
 */
export type ChatManagerProps = ChatManagerBaseProps & (
  | { display: 'floating'; displayOptions?: never }
  | { display?: 'embedded'; displayOptions?: { collapsible?: boolean; isResizable?: boolean } }
);

export interface SessionListStyles {
  containerStyle?: React.CSSProperties | string;
  textStyle?: React.CSSProperties | string;
  timeStyle?: React.CSSProperties | string;
  listItemIconStyles?: {
    icon?: ReactNode;
    iconStyle?: React.CSSProperties | string;
  };
  listItemPinButtonStyles?: {
    icon?: ReactNode;
    iconStyles?: React.CSSProperties | string;
  };
  listItemMenuButtonStyles?: {
    icon?: ReactNode;
    iconStyle?: React.CSSProperties | string;
  };
  listItemRenameButtonStyles?: {
    containerStyle: React.CSSProperties | string;
    icon?: ReactNode;
    iconStyle?: React.CSSProperties | string;
    text?: ReactNode;
    textStyle?: React.CSSProperties | string;
  };
  listItemDeleteButtonStyles?: {
    containerStyle: React.CSSProperties | string;
    icon?: ReactNode;
    iconStyle?: React.CSSProperties | string;
    text?: ReactNode;
    textStyle?: React.CSSProperties | string;
  };
}

export interface NewConversationButtonStyles {
  newConversationButtonStyle?: React.CSSProperties | string;
  newConversationButtonIconStyle?: React.CSSProperties | string;
  newConversationButtonTextStyle?: React.CSSProperties | string;
}

export interface SessionManagerComponentStyles {
  titleStyle?: React.CSSProperties | string;
  listStyle?: SessionListStyles;
  newConversationButtonStyles?: NewConversationButtonStyles;
}

/**
 * Properties for configuring the SessionManager component.
 */
export interface SessionManagerProps {
  /** Interval in milliseconds to sync sessions from the API. */
  syncInterval?: number;
  /** Main title for the session manager. */
  label?: string;
  /** Label for the 'Recent' section. */
  recentLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  /** The position of the drawer or inline sidebar. */
  position?: ComponentPosition; 
  /** 
   * If true or 'sheet', acts as a slide-out drawer. 
   * If 'inline', acts as a collapsible sidebar. 
   * If false, acts as a static container.
   */
  collapsible?: boolean | 'inline' | 'sheet'; 
  /** Callback fired when a session is selected. */
  onSessionSelect?: (sessionId: string) => void;
  /** Callback fired when creating a new session. */
  onNewSession?: () => void;
  /** Advanced custom styling for internal components. */
  sessionManagerComponentStyles?: SessionManagerComponentStyles;
}

type OmniChatBaseProps = {
  theme?: ChatTheme;
  apiEndpoint?: string;
  chatManagerProps?: Omit<Partial<ChatManagerProps>, 'theme' | 'layout'>;
  sessionStorageMode?: StorageMode;
  sessionRoute?: string;
  children?: ReactNode;
} & (
  | { useA2UI?: true; a2uiProps: A2UIProps }
  | { useA2UI: false; a2uiProps?: never }
);

/**
 * Props for `<OmniChat />`. The `chatApiSchema` prop is only accepted (and only
 * meaningful) when `api_mode` is `'classic'`.
 */
export type OmniChatProps = OmniChatBaseProps & (
  | {
      api_mode: 'classic';
      /**
       * Maps OmniChatKit's internal message structure to your backend API's
       * request/response shape. Provide `apiRequestSchema` to customize how
       * messages are serialized before being sent, and `apiResponseSchema` to
       * customize how the raw API response is parsed back into messages.
       */
      chatApiSchema?: ApiSchema;
    }
  | { api_mode: 'ag-ui'; chatApiSchema?: never }
);

/**
 * Properties for configuring the Agentic UI (A2UI) system.
 */
export interface A2UIProps {
  /** The current agent's identifier. */
  agentId: string;
  /** The name of the tool call used by the LLM to trigger a component render. */
  a2uiToolName: string;
  /** A2UI version compatibility flag. */
  a2uiVersion?: 'V0.8' | 'V0.9' | 'V0.9.1' | 'V1.0';
  /** Whether to inject the basic fallback catalog components. */
  includeBasicCatalog?: boolean;
  /** Whether to inject pre-built custom components. */
  includePreBuiltCustomComponents?: boolean;
  /** Internal layout representation. */
  layout?: A2UILayout;
  /** The mapping of component names to React implementations. */
  catalog?: A2UICatalog;
  /** Controls where the A2UI should render (inline in chat or detached). */
  a2uiRenderingOption?: 'chat' | 'detached';
}

export interface A2UICanvasProps {
  emptyState?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * State representing a Human-in-the-loop (HITL) interruption.
 */
export interface HITLState {
  /** True if the chat is currently blocked waiting for human approval. */
  isActive: boolean;
  /** The pending action/payload that needs review. */
  pendingAction: any | null;
  /** Callback to approve the action. An optional modified payload can be provided. */
  approve: (modifiedPayload?: any) => void;
  /** Callback to reject the action with an optional reason. */
  reject: (reason?: string) => void;
}

/**
 * State representing active tool/streaming executions that can be interrupted.
 */
export interface InterruptState {
  /** True if the AI is currently streaming a text response. */
  isStreaming: boolean;
  /** True if the AI is currently executing a backend tool call. */
  isExecutingTool: boolean;
  /** Cancels the ongoing text stream. */
  haltStream: () => void;
  /** Cancels the ongoing tool execution. */
  cancelTool: () => void;
}
