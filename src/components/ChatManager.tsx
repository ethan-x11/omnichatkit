"use client"
import React, { useState } from 'react';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';
import { ChatManagerProps } from '../types';
import { A2UICanvas } from './A2UICanvas';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from './ui/sheet';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from './ui/dialog';
import { MessageCircle, PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp, Copy, Check, Square, Brain, Wrench, Activity, AlertCircle, PlayCircle, CheckCircle2, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';

const renderBadge = (
  text: string | React.ReactNode,
  styleProp?: any,
  defaultContainerClass?: string,
  defaultTextClass?: string,
  defaultIcon?: React.ReactNode
) => {
  if (!text) return null;
  const isString = typeof styleProp === 'string';
  const isObj = typeof styleProp === 'object' && styleProp !== null;

  const containerClass = cn(
    defaultContainerClass,
    isString ? styleProp : (isObj && typeof styleProp.containerStyle === 'string' ? styleProp.containerStyle : undefined)
  );
  const containerStyle = isObj && typeof styleProp.containerStyle === 'object' ? styleProp.containerStyle : undefined;

  const textClass = cn(
    defaultTextClass,
    isObj && typeof styleProp.textStyle === 'string' ? styleProp.textStyle : undefined
  );
  const textStyle = isObj && typeof styleProp.textStyle === 'object' ? styleProp.textStyle : undefined;

  const icon = isObj && styleProp.icon !== undefined ? styleProp.icon : defaultIcon;

  return (
    <span className={containerClass} style={containerStyle}>
      {icon}
      <span className={textClass} style={textStyle}>{text}</span>
    </span>
  );
};

/**
 * Inline status pill shown in the message list when an A2UI tool call is detected.
 * The actual rendered surface lives in the pinned A2UICanvas pane below the feed.
 */
function A2UIToolPill({
  tool,
}: {
  tool: any;
  agentId?: string;
}) {
  const isComplete = !!tool.result;
  return (
    <div
      className="my-1 inline-flex items-center gap-2 max-w-fit px-3 py-2 rounded-full border border-border bg-muted/40 text-xs font-medium text-muted-foreground"
    >
      {isComplete ? (
        <svg className="w-3 h-3 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
      )}
      <span className="uppercase tracking-widest text-[10px]">surface</span>
      <span className="opacity-40">→</span>
      <span>{isComplete ? 'rendered in canvas' : 'generating…'}</span>
    </div>
  );
}

export function ChatManager({
  theme,
  className,
  style,
  chatManagerComponentStyles = {},
  position = 'right',
  display,
  collapsible = false,
  isResizable = false,
  collapseToggleButtonPosition = 'bottom-right',
  toggleButtonProps,
  defaultOpen = false,
  autoScroll = true,
  inputProps = {},
  welcomeScreen = true,
  labels = {},
  promptChips,
  agentId,
  a2uiPosition = 'left',
  collapsibleA2UI = false,
  maxInputCharacter,
  streaming
}: ChatManagerProps) {
  const {
    messageStyle = {},
    inputSectionStyle = {},
    headerStyle = {},
    backgroundStyle: globalBackgroundStyle
  } = chatManagerComponentStyles;

  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;

  if (!context) {
    throw new Error('ChatManager must be used within either an AIChatProvider or an AGUIChatProvider');
  }

  const { messages, input, handleInputChange, handleSubmit, status } = context;
  const events = (context as any).events || [];
  const { activeSessionId, sessionStorageMode, updateSessionMessages } = useAIChatStore();
  const sessionsEnabled = sessionStorageMode !== 'disabled';

  const activeSessionIdRef = React.useRef(activeSessionId);

  React.useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  React.useEffect(() => {
    if (sessionsEnabled && activeSessionIdRef.current && context?.messages) {
      const session = useAIChatStore.getState().sessions.find(s => s.id === activeSessionIdRef.current);
      const hasExistingMessages = session?.messages && session.messages.length > 0;

      if (context.messages.length === 0 && hasExistingMessages) {
        // Prevent wiping out existing session messages with an empty array on mount or during transitions
        return;
      }
      void updateSessionMessages(activeSessionIdRef.current, context.messages).catch((error) => {
        console.error('Failed to save session messages:', error);
      });
    }
  }, [activeSessionId, context?.messages, sessionsEnabled, updateSessionMessages]);
  const isLoading = status === 'submitted' || status === 'streaming';
  const globalTheme = useAIChatStore((state) => state.theme);
  const a2uiToolName = useAIChatStore((state) => state.a2uiProps?.a2uiToolName);
  // Whether A2UI canvas is active for this manager instance
  const hasA2UI = !!a2uiToolName;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isA2UIOpen, setIsA2UIOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customDimension, setCustomDimension] = useState(450);

  const messageToAgentMap = React.useMemo(() => {
    const map = new Map<string, string>();
    let activeAgent: string | null = null;
    if (events) {
      events.forEach((e: any) => {
        if (e.type === 'STEP_STARTED' || e.type === 'StepStarted') {
          activeAgent = e.stepName;
        }
        if (activeAgent) {
          if ((e.type === 'TEXT_MESSAGE_START' || e.type === 'TextMessageStart') && e.messageId) {
            map.set(e.messageId, activeAgent);
          }
          if ((e.type === 'TOOL_CALL_START' || e.type === 'ToolCallStart') && e.toolCallId) {
            map.set(e.toolCallId, activeAgent);
          }
        }
      });
    }
    return map;
  }, [events]);

  const startResizing = (e: React.MouseEvent, dimension: 'width' | 'height') => {
    e.preventDefault();
    const isWidth = dimension === 'width';
    const startPos = isWidth ? e.clientX : e.clientY;
    const startDim = customDimension;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = isWidth ? moveEvent.clientX - startPos : moveEvent.clientY - startPos;
      let newDim = startDim;
      if (position === 'right') newDim = startDim - delta;
      else if (position === 'left') newDim = startDim + delta;
      else if (position === 'bottom') newDim = startDim - delta;
      else if (position === 'top') newDim = startDim + delta;

      if (newDim < 250) newDim = 250;
      if (newDim > Math.max(800, window.innerWidth * 0.8)) newDim = Math.max(800, window.innerWidth * 0.8);
      setCustomDimension(newDim);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resolvedTheme = theme || globalTheme;
  const isAgUI = resolvedTheme === 'standard';

  const isFloating = display === 'floating';
  const isEmbedded = display === 'embedded';
  const isSheet = !isFloating && !isEmbedded && collapsible;
  const isEmbeddedCollapsible = isEmbedded && collapsible;

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleFormSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    const options = streaming !== undefined ? { body: { streaming } } : undefined;
    handleSubmit(e, options);
  };

  const handleChipClick = async (prompt: string) => {
    if (!prompt.trim() || !context?.append) return;

    try {
      const options = streaming !== undefined ? { body: { streaming } } : undefined;
      await context.append({ role: 'user', content: prompt }, options);
    } catch (error) {
      console.error('Failed to send the prompt chip:', error);
    }
  };

  const getTogglePositionStyle = (pos?: string): React.CSSProperties => {
    switch (pos) {
      case 'top-left': return { top: '1.5rem', left: '1.5rem' };
      case 'top-right': return { top: '1.5rem', right: '1.5rem' };
      case 'bottom-left': return { bottom: '1.5rem', left: '1.5rem' };
      case 'bottom-right':
      default: return { bottom: '1.5rem', right: '1.5rem' };
    }
  };

  const chatContainerClass = isAgUI
    ? 'bg-zinc-950 text-zinc-50 border-zinc-800 shadow-2xl'
    : 'bg-background text-foreground border-border shadow-sm';

  const CollapseIcon = position === 'right' ? PanelRightClose :
    position === 'left' ? PanelLeftClose :
      position === 'top' ? ChevronUp : ChevronDown;

  const A2UICollapseIcon = a2uiPosition === 'right' ? PanelRightClose :
    a2uiPosition === 'left' ? PanelLeftClose :
      a2uiPosition === 'top' ? ChevronUp : ChevronDown;

  let sizeClass = 'h-full w-full';
  let embeddedStyle: React.CSSProperties = {};

  if (isEmbedded || (!isSheet && !isFloating)) {
    if (position === 'left' || position === 'right') {
      embeddedStyle = { maxWidth: isResizable ? `${customDimension}px` : '450px' };
      sizeClass += position === 'right' ? ' ml-auto' : ' mr-auto';
    } else if (position === 'top' || position === 'bottom') {
      embeddedStyle = { maxHeight: isResizable ? `${customDimension}px` : '450px' };
      sizeClass += position === 'bottom' ? ' mt-auto' : ' mb-auto';
    } else {
      embeddedStyle = { minHeight: '600px', height: '800px' };
    }
  }

  const combinedStyle = { ...embeddedStyle, ...style };

  const resizeHandle = isEmbedded && isResizable ? (
    <div
      className={cn(
        "absolute z-10 hover:bg-foreground/10 transition-colors",
        position === 'right' ? "left-0 top-0 bottom-0 w-1.5 cursor-ew-resize" :
          position === 'left' ? "right-0 top-0 bottom-0 w-1.5 cursor-ew-resize" :
            position === 'bottom' ? "top-0 left-0 right-0 h-1.5 cursor-ns-resize" :
              position === 'top' ? "bottom-0 left-0 right-0 h-1.5 cursor-ns-resize" : ""
      )}
      onMouseDown={(e) => startResizing(e, position === 'left' || position === 'right' ? 'width' : 'height')}
    />
  ) : null;

  const innerContent = (
    <div
      className={cn(`flex border rounded-xl flex-col relative ${chatContainerClass} ${sizeClass}`, typeof globalBackgroundStyle === 'string' ? globalBackgroundStyle : "", className)}
      style={{ ...(typeof globalBackgroundStyle === 'object' ? globalBackgroundStyle : {}), ...combinedStyle }}
    >
      {resizeHandle}
      {(isSheet || isFloating || isEmbedded) && (
        <div
          className={cn("p-4 border-b flex flex-row items-center justify-between shrink-0", typeof headerStyle.backgroundStyle === 'string' ? headerStyle.backgroundStyle : "")}
          style={typeof headerStyle.backgroundStyle === 'object' ? headerStyle.backgroundStyle : undefined}
        >
          {(isSheet || isEmbeddedCollapsible) && (position === 'right' || position === 'bottom') && (
            isSheet ? (
              <SheetClose render={<Button variant="ghost" size="icon-sm" className={cn("h-8 w-8", typeof headerStyle.collapseButtonStyle === 'string' ? headerStyle.collapseButtonStyle : "")} style={typeof headerStyle.collapseButtonStyle === 'object' ? headerStyle.collapseButtonStyle : undefined} suppressHydrationWarning={true}><CollapseIcon size={16} /></Button>} />
            ) : (
              <Button variant="ghost" size="icon-sm" className={cn("h-8 w-8", typeof headerStyle.collapseButtonStyle === 'string' ? headerStyle.collapseButtonStyle : "")} style={typeof headerStyle.collapseButtonStyle === 'object' ? headerStyle.collapseButtonStyle : undefined} onClick={() => setIsOpen(false)} suppressHydrationWarning={true}><CollapseIcon size={16} /></Button>
            )
          )}
          <div className="flex-1 flex flex-col">
            {isSheet ? (
              <SheetTitle
                className={typeof headerStyle.titleStyle === 'string' ? headerStyle.titleStyle : typeof labels.labelStyles?.titleStyle === 'string' ? labels.labelStyles.titleStyle : ""}
                style={typeof headerStyle.titleStyle === 'object' ? headerStyle.titleStyle : typeof labels.labelStyles?.titleStyle === 'object' ? labels.labelStyles.titleStyle : undefined}
              >
                {labels.title || 'AI Chat'}
              </SheetTitle>
            ) : isFloating ? (
              <DialogTitle
                className={typeof headerStyle.titleStyle === 'string' ? headerStyle.titleStyle : typeof labels.labelStyles?.titleStyle === 'string' ? labels.labelStyles.titleStyle : ""}
                style={typeof headerStyle.titleStyle === 'object' ? headerStyle.titleStyle : typeof labels.labelStyles?.titleStyle === 'object' ? labels.labelStyles.titleStyle : undefined}
              >
                {labels.title || 'AI Chat'}
              </DialogTitle>
            ) : (
              <h2
                className={cn("font-heading text-base font-medium text-foreground", typeof headerStyle.titleStyle === 'string' ? headerStyle.titleStyle : typeof labels.labelStyles?.titleStyle === 'string' ? labels.labelStyles.titleStyle : "")}
                style={typeof headerStyle.titleStyle === 'object' ? headerStyle.titleStyle : typeof labels.labelStyles?.titleStyle === 'object' ? labels.labelStyles.titleStyle : undefined}
              >
                {labels.title || 'AI Chat'}
              </h2>
            )}
            {labels.subtitle && (
              <span
                className={cn("text-xs text-muted-foreground", typeof headerStyle.subtitleStyle === 'string' ? headerStyle.subtitleStyle : typeof labels.labelStyles?.subtitleStyle === 'string' ? labels.labelStyles.subtitleStyle : "")}
                style={typeof headerStyle.subtitleStyle === 'object' ? headerStyle.subtitleStyle : typeof labels.labelStyles?.subtitleStyle === 'object' ? labels.labelStyles.subtitleStyle : undefined}
              >
                {labels.subtitle}
              </span>
            )}
          </div>
          {(isSheet || isEmbeddedCollapsible) && (position === 'left' || position === 'top') && (
            isSheet ? (
              <SheetClose render={<Button variant="ghost" size="icon-sm" className={cn("h-8 w-8", typeof headerStyle.collapseButtonStyle === 'string' ? headerStyle.collapseButtonStyle : "")} style={typeof headerStyle.collapseButtonStyle === 'object' ? headerStyle.collapseButtonStyle : undefined} suppressHydrationWarning={true}><CollapseIcon size={16} /></Button>} />
            ) : (
              <Button variant="ghost" size="icon-sm" className={cn("h-8 w-8", typeof headerStyle.collapseButtonStyle === 'string' ? headerStyle.collapseButtonStyle : "")} style={typeof headerStyle.collapseButtonStyle === 'object' ? headerStyle.collapseButtonStyle : undefined} onClick={() => setIsOpen(false)} suppressHydrationWarning={true}><CollapseIcon size={16} /></Button>
            )
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Primary Chat Feed */}
        <div className={`flex flex-col flex-1 h-full min-w-0`}>
          <div
            className={cn("flex-1 overflow-y-auto [scrollbar-gutter:stable] p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600", typeof messageStyle.backgroundStyle === 'string' ? messageStyle.backgroundStyle : "")}
            style={typeof messageStyle.backgroundStyle === 'object' ? messageStyle.backgroundStyle : undefined}
          >
            {messages.length === 0 && welcomeScreen && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                {typeof welcomeScreen === 'boolean' ? (
                  <div className="flex flex-col items-center gap-2">
                    <MessageCircle size={48} className="opacity-20" />
                    <h3 className="text-lg font-medium text-foreground">Welcome to OmniChat</h3>
                    <p>Start a conversation below to get help or generate dynamic UI components.</p>
                  </div>
                ) : React.isValidElement(welcomeScreen) ? (
                  welcomeScreen
                ) : typeof welcomeScreen === 'function' ? (
                  React.createElement(welcomeScreen as React.FC<any>)
                ) : (
                  welcomeScreen as React.ReactNode
                )}
              </div>
            )}
            {messages.map((msg) => {
              // Prefer parts (new API) over toolInvocations (deprecated). Fall back for AG-UI
              // messages that are not Vercel AI SDK messages and won't have parts.
              const toolParts = (msg.parts ?? []).filter((p: any) => p.type === 'tool-invocation');
              const toolInvocations: any[] = toolParts.length > 0
                ? toolParts.map((p: any) => p.toolInvocation)
                : ((msg as any).toolInvocations ?? []);
              const hasTool = toolInvocations.length > 0;

              if ((msg.role as string) === 'reasoning') {
                return (
                  <details key={msg.id} className="mb-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-3 text-sm border border-zinc-200 dark:border-zinc-800 group">
                    <summary className="flex items-center gap-2 text-zinc-500 font-medium cursor-pointer select-none list-none marker:hidden">
                      <Brain size={14} className="animate-pulse" />
                      <span>Reasoning</span>
                      <ChevronDown size={14} className="ml-auto transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap mt-3 border-t border-zinc-200 dark:border-zinc-700 pt-2">{msg.content}</div>
                  </details>
                );
              }

              if ((msg.role as string) === 'activity') {
                return (
                  <div key={msg.id} className="mb-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm border border-blue-100 dark:border-blue-900">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1 font-medium">
                      <Activity size={14} />
                      <span>Activity Update</span>
                    </div>
                    <div className="text-zinc-700 dark:text-zinc-300 font-mono text-xs overflow-x-auto">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              if ((msg.role as string) === 'tool') {
                return (
                  <div key={msg.id} className="mb-4 bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-sm border border-green-100 dark:border-green-900">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1 font-medium">
                      <CheckCircle2 size={14} />
                      <span>Tool Result</span>
                    </div>
                    <div className="text-zinc-700 dark:text-zinc-300 font-mono text-xs overflow-x-auto">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              if ((msg.role as string) === 'system') {
                if (msg.content === 'Response Stopped') {
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "mb-4 flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400",
                        typeof messageStyle.stopResponseStyle === 'string' ? messageStyle.stopResponseStyle : ""
                      )}
                      style={typeof messageStyle.stopResponseStyle === 'object' ? messageStyle.stopResponseStyle : undefined}
                    >
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                      <span className="shrink-0 font-medium">Response Stopped</span>
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="mb-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-lg p-3 text-sm border border-zinc-200 dark:border-zinc-800">
                    <div className="text-zinc-600 dark:text-zinc-400">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const isUser = msg.role === 'user';
              const customStyleRaw = isUser ? messageStyle.userMessageStyles : messageStyle.assistantMessageStyles;

              let containerStyleClass = '';
              let containerStyleObj: React.CSSProperties | undefined = undefined;
              let bubbleStyleClass = '';
              let bubbleStyleObj: React.CSSProperties | undefined = undefined;
              let alignment: 'left' | 'right' | 'center' | undefined = undefined;
              let badgeStyleRaw: any = undefined;
              let subAgentBadgeStyleRaw: any = undefined;

              if (typeof customStyleRaw === 'string') {
                containerStyleClass = customStyleRaw;
              } else if (typeof customStyleRaw === 'object' && customStyleRaw !== null) {
                if ('containerStyle' in customStyleRaw || 'bubbleStyle' in customStyleRaw || 'alignment' in customStyleRaw || 'badgeStyle' in customStyleRaw || 'subAgentBadgeStyle' in customStyleRaw) {
                  const styleDef = customStyleRaw as any;
                  containerStyleClass = typeof styleDef.containerStyle === 'string' ? styleDef.containerStyle : '';
                  containerStyleObj = typeof styleDef.containerStyle === 'object' ? styleDef.containerStyle : undefined;

                  bubbleStyleClass = typeof styleDef.bubbleStyle === 'string' ? styleDef.bubbleStyle : '';
                  bubbleStyleObj = typeof styleDef.bubbleStyle === 'object' ? styleDef.bubbleStyle : undefined;

                  alignment = styleDef.alignment;
                  badgeStyleRaw = styleDef.badgeStyle;
                  subAgentBadgeStyleRaw = styleDef.subAgentBadgeStyle;
                } else {
                  containerStyleObj = customStyleRaw as React.CSSProperties;
                }
              }

              if (isUser) {
                if (!bubbleStyleClass && !bubbleStyleObj) {
                  bubbleStyleClass = "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-foreground shadow-sm dark:shadow-zinc-700/50 rounded-2xl px-4 py-2";
                }
                if (!alignment) alignment = 'right';
              } else {
                if (!alignment) alignment = 'left';
              }

              const alignmentClass = alignment === 'left' ? 'flex flex-col items-start' : (alignment === 'right' ? 'flex flex-col items-end' : 'flex flex-col items-center text-left whitespace-normal');

              let thinkingContent = '';
              let mainContent = msg.content || '';

              if (!isUser && typeof mainContent === 'string') {
                const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|<think\/>)/i;
                const match = mainContent.match(thinkRegex);
                if (match) {
                  thinkingContent = match[1].trim();
                  mainContent = mainContent.replace(match[0], '').trim();
                } else {
                  if (mainContent.includes('<think>')) {
                    const parts = mainContent.split('<think>');
                    mainContent = parts[0].trim();
                    thinkingContent = parts[1].trim();
                  } else if (mainContent.includes('</think>') || mainContent.includes('<think/>')) {
                    const closeTag = mainContent.includes('</think>') ? '</think>' : '<think/>';
                    const parts = mainContent.split(closeTag);
                    thinkingContent = parts[0].replace(/<think>/i, '').trim();
                    mainContent = parts.slice(1).join(closeTag).trim();
                  }
                }
              }

              return (
                <div key={msg.id} className={cn("mb-4 group relative w-full", alignment === 'left' ? 'pr-8' : alignment === 'right' ? 'pl-8' : 'px-8', alignmentClass, containerStyleClass)} style={containerStyleObj}>
                  {(mainContent || thinkingContent || (!thinkingContent && !hasTool)) && (
                    <div className="font-bold mb-2 flex items-center gap-2 min-w-0 max-w-full">
                      {isUser ? (
                        renderBadge(labels.userLabel ?? 'You', badgeStyleRaw, "flex items-center gap-1", "", <User size={14} />)
                      ) : (
                        <>
                          {renderBadge(labels.assistantLabel ?? 'AI', badgeStyleRaw, "flex items-center gap-1", "", <Bot size={14} />)}
                          {messageToAgentMap.get(msg.id) && renderBadge(
                            messageToAgentMap.get(msg.id) as string,
                            subAgentBadgeStyleRaw,
                            "px-2 py-0.5 text-xs font-medium bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center gap-1",
                            "text-zinc-700 dark:text-zinc-300",
                            <Bot size={12} />
                          )}
                        </>
                      )}

                    </div>
                  )}

                  {thinkingContent && (() => {
                    const tStyles = messageStyle.thinkingStepStyles || {};
                    const thContainerStyle = tStyles.containerStyle;
                    const thIconStyles = tStyles.iconStyles || {};
                    const thTitleStyle = tStyles.titleStyle;
                    const thDataStyle = tStyles.dataStyle;

                    return (
                      <details 
                        className={cn("mb-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-3 text-sm border border-zinc-200 dark:border-zinc-800 group/think", typeof thContainerStyle === 'string' ? thContainerStyle : "")}
                        style={typeof thContainerStyle === 'object' ? thContainerStyle : {}}
                      >
                        <summary className="flex items-center gap-2 text-zinc-500 font-medium cursor-pointer select-none list-none marker:hidden">
                          <span 
                            className={cn(typeof thIconStyles.iconStyle === 'string' ? thIconStyles.iconStyle : "")}
                            style={typeof thIconStyles.iconStyle === 'object' ? thIconStyles.iconStyle : {}}
                          >
                            {thIconStyles.icon || <Brain size={14} className="animate-pulse" />}
                          </span>
                          <span
                            className={typeof thTitleStyle === 'string' ? thTitleStyle : ""}
                            style={typeof thTitleStyle === 'object' ? thTitleStyle : {}}
                          >
                            Reasoning
                          </span>
                          <ChevronDown size={14} className="ml-auto transition-transform group-open/think:rotate-180" />
                        </summary>
                        <div 
                          className={cn("mt-3 border-t border-zinc-200 dark:border-zinc-700 pt-4", typeof thDataStyle === 'string' ? thDataStyle : "")}
                          style={typeof thDataStyle === 'object' ? thDataStyle : {}}
                        >
                          <MarkdownRenderer text={thinkingContent} className="text-zinc-600 dark:text-zinc-400" />
                        </div>
                      </details>
                    );
                  })()}


                  {(mainContent || (!thinkingContent && !hasTool)) ? (
                    <div className="mt-1 flex flex-col relative min-w-0 max-w-full">
                      <div
                        className={cn("relative z-10 break-words min-w-0", bubbleStyleClass ? "w-fit max-w-full" : "", bubbleStyleClass)}
                        style={{
                          ...bubbleStyleObj,
                          ...(alignment === 'right' ? { borderBottomRightRadius: '4px' } : {}),
                          ...(alignment === 'left' ? { borderBottomLeftRadius: '4px' } : {})
                        }}
                      >
                        <MarkdownRenderer
                          text={mainContent}
                        />
                      </div>
                      <div className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity flex mt-1",
                        alignment === 'right' ? 'justify-end' : 'justify-start'
                      )}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          title="Copy message"
                        >
                          {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {hasTool && (
                    <div className="mt-3 flex flex-col gap-2 w-full min-w-0 max-w-full">
                      {toolInvocations.map((tool: any) => {
                        // When this is an A2UI tool call, show a status pill.
                        // The actual canvas is rendered externally.
                        if (hasA2UI && tool.toolName === a2uiToolName) {
                          return (
                            <A2UIToolPill
                              key={tool.toolCallId}
                              tool={tool}
                              agentId={agentId}
                            />
                          );
                        }

                        const tcStyles = messageStyle.toolCallStepStyles || {};
                        const headerStyles = tcStyles.headerStyles || {};
                        const reqStyles = tcStyles.requestDataStyles || {};
                        const resStyles = tcStyles.responseDataStyles || {};

                        return (
                          <details 
                            key={tool.toolCallId} 
                            className={cn("group [&_summary::-webkit-details-marker]:hidden mb-2", typeof tcStyles.containerStyle === 'string' ? tcStyles.containerStyle : "")}
                            style={typeof tcStyles.containerStyle === 'object' ? tcStyles.containerStyle : {}}
                          >
                            <summary className="flex items-center justify-between cursor-pointer list-none p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
                              <div className="flex items-center gap-2">
                                <span 
                                  className={typeof headerStyles.iconStyles?.iconStyle === 'string' ? headerStyles.iconStyles.iconStyle : ""}
                                  style={typeof headerStyles.iconStyles?.iconStyle === 'object' ? headerStyles.iconStyles.iconStyle : {}}
                                >
                                  {headerStyles.iconStyles?.icon || <Wrench size={14} />}
                                </span>
                                <span className="flex items-center">
                                  <span
                                    className={typeof headerStyles.titleStyles?.titleStyle === 'string' ? headerStyles.titleStyles.titleStyle : ""}
                                    style={typeof headerStyles.titleStyles?.titleStyle === 'object' ? headerStyles.titleStyles.titleStyle : {}}
                                  >
                                    Tool Call:
                                  </span>
                                  <span
                                    className={cn("ml-1", typeof headerStyles.titleStyles?.toolNameStyle === 'string' ? headerStyles.titleStyles.toolNameStyle : "")}
                                    style={typeof headerStyles.titleStyles?.toolNameStyle === 'object' ? headerStyles.titleStyles.toolNameStyle : {}}
                                  >
                                    {tool.toolName}
                                  </span>
                                  {messageToAgentMap.get(tool.toolCallId) && renderBadge(
                                    messageToAgentMap.get(tool.toolCallId) as string,
                                    subAgentBadgeStyleRaw,
                                    "px-2 py-0.5 text-xs font-medium bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center gap-1 ml-2",
                                    "text-zinc-700 dark:text-zinc-300",
                                    <Bot size={12} />
                                  )}
                                </span>
                              </div>
                              <ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180 opacity-50" />
                            </summary>
                            <div className="p-3 border border-t-0 border-zinc-200 dark:border-zinc-800 rounded-b-md bg-zinc-50/50 dark:bg-zinc-900/25 -mt-2 pt-4">
                              {reqStyles.titleStyle || reqStyles.icon ? (
                                <div className="font-medium mb-1 flex items-center gap-1">
                                  <span
                                    className={typeof reqStyles.iconStyle === 'string' ? reqStyles.iconStyle : ""}
                                    style={typeof reqStyles.iconStyle === 'object' ? reqStyles.iconStyle : {}}
                                  >
                                    {reqStyles.icon}
                                  </span>
                                  <span
                                    className={typeof reqStyles.titleStyle === 'string' ? reqStyles.titleStyle : ""}
                                    style={typeof reqStyles.titleStyle === 'object' ? reqStyles.titleStyle : {}}
                                  >
                                    Request
                                  </span>
                                </div>
                              ) : null}
                              <div 
                                className={cn("overflow-x-auto rounded-md text-xs", typeof reqStyles.dataStyle === 'string' ? reqStyles.dataStyle : "")}
                                style={typeof reqStyles.dataStyle === 'object' ? reqStyles.dataStyle : {}}
                              >
                                <MarkdownRenderer text={`\`\`\`json\n${typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}\n\`\`\``} />
                              </div>
                              {tool.result && (
                                <div className="mt-2 bg-green-50 dark:bg-green-950/30 rounded p-2 text-xs border border-green-100 dark:border-green-900">
                                  <div className="text-green-600 dark:text-green-400 font-medium mb-1 flex items-center gap-1">
                                    <span
                                      className={typeof resStyles.iconStyle === 'string' ? resStyles.iconStyle : ""}
                                      style={typeof resStyles.iconStyle === 'object' ? resStyles.iconStyle : {}}
                                    >
                                      {resStyles.icon || <CheckCircle2 size={12} />}
                                    </span>
                                    <span
                                      className={typeof resStyles.titleStyle === 'string' ? resStyles.titleStyle : ""}
                                      style={typeof resStyles.titleStyle === 'object' ? resStyles.titleStyle : {}}
                                    >
                                      Result
                                    </span>
                                  </div>
                                  <div 
                                    className={cn("overflow-x-auto rounded-md text-xs [&_.prose]:text-zinc-700 dark:[&_.prose]:text-zinc-300", typeof resStyles.dataStyle === 'string' ? resStyles.dataStyle : "")}
                                    style={typeof resStyles.dataStyle === 'object' ? resStyles.dataStyle : {}}
                                  >
                                    <MarkdownRenderer text={`\`\`\`json\n${typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}\n\`\`\``} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {(() => {
              // Extract active lifecycle events
              const runError = events.find((e: any) => {
                if (e.type !== 'RUN_ERROR' && e.type !== 'RunError') return false;
                const msg = String(e.message).toLowerCase();
                return !msg.includes('aborted') && !msg.includes('abort');
              });
              if (runError) {
                return (
                  <div className="mb-4 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-sm border border-red-200 dark:border-red-900">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1 font-medium">
                      <AlertCircle size={14} />
                      <span>Error</span>
                    </div>
                    <div className="text-red-700 dark:text-red-300">{runError.message || 'An error occurred during the run.'}</div>
                  </div>
                );
              }

              if (isLoading) {
                // Find the latest step event
                const stepEvents = events.filter((e: any) => e.type === 'STEP_STARTED' || e.type === 'StepStarted' || e.type === 'STEP_FINISHED' || e.type === 'StepFinished');
                const lastStep = stepEvents[stepEvents.length - 1];
                const activeStepName = (lastStep && (lastStep.type === 'STEP_STARTED' || lastStep.type === 'StepStarted')) ? lastStep.stepName : null;

                const tStyles = messageStyle.thinkingStepStyles || {};
                const thContainerStyle = tStyles.containerStyle;
                const thIconStyles = tStyles.iconStyles || {};
                const thTitleStyle = tStyles.titleStyle;

                return (
                  <div
                    className={cn("text-sm text-zinc-500 animate-pulse flex items-center gap-2", typeof thContainerStyle === 'string' ? thContainerStyle : "")}
                    style={typeof thContainerStyle === 'object' ? thContainerStyle : undefined}
                  >
                    <span 
                      className={typeof thIconStyles.iconStyle === 'string' ? thIconStyles.iconStyle : ""}
                      style={typeof thIconStyles.iconStyle === 'object' ? thIconStyles.iconStyle : {}}
                    >
                      {thIconStyles.icon || <PlayCircle size={14} className="animate-spin" />}
                    </span>
                    <span
                      className={typeof thTitleStyle === 'string' ? thTitleStyle : ""}
                      style={typeof thTitleStyle === 'object' ? thTitleStyle : {}}
                    >
                      {activeStepName ? `Executing step: ${activeStepName}...` : 'AI is thinking...'}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            <div ref={messagesEndRef} />
          </div>

          {promptChips?.promptChipList && promptChips.promptChipList.length > 0 && (promptChips.alwaysShow || messages.length === 0) && (
            <div
              className={cn("px-4 pb-2 pt-3 flex flex-wrap gap-2 shrink-0 border-t border-inherit", typeof chatManagerComponentStyles?.promptChipStyles?.promptChipContainerStyle === 'string' ? chatManagerComponentStyles.promptChipStyles.promptChipContainerStyle : "")}
              style={typeof chatManagerComponentStyles?.promptChipStyles?.promptChipContainerStyle === 'object' ? chatManagerComponentStyles.promptChipStyles.promptChipContainerStyle : undefined}
            >
              {promptChips.promptChipList.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  title={chip.hoverText}
                  onClick={() => handleChipClick(chip.prompt)}
                  className={cn(
                    "text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-3 py-1.5 transition-colors flex flex-col items-start text-left",
                    typeof chatManagerComponentStyles?.promptChipStyles?.promptChipHoverTextStyle === 'string' ? chatManagerComponentStyles.promptChipStyles.promptChipHoverTextStyle : ""
                  )}
                  style={typeof chatManagerComponentStyles?.promptChipStyles?.promptChipHoverTextStyle === 'object' ? chatManagerComponentStyles.promptChipStyles.promptChipHoverTextStyle : undefined}
                >
                  <span className={cn("font-medium", typeof chatManagerComponentStyles?.promptChipStyles?.promptChipTitleStyle === 'string' ? chatManagerComponentStyles.promptChipStyles.promptChipTitleStyle : "")}
                    style={typeof chatManagerComponentStyles?.promptChipStyles?.promptChipTitleStyle === 'object' ? chatManagerComponentStyles.promptChipStyles.promptChipTitleStyle : undefined}
                  >
                    {chip.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={handleFormSubmit}
            className={cn("p-4 flex flex-col gap-2 shrink-0", typeof inputSectionStyle.containerStyle === 'string' ? inputSectionStyle.containerStyle : "", typeof inputSectionStyle.backgroundStyle === 'string' ? inputSectionStyle.backgroundStyle : "", (!promptChips?.promptChipList || promptChips.promptChipList.length === 0 || (!promptChips.alwaysShow && messages.length > 0)) ? "border-t border-inherit" : "")}
            style={{ ...(typeof inputSectionStyle.containerStyle === 'object' ? inputSectionStyle.containerStyle : {}), ...(typeof inputSectionStyle.backgroundStyle === 'object' ? inputSectionStyle.backgroundStyle : {}) }}
          >
            <div className="flex gap-2 w-full">
              <Textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                placeholder={labels.placeholder || "Type a message..."}
                className={cn("flex-1 bg-foreground/5 border-transparent shadow-sm focus-visible:bg-transparent", typeof inputSectionStyle.inputStyle === 'string' ? inputSectionStyle.inputStyle : "")}
                style={typeof inputSectionStyle.inputStyle === 'object' ? inputSectionStyle.inputStyle : undefined}
                suppressHydrationWarning={true}
                maxLength={maxInputCharacter}
                {...inputProps as any}
              />
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => context?.stop && context.stop()}
                  variant={isAgUI ? 'secondary' : 'default'}
                  className={typeof inputSectionStyle.buttonStyle === 'string' ? inputSectionStyle.buttonStyle : ""}
                  style={typeof inputSectionStyle.buttonStyle === 'object' ? inputSectionStyle.buttonStyle : undefined}
                  suppressHydrationWarning={true}
                  title={labels.stopButton || "Stop Generating"}
                >
                  <Square size={16} fill="currentColor" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant={isAgUI ? 'secondary' : 'default'}
                  disabled={!input.trim()}
                  className={typeof inputSectionStyle.buttonStyle === 'string' ? inputSectionStyle.buttonStyle : ""}
                  style={typeof inputSectionStyle.buttonStyle === 'object' ? inputSectionStyle.buttonStyle : undefined}
                  suppressHydrationWarning={true}
                >
                  {labels.sendButton || "Send"}
                </Button>
              )}
            </div>
            {labels.disclaimer !== null && labels.disclaimer !== false && labels.disclaimer !== '' && (
              <div
                className={cn("text-xs text-center text-muted-foreground mt-1", typeof labels.labelStyles?.disclaimerStyle === 'string' ? labels.labelStyles.disclaimerStyle : "")}
                style={typeof labels.labelStyles?.disclaimerStyle === 'object' ? labels.labelStyles.disclaimerStyle : undefined}
              >
                {labels.disclaimer === undefined
                  ? "AI-generated content. Please review and verify critical information independently."
                  : labels.disclaimer}
              </div>
            )}
          </form>
        </div>


      </div>
    </div>
  );

  const a2uiSheetContent = hasA2UI && a2uiToolName && collapsibleA2UI ? (
    <Sheet open={isA2UIOpen} onOpenChange={setIsA2UIOpen}>
      <SheetTrigger
        render={
          <Button variant="default" size="icon" className="fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-50">
            <A2UICollapseIcon size={28} />
          </Button>
        }
      />
      <SheetContent side={a2uiPosition} showCloseButton={false} className="w-[400px] sm:w-[600px] md:w-[800px] flex flex-col p-4 bg-transparent border-none shadow-none">
        <div className={cn(`flex w-full h-full border rounded-xl flex-col`, chatContainerClass)}>
          <SheetHeader className="p-4 border-b flex flex-row items-center justify-between shrink-0">
            {(a2uiPosition === 'right' || a2uiPosition === 'bottom') && (
              <SheetClose render={<Button variant="ghost" size="icon-sm" className="h-8 w-8"><A2UICollapseIcon size={16} /></Button>} />
            )}
            <SheetTitle className="flex-1">Dynamic UI</SheetTitle>
            {(a2uiPosition === 'left' || a2uiPosition === 'top') && (
              <SheetClose render={<Button variant="ghost" size="icon-sm" className="h-8 w-8"><A2UICollapseIcon size={16} /></Button>} />
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 relative">
            <A2UICanvas />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  ) : null;

  const { toggleButtonStyle, toggleButtonIconProps, toggleButtonLabelProps } = toggleButtonProps || {};
  const hasToggleLabel = !!toggleButtonLabelProps?.toggleButtonLabel;

  const renderToggleButton = (isHidden: boolean = false) => (
    <Button
      variant="default"
      size={hasToggleLabel ? "default" : "icon"}
      className={cn(
        "fixed shadow-lg z-50",
        hasToggleLabel ? "rounded-full px-4 h-14" : "h-14 w-14 rounded-full",
        isHidden ? "hidden" : "",
        typeof toggleButtonStyle === 'string' ? toggleButtonStyle : ""
      )}
      style={typeof toggleButtonStyle === 'object' ? { ...getTogglePositionStyle(collapseToggleButtonPosition), ...toggleButtonStyle } : getTogglePositionStyle(collapseToggleButtonPosition)}
      onClick={isHidden ? undefined : () => setIsOpen(true)}
      suppressHydrationWarning={true}
    >
      <div className="flex items-center gap-2">
        {toggleButtonIconProps?.toggleButtonIcon ? (
          <span className={cn(typeof toggleButtonIconProps.toggleButtonIconStyle === 'string' ? toggleButtonIconProps.toggleButtonIconStyle : "")} style={typeof toggleButtonIconProps.toggleButtonIconStyle === 'object' ? toggleButtonIconProps.toggleButtonIconStyle : undefined}>
            {toggleButtonIconProps.toggleButtonIcon}
          </span>
        ) : (
          <MessageCircle size={hasToggleLabel ? 24 : 28} className={cn(typeof toggleButtonIconProps?.toggleButtonIconStyle === 'string' ? toggleButtonIconProps.toggleButtonIconStyle : "")} style={typeof toggleButtonIconProps?.toggleButtonIconStyle === 'object' ? toggleButtonIconProps.toggleButtonIconStyle : undefined} />
        )}
        {toggleButtonLabelProps?.toggleButtonLabel && (
          <span className={cn("text-base font-medium", typeof toggleButtonLabelProps.toggleButtonLabelStyle === 'string' ? toggleButtonLabelProps.toggleButtonLabelStyle : "")} style={typeof toggleButtonLabelProps.toggleButtonLabelStyle === 'object' ? toggleButtonLabelProps.toggleButtonLabelStyle : undefined}>
            {toggleButtonLabelProps.toggleButtonLabel}
          </span>
        )}
      </div>
    </Button>
  );

  if (isEmbedded || (!isSheet && !isFloating)) {
    if (isEmbeddedCollapsible && !isOpen) {
      return (
        <>
          {renderToggleButton()}
          {a2uiSheetContent}
        </>
      );
    }

    return (
      <>
        {innerContent}
        {a2uiSheetContent}
      </>
    );
  }


  const getFloatingDialogStyle = (pos?: string): React.CSSProperties => {
    // Neutralize Tailwind's center translations so we can anchor to the corners
    switch (pos) {
      case 'bottom-left':
      case 'left':
        return { left: '1.5rem', right: 'auto', bottom: '1.5rem', top: 'auto', '--tw-translate-x': '0px', '--tw-translate-y': '0px' } as React.CSSProperties & Record<string, string>;
      case 'bottom-right':
      case 'right':
        return { right: '1.5rem', left: 'auto', bottom: '1.5rem', top: 'auto', '--tw-translate-x': '0px', '--tw-translate-y': '0px' } as React.CSSProperties & Record<string, string>;
      case 'top-left':
        return { left: '1.5rem', right: 'auto', top: '1.5rem', bottom: 'auto', '--tw-translate-x': '0px', '--tw-translate-y': '0px' } as React.CSSProperties & Record<string, string>;
      case 'top-right':
        return { right: '1.5rem', left: 'auto', top: '1.5rem', bottom: 'auto', '--tw-translate-x': '0px', '--tw-translate-y': '0px' } as React.CSSProperties & Record<string, string>;
      case 'top':
        return { top: '1.5rem', bottom: 'auto', left: '50%', right: 'auto', '--tw-translate-x': '-50%', '--tw-translate-y': '0px' } as React.CSSProperties & Record<string, string>;
      case 'bottom':
        return { bottom: '1.5rem', top: 'auto', left: '50%', right: 'auto', '--tw-translate-x': '-50%', '--tw-translate-y': '0px' } as React.CSSProperties & Record<string, string>;
      default: return {};
    }
  };

  if (isFloating) {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={setIsOpen} modal={false} disablePointerDismissal={true}>
          <DialogTrigger
            render={renderToggleButton(isOpen)}
          />
          <DialogContent
            className="flex flex-col overflow-hidden max-w-[90vw] md:max-w-[800px] w-full h-[85vh] p-0 border-none bg-transparent shadow-none"
            showCloseButton={true}
            showOverlay={false}
            style={getFloatingDialogStyle(collapseToggleButtonPosition)}
          >
            {innerContent}
          </DialogContent>
        </Dialog>
        {a2uiSheetContent}
      </>
    );
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger
          render={renderToggleButton(isOpen)}
        />
        <SheetContent side={position} showCloseButton={false} className="w-[400px] sm:w-[500px] md:w-[600px] flex flex-col p-4 bg-transparent border-none shadow-none">
          {innerContent}
        </SheetContent>
      </Sheet>
      {a2uiSheetContent}
    </>
  );
}
