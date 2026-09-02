import { ReactNode } from 'react';
import type { Message as AiMessage, CreateMessage } from 'ai';

export type ChatTheme = 'standard' | 'dark' | 'light';
export type StorageMode = 'disabled' | 'memory' | 'api';
export type A2UILayout = 'inline' | 'split';
export type ComponentPosition = 'left' | 'right' | 'top' | 'bottom';
export type DisplayMode = 'embedded' | 'floating';

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

// Extend Vercel AI SDK Message with our own properties if needed
export interface Message extends AiMessage {
  componentPayload?: {
    name: string;
    props: Record<string, any>;
  };
  hitlRequired?: boolean;
}

export interface AIChatServerOptions {
  apiKey: string;
  endpoint?: string;
  headers?: Record<string, string>;
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

export interface AIChatProviderProps {
  children: ReactNode;
  theme?: ChatTheme;
  apiEndpoint?: string; // Route for Vercel AI SDK useChat
  agentId?: string;
  sessionId?: string;
  sessionStorageMode?: StorageMode;
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
  thinkingStepStyles?: ThinkingStepStyles;
  toolCallStepStyles?: ToolCallStepStyles;
  stopResponseStyle?: React.CSSProperties | string;
  backgroundStyle?: React.CSSProperties | string;
}

export interface InputStyles {
  inputStyle?: React.CSSProperties | string;
  buttonStyle?: React.CSSProperties | string;
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

export interface ChatManagerComponentStyles {
  messageStyle?: MessageStyles;
  inputSectionStyle?: InputStyles;
  headerStyle?: HeaderStyles;
  promptChipStyles?: PromptChipStyles;
  backgroundStyle?: React.CSSProperties | string;
}

export type ChatManagerBaseProps = {
  theme?: ChatTheme;
  className?: string;
  style?: React.CSSProperties;
  chatManagerComponentStyles?: ChatManagerComponentStyles;
  position?: ComponentPosition;
  collapseToggleButtonPosition?: ToggleButtonPosition;
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
  defaultOpen?: boolean;
  autoScroll?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  welcomeScreen?: SlotValue<React.FC<WelcomeScreenProps>> | boolean;
  labels?: Partial<ChatLabels>;
  promptChips?: PromptChips;
  agentId?: string;
  sessionId?: string;
  a2uiPosition?: ComponentPosition; // Used when layout is 'split'
  collapsibleA2UI?: boolean; // Used when layout is 'split'
  maxInputCharacter?: number;
  streaming?: boolean;
};

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

export interface SessionManagerProps {
  syncInterval?: number;
  label?: string;
  recentLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  position?: ComponentPosition; // The position of the drawer or inline sidebar
  collapsible?: boolean | 'inline' | 'sheet'; // If true or 'sheet', acts as a slide-out drawer. If 'inline', acts as a collapsible sidebar. If false, acts as a static container.
  onSessionSelect?: (sessionId: string) => void;
  onNewSession?: () => void;
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

export interface A2UIProps {
  agentId: string;
  a2uiToolName: string;
  a2uiVersion?: 'V0.8' | 'V0.9' | 'V0.9.1' | 'V1.0';
  includeBasicCatalog?: boolean;
  includePreBuiltCustomComponents?: boolean;
  layout?: A2UILayout;
  catalog?: A2UICatalog;
  a2uiRenderingOption?: 'chat' | 'detached';
}

export interface A2UICanvasProps {
  emptyState?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export interface HITLState {
  isActive: boolean;
  pendingAction: any | null;
  approve: (modifiedPayload?: any) => void;
  reject: (reason?: string) => void;
}

export interface InterruptState {
  isStreaming: boolean;
  isExecutingTool: boolean;
  haltStream: () => void;
  cancelTool: () => void;
}
