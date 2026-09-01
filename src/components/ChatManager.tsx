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

export function ChatManager({ 
  theme, 
  useA2UI = true, 
  layout = 'split', 
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
  sessionId,
  a2uiPosition = 'left',
  collapsibleA2UI = false,
  maxInputCharacter
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
  const { addSession, setActiveSessionId, activeSessionId, updateSessionMessages } = useAIChatStore();

  const activeSessionIdRef = React.useRef(activeSessionId);
  
  React.useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  React.useEffect(() => {
    if (activeSessionIdRef.current && context?.messages) {
      const session = useAIChatStore.getState().sessions.find(s => s.id === activeSessionIdRef.current);
      const hasExistingMessages = session?.messages && session.messages.length > 0;
      
      if (context.messages.length === 0 && hasExistingMessages) {
        // Prevent wiping out existing session messages with an empty array on mount or during transitions
        return;
      }
      updateSessionMessages(activeSessionIdRef.current, context.messages);
    }
  }, [context?.messages, updateSessionMessages]);
  const a2uiToolName = useAIChatStore((state) => state.a2uiToolName);
  const isLoading = status === 'submitted' || status === 'streaming';
  const globalTheme = useAIChatStore((state) => state.theme);
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

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!activeSessionId && input.trim()) {
      const newSession = {
        id: Date.now().toString(),
        title: input.slice(0, 30) || 'New Session',
        model: 'default',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addSession(newSession);
      setActiveSessionId(newSession.id);
    }
    handleSubmit(e);
  };
  
  const handleChipClick = (prompt: string) => {
    if (!activeSessionId && prompt.trim()) {
      const newSession = {
        id: Date.now().toString(),
        title: prompt.slice(0, 30) || 'New Session',
        model: 'default',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addSession(newSession);
      setActiveSessionId(newSession.id);
    }
    if (context?.append) {
      context.append({ role: 'user', content: prompt });
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
      style={{...(typeof globalBackgroundStyle === 'object' ? globalBackgroundStyle : {}), ...combinedStyle}}
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
        <div className={`flex flex-col flex-1 h-full min-w-0 ${layout === 'split' && useA2UI ? 'border-r border-inherit' : ''}`}>
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
              const hasTool = msg.toolInvocations && msg.toolInvocations.length > 0;
              
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
              const customStyleRaw = isUser ? messageStyle.userMessageStyle : messageStyle.assistantMessageStyle;
              
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

                  {thinkingContent && (
                    <details className="mb-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-3 text-sm border border-zinc-200 dark:border-zinc-800 group/think">
                      <summary className="flex items-center gap-2 text-zinc-500 font-medium cursor-pointer select-none list-none marker:hidden">
                        <Brain size={14} className="animate-pulse" />
                        <span>Reasoning</span>
                        <ChevronDown size={14} className="ml-auto transition-transform group-open/think:rotate-180" />
                      </summary>
                      <div className="mt-3 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                        <MarkdownRenderer text={thinkingContent} className="text-zinc-600 dark:text-zinc-400" />
                      </div>
                    </details>
                  )}
                  
                  
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
                      {msg.toolInvocations?.map((tool: any) => {
                        if (useA2UI && layout === 'inline' && tool.toolName === a2uiToolName) {
                          return (
                            <A2UICanvas 
                              key={tool.toolCallId} 
                              componentPayload={{ 
                                name: tool.args.componentName || tool.args.name || tool.toolName, 
                                props: tool.args.props || tool.args 
                              }} 
                            />
                          );
                        }
                        
                        return (
                          <details key={tool.toolCallId} className="group [&_summary::-webkit-details-marker]:hidden mb-2">
                            <summary className="flex items-center justify-between cursor-pointer list-none p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
                              <div className="flex items-center gap-2">
                                <Wrench size={14} />
                                <span className="flex items-center">
                                  Tool Call: {tool.toolName}
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
                              <div className="overflow-x-auto rounded-md text-xs">
                                <MarkdownRenderer text={`\`\`\`json\n${typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}\n\`\`\``} />
                              </div>
                              {tool.result && (
                                <div className="mt-2 bg-green-50 dark:bg-green-950/30 rounded p-2 text-xs border border-green-100 dark:border-green-900">
                                  <div className="text-green-600 dark:text-green-400 font-medium mb-1 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Result
                                  </div>
                                  <div className="overflow-x-auto rounded-md text-xs [&_.prose]:text-zinc-700 dark:[&_.prose]:text-zinc-300">
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
                
                return (
                  <div 
                    className={cn("text-sm text-zinc-500 animate-pulse flex items-center gap-2", typeof messageStyle.thinkingStepStyle === 'string' ? messageStyle.thinkingStepStyle : "")}
                    style={typeof messageStyle.thinkingStepStyle === 'object' ? messageStyle.thinkingStepStyle : undefined}
                  >
                    <PlayCircle size={14} className="animate-spin" />
                    <span>{activeStepName ? `Executing step: ${activeStepName}...` : 'AI is thinking...'}</span>
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
            style={{...(typeof inputSectionStyle.containerStyle === 'object' ? inputSectionStyle.containerStyle : {}), ...(typeof inputSectionStyle.backgroundStyle === 'object' ? inputSectionStyle.backgroundStyle : {})}}
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

        {/* Split A2UI Canvas Pane */}
        {useA2UI && layout === 'split' && !collapsibleA2UI && (
          <div className="w-1/2 h-full bg-inherit overflow-y-auto p-4 relative shrink-0">
             {/* Renders the latest UI component requested by the AI in the split pane */}
             <A2UICanvas />
          </div>
        )}
      </div>
    </div>
  );

  const a2uiSheetContent = useA2UI && layout === 'split' && collapsibleA2UI ? (
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
