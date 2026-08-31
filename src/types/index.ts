import { ReactNode } from 'react';
import type { Message as AiMessage, CreateMessage } from 'ai';

export type ChatTheme = 'standard' | 'dark' | 'light';
export type StorageMode = 'memory' | 'api';
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

export interface AIChatProviderProps {
  children: ReactNode;
  theme?: ChatTheme;
  apiEndpoint?: string; // Route for Vercel AI SDK useChat
  agentId?: string;
  sessionId?: string;
  sessionStorageMode?: StorageMode;
  sessionRoute?: string;
}

export type ToggleButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface MessageStyles {
  assistantMessageStyle?: React.CSSProperties | string;
  userMessageStyle?: React.CSSProperties | string;
  thinkingStepStyle?: React.CSSProperties | string;
  backgroundStyle?: React.CSSProperties | string;
}

export interface InputStyles {
  inputStyle?: React.CSSProperties | string;
  buttonStyle?: React.CSSProperties | string;
  containerStyle?: React.CSSProperties | string;
  backgroundStyle?: React.CSSProperties | string;
}

export interface ChatManagerComponentStyles {
  messageStyle?: MessageStyles;
  inputSectionStyle?: InputStyles;
  headerStyle?: HeaderStyles;
  backgroundStyle?: React.CSSProperties | string;
}

export type ChatManagerBaseProps = {
  theme?: ChatTheme;
  layout?: A2UILayout;
  className?: string;
  style?: React.CSSProperties;
  chatManagerComponentStyles?: ChatManagerComponentStyles;
  position?: ComponentPosition;
  collapseToggleButtonPosition?: ToggleButtonPosition;
  toggleButtonStyle?: React.CSSProperties | string;
  defaultOpen?: boolean;
  autoScroll?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  welcomeScreen?: SlotValue<React.FC<WelcomeScreenProps>> | boolean;
  labels?: Partial<ChatLabels>;
  agentId?: string;
  sessionId?: string;
  a2uiPosition?: ComponentPosition; // Used when layout is 'split'
  collapsibleA2UI?: boolean; // Used when layout is 'split'
};

export type ChatManagerProps = ChatManagerBaseProps & (
  | { display: 'floating'; collapsible?: never; isResizable?: never }
  | { display?: 'embedded'; collapsible?: boolean; isResizable?: boolean }
) & (
  | { useA2UI?: true; a2uiToolName: string }
  | { useA2UI: false; a2uiToolName?: string }
);

export interface SessionListStyles {
  itemStyle?: React.CSSProperties | string;
  textStyle?: React.CSSProperties | string;
  deleteButtonStyle?: React.CSSProperties | string;
  deleteIconStyle?: React.CSSProperties | string;
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

export interface A2UIProps {
  catalog?: A2UICatalog;
  a2uiRenderingOption: 'chat' | 'detached';
  a2uiToolName: string;
  a2uiVersion?: 'V0.8' | 'V0.9' | 'V0.9.1' | 'V1.0';
  includeBasicCatalog?: boolean;
}

export type OmniChatProps = {
  api_mode: 'ag-ui' | 'classic';
  theme?: ChatTheme;
  apiEndpoint?: string;
  chatManagerProps?: Omit<Partial<ChatManagerProps>, 'theme' | 'useA2UI' | 'layout' | 'a2uiToolName'>;
  sessionStorageMode?: StorageMode;
  sessionRoute?: string;
  children?: ReactNode;
} & (
  | { useA2UI?: true; a2uiProps: A2UIProps }
  | { useA2UI: false; a2uiProps?: never }
);

export interface A2UICanvasProps {
  layout: A2UILayout;
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
