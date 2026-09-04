"use client"
import React, { useState, useRef, useEffect } from 'react';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';
import { ChatManagerProps } from '../types';
import { A2UICanvas } from './A2UICanvas';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from './ui/message-scroller';
import { OverlayScrollbarsComponent, useOverlayScrollbars } from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from './ui/sheet';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogPortal } from './ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Marker, MarkerContent, MarkerIcon } from './ui/marker';
import { MessageCircle, PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp, Copy, Check, Square, Brain, Wrench, Activity, AlertCircle, PlayCircle, CheckCircle2, User, Bot, ArrowDown, Plus, X, Image as ImageIcon, FileText, Video, Mic, Paperclip, Send } from 'lucide-react';
import { cn } from 'cn';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Message, MessageHeader, MessageContent, MessageFooter } from './ui/message';

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

/**
 * The core Chat UI component that manages message rendering, input state,
 * and user interactions. It automatically connects to the nearest
 * `AIChatProvider` or `AGUIChatProvider` context.
 *
 * @param props - Customization and configuration properties for the chat UI.
 * @returns A rendered chat interface component.
 */
export function ChatManager({
  theme,
  className,
  style,
  chatManagerComponentStyles = {},
  position = 'right',
  display,
  displayOptions,
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
  streaming,
  showToolCalls = true,
  showReasoning = true,
  sendHistory = true,
  inputTypeList
}: ChatManagerProps) {
  const collapsible = displayOptions?.collapsible ?? false;
  const isResizable = displayOptions?.isResizable ?? false;
  const {
    messageStyle = {},
    inputSectionStyle = {},
    headerStyle = {},
    skeletonStyles = {},
    scrollButtonStyles = {},
    backgroundStyle: globalBackgroundStyle
  } = chatManagerComponentStyles;

  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;

  if (!context) {
    throw new Error('ChatManager must be used within either an AIChatProvider or an AGUIChatProvider');
  }

  const { messages, input, handleInputChange, handleSubmit, status, setInput, append } = context as any;
  const events = (context as any).events || [];
  const { activeSessionId, sessionStorageMode, updateSessionMessages } = useAIChatStore();
  const sessionsEnabled = sessionStorageMode !== 'disabled';

  const activeSessionIdRef = React.useRef(activeSessionId);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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

  // File Attachments State
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ type: string; file: File; base64: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [selectedMimeTypeFilter, setSelectedMimeTypeFilter] = useState<string>('*/*');
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<{ type: string; file: File; base64: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };

    if (isAttachMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isAttachMenuOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFiles(prev => [...prev, {
          type: file.type,
          file,
          base64: reader.result as string
        }]);
        setIsAttachMenuOpen(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = (accept: string) => {
    setSelectedMimeTypeFilter(accept);
    // Use a small timeout to allow state to update before clicking
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
    }, 0);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

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

  const [isHydrated, setIsHydrated] = React.useState(false);
  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleFormSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;

    if (attachedFiles.length > 0 && append) {
      const contentArray: any[] = [];
      if (input.trim()) {
        contentArray.push({ type: 'text', text: input.trim() });
      }

      attachedFiles.forEach(af => {
        let type = 'document';
        if (af.type.startsWith('image/')) type = 'image';
        else if (af.type.startsWith('audio/')) type = 'audio';
        else if (af.type.startsWith('video/')) type = 'video';

        // Extract base64 part
        const base64Value = af.base64.includes(',') ? af.base64.split(',')[1] : af.base64;

        contentArray.push({
          type,
          source: {
            type: 'data',
            value: base64Value,
            mimeType: af.type,
            name: af.file.name
          }
        });
      });

      append({
        role: 'user',
        content: contentArray
      });

      if (setInput) setInput('');
      setAttachedFiles([]);
      return;
    }

    const body: Record<string, any> = {};
    if (streaming !== undefined) body.streaming = streaming;
    if (!sendHistory) body.sendHistory = false;
    const options = Object.keys(body).length > 0 ? { body } : undefined;
    handleSubmit(e, options);
  };

  const handleChipClick = async (prompt: string) => {
    if (!prompt.trim() || !context?.append) return;

    try {
      const body: Record<string, any> = {};
      if (streaming !== undefined) body.streaming = streaming;
      if (!sendHistory) body.sendHistory = false;
      const options = Object.keys(body).length > 0 ? { body } : undefined;
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

  if (!isHydrated) {
    if (isFloating || isSheet || isEmbeddedCollapsible) {
      return null;
    }
    return (
      <div
        className={cn(`flex border rounded-xl flex-col relative ${chatContainerClass} ${sizeClass}`, typeof skeletonStyles.containerStyle === 'string' ? skeletonStyles.containerStyle : (typeof globalBackgroundStyle === 'string' ? globalBackgroundStyle : ""), className)}
        style={{ ...(typeof skeletonStyles.containerStyle === 'object' ? skeletonStyles.containerStyle : (typeof globalBackgroundStyle === 'object' ? globalBackgroundStyle : {})), ...combinedStyle }}
      >
        <div
          className={cn("p-4 border-b flex items-center justify-between", typeof skeletonStyles.headerStyle === 'string' ? skeletonStyles.headerStyle : "")}
          style={typeof skeletonStyles.headerStyle === 'object' ? skeletonStyles.headerStyle : undefined}
        >
          <Skeleton className="h-6 w-32" />
        </div>
        <div
          className={cn("flex-1 p-6 space-y-6 flex flex-col justify-end", typeof skeletonStyles.messageStyle === 'string' ? skeletonStyles.messageStyle : "")}
          style={typeof skeletonStyles.messageStyle === 'object' ? skeletonStyles.messageStyle : undefined}
        >
          <Skeleton className="h-16 w-3/4 rounded-2xl self-end" />
          <Skeleton className="h-20 w-3/4 rounded-2xl self-start" />
          <Skeleton className="h-16 w-2/3 rounded-2xl self-end" />
        </div>
        <div
          className={cn("p-4 border-t", typeof skeletonStyles.inputStyle === 'string' ? skeletonStyles.inputStyle : "")}
          style={typeof skeletonStyles.inputStyle === 'object' ? skeletonStyles.inputStyle : undefined}
        >
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
    );
  }

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
          <div className="relative flex-1 min-h-0 flex flex-col">
            <MessageScrollerProvider autoScroll={autoScroll} defaultScrollPosition="last-anchor">
              <MessageScroller className="flex-1 h-full min-w-0">
                <MessageScrollerViewport
                  className={cn("flex-1 p-4", typeof messageStyle.backgroundStyle === 'string' ? messageStyle.backgroundStyle : "")}
                  style={typeof messageStyle.backgroundStyle === 'object' ? messageStyle.backgroundStyle : undefined}
                >
                  <MessageScrollerContent className='gap-0'>
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
              {messages.map((msg: any) => {
                // Prefer parts (new API) over toolInvocations (deprecated). Fall back for AG-UI
                // messages that are not Vercel AI SDK messages and won't have parts.
                const toolParts = (msg.parts ?? []).filter((p: any) => p.type === 'tool-invocation');
                const toolInvocations: any[] = toolParts.length > 0
                  ? toolParts.map((p: any) => p.toolInvocation)
                  : ((msg as any).toolInvocations ?? []);
                const hasTool = toolInvocations.length > 0;

                if ((msg.role as string) === 'reasoning') {
                  return (
                    <MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.role === 'user'}>
                      <details className="mb-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-3 text-sm border border-zinc-200 dark:border-zinc-800 group">
                        <summary className="flex items-center gap-2 text-zinc-500 font-medium cursor-pointer select-none list-none marker:hidden">
                          <Brain size={14} className="animate-pulse" />
                          <span>Reasoning</span>
                          <ChevronDown size={14} className="ml-auto transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap mt-3 border-t border-zinc-200 dark:border-zinc-700 pt-2">{msg.content}</div>
                      </details>
                    </MessageScrollerItem>
                  );
                }

                if ((msg.role as string) === 'activity') {
                  return (
                    <MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.role === 'user'}>
                      <div className="mb-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm border border-blue-100 dark:border-blue-900">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1 font-medium">
                          <Activity size={14} />
                          <span>Activity Update</span>
                        </div>
                        <div className="text-zinc-700 dark:text-zinc-300 font-mono text-xs overflow-x-auto">
                          {msg.content}
                        </div>
                      </div>
                    </MessageScrollerItem>
                  );
                }

                if ((msg.role as string) === 'tool') {
                  return (
                    <MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.role === 'user'}>
                      <div className="mb-4 bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-sm border border-green-100 dark:border-green-900">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1 font-medium">
                          <CheckCircle2 size={14} />
                          <span>Tool Result</span>
                        </div>
                        <div className="text-zinc-700 dark:text-zinc-300 font-mono text-xs overflow-x-auto">
                          {msg.content}
                        </div>
                      </div>
                    </MessageScrollerItem>
                  );
                }

                if ((msg.role as string) === 'system') {
                  if (msg.content === 'Response Stopped') {
                    return (
                      <MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.role === 'user'}>
                        <Marker
                          variant="separator"
                          className={cn(
                            "mb-4",
                            typeof messageStyle.stopResponseStyle === 'string' ? messageStyle.stopResponseStyle : ""
                          )}
                          style={typeof messageStyle.stopResponseStyle === 'object' ? messageStyle.stopResponseStyle : undefined}
                        >
                          <MarkerContent>Response Stopped</MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    );
                  }

                  return (
                    <MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.role === 'user'}>
                      <div className="mb-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-lg p-3 text-sm border border-zinc-200 dark:border-zinc-800">
                        <div className="text-zinc-600 dark:text-zinc-400">
                          {msg.content}
                        </div>
                      </div>
                    </MessageScrollerItem>
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
                let attachmentPreviewStylesRaw: any = undefined;

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
                    attachmentPreviewStylesRaw = styleDef.attachmentPreviewStyles;
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
                let mainContent: string = '';
                let mediaContents: any[] = [];
                let isActivity = (msg.role as string) === 'activity';
                let isDeveloper = (msg.role as string) === 'developer';
                let isReasoning = (msg.role as string) === 'reasoning';

                if (isUser && Array.isArray(msg.content)) {
                  mainContent = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n\n');
                  mediaContents = msg.content.filter((c: any) => c.type !== 'text');
                } else if (isReasoning) {
                  thinkingContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                } else if (isActivity) {
                  mainContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2);
                } else if (typeof msg.content === 'string') {
                  mainContent = msg.content;
                } else {
                  mainContent = msg.content ? JSON.stringify(msg.content) : '';
                }

                if (!isUser && !isReasoning && !isActivity && !isDeveloper && typeof mainContent === 'string') {
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

                if (isActivity) {
                  const actStyles = (messageStyle as any).activityMessageStyles || {};
                  const actContainerStyleClass = typeof actStyles === 'string' ? actStyles : (typeof actStyles.containerStyle === 'string' ? actStyles.containerStyle : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg px-4 py-3 text-sm border border-blue-100 dark:border-blue-800 w-full");
                  const actContainerStyleObj = typeof actStyles === 'object' && typeof actStyles.containerStyle === 'object' ? actStyles.containerStyle : {};

                  return (
                    <MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.role === 'user'}>
                      <div className={cn("mb-4 group relative w-full flex flex-col", alignment === 'left' ? 'pr-8' : alignment === 'right' ? 'pl-8' : 'px-8', alignmentClass, containerStyleClass)} style={containerStyleObj}>
                        <div className={actContainerStyleClass} style={actContainerStyleObj}>
                          <div className="flex items-center gap-2 font-medium mb-1">
                            <Activity size={14} />
                            {(msg as any).activityType || 'Activity'}
                          </div>
                          <pre className="text-xs overflow-x-auto p-2 bg-white/50 dark:bg-black/20 rounded">
                            {mainContent}
                          </pre>
                        </div>
                      </div>
                    </MessageScrollerItem>
                  );
                }

                return (
                  <MessageScrollerItem key={msg.id} messageId={msg.id} scrollAnchor={msg.role === 'user'}>
                    <Message className={cn("mb-4", containerStyleClass)} style={containerStyleObj} align={alignment === 'right' ? 'end' : 'start'}>
                      <MessageContent className={cn(alignment === 'left' ? 'pr-8' : alignment === 'right' ? 'pl-8' : 'px-8', alignmentClass)}>
                    {(mainContent || thinkingContent || (!thinkingContent && !hasTool)) && (
                      <MessageHeader className="font-bold mb-2 px-0 flex items-center gap-2 min-w-0 max-w-full">
                        {isUser ? (
                          renderBadge(labels.userLabel ?? 'You', badgeStyleRaw, "flex items-center gap-1", "", <User size={14} />)
                        ) : isDeveloper ? (
                          renderBadge('Developer', (messageStyle as any).developerMessageStyles?.badgeStyle || badgeStyleRaw, "flex items-center gap-1", "", <Wrench size={14} />)
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

                      </MessageHeader>
                    )}

                    {showReasoning && thinkingContent && (() => {
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
                          className={cn("relative z-10 break-words min-w-0", bubbleStyleClass ? "w-fit max-w-full" : "", bubbleStyleClass, isDeveloper ? "font-mono text-sm" : "")}
                          style={{
                            ...bubbleStyleObj,
                            ...(alignment === 'right' ? { borderBottomRightRadius: '4px' } : {}),
                            ...(alignment === 'left' ? { borderBottomLeftRadius: '4px' } : {})
                          }}
                        >
                          {mediaContents.length > 0 && (
                            <div
                              className={cn("flex flex-wrap gap-2 mb-2 w-full", typeof attachmentPreviewStylesRaw?.containerStyle === 'string' ? attachmentPreviewStylesRaw.containerStyle : "")}
                              style={typeof attachmentPreviewStylesRaw?.containerStyle === 'object' ? attachmentPreviewStylesRaw.containerStyle : undefined}
                            >
                              {mediaContents.map((media, i) => {
                                const dataUrl = `data:${media.source?.mimeType || 'application/octet-stream'};base64,${media.source?.value}`;
                                const fileName = media.source?.name || 'Attachment';
                                const isImage = media.type === 'image' || media.source?.mimeType?.startsWith('image/');
                                const isVideo = media.type === 'video' || media.source?.mimeType?.startsWith('video/');
                                const isAudio = media.type === 'audio' || media.source?.mimeType?.startsWith('audio/');

                                return (
                                  <div
                                    key={i}
                                    className={cn("h-12 w-12 border rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center relative cursor-pointer hover:opacity-80 transition-opacity shrink-0", typeof attachmentPreviewStylesRaw?.itemStyle === 'string' ? attachmentPreviewStylesRaw.itemStyle : "")}
                                    style={typeof attachmentPreviewStylesRaw?.itemStyle === 'object' ? attachmentPreviewStylesRaw.itemStyle : undefined}
                                    onClick={() => {
                                      if (media.type === 'document' && media.source?.mimeType === 'application/pdf') {
                                        // Can't easily use createObjectURL from base64 synchronously without Blob, so use data URL
                                        const pdfWindow = window.open("");
                                        if (pdfWindow) {
                                          pdfWindow.document.write(`<iframe width='100%' height='100%' src='${dataUrl}'></iframe>`);
                                        }
                                      } else if (isImage || isVideo || isAudio || (media.type === 'document' && media.source?.mimeType?.startsWith('text/'))) {
                                        setSelectedPreviewFile({
                                          file: new File([new Blob()], fileName),
                                          base64: dataUrl,
                                          type: media.source?.mimeType || ''
                                        });
                                      }
                                    }}
                                  >
                                    {isImage ? (
                                      <img src={dataUrl} className="h-full w-full object-cover" alt={fileName} />
                                    ) : isVideo ? (
                                      <Video size={18} className="text-zinc-500" />
                                    ) : isAudio ? (
                                      <Mic size={18} className="text-zinc-500" />
                                    ) : (
                                      <FileText size={18} className="text-zinc-500" />
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-[8px] text-white truncate px-1 text-center backdrop-blur-sm pb-0.5 leading-none pt-0.5">
                                      {fileName}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <MarkdownRenderer
                            text={mainContent}
                          />
                        </div>
                        <MessageFooter className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity mt-1"
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
                        </MessageFooter>
                      </div>
                    ) : null}

                    {showToolCalls && hasTool && (
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
                            <Marker
                              key={tool.toolCallId}
                              className={cn("mb-2 items-start", typeof tcStyles.containerStyle === 'string' ? tcStyles.containerStyle : "")}
                              style={typeof tcStyles.containerStyle === 'object' ? tcStyles.containerStyle : {}}
                            >
                              <MarkerIcon className="mt-0.5">
                                <span
                                  className={typeof headerStyles.iconStyles?.iconStyle === 'string' ? headerStyles.iconStyles.iconStyle : ""}
                                  style={typeof headerStyles.iconStyles?.iconStyle === 'object' ? headerStyles.iconStyles.iconStyle : {}}
                                >
                                  {headerStyles.iconStyles?.icon || <Wrench size={14} />}
                                </span>
                              </MarkerIcon>
                              <MarkerContent>
                                <details className="group [&_summary::-webkit-details-marker]:hidden w-full">
                                  <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-sm transition-colors text-zinc-700 dark:text-zinc-300">
                                    <div className="flex items-center gap-2">
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
                                  <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
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
                              </MarkerContent>
                            </Marker>
                          );
                        })}
                      </div>
                    )}
                    </MessageContent>
                  </Message>
                  </MessageScrollerItem>
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
                    <MessageScrollerItem messageId="run-error" scrollAnchor={false}>
                      <div className="mb-4 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-sm border border-red-200 dark:border-red-900">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1 font-medium">
                          <AlertCircle size={14} />
                          <span>Error</span>
                        </div>
                        <div className="text-red-700 dark:text-red-300">{runError.message || 'An error occurred during the run.'}</div>
                      </div>
                    </MessageScrollerItem>
                  );
                }

                // const abortError = events.find((e: any) => {
                //   if (e.type !== 'RUN_ERROR' && e.type !== 'RunError') return false;
                //   const msg = String(e.message).toLowerCase();
                //   return msg.includes('aborted') || msg.includes('abort');
                // });
                // if (abortError) {
                //   return (
                //     <Marker variant="separator" className="mb-4">
                //       <MarkerContent>Response Stopped</MarkerContent>
                //     </Marker>
                //   );
                // }

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
                    <MessageScrollerItem messageId="is-loading" scrollAnchor={false}>
                      <Marker
                        className={cn(typeof thContainerStyle === 'string' ? thContainerStyle : "")}
                        style={typeof thContainerStyle === 'object' ? thContainerStyle : undefined}
                      >
                        <MarkerIcon>
                          <span
                            className={typeof thIconStyles.iconStyle === 'string' ? thIconStyles.iconStyle : ""}
                            style={typeof thIconStyles.iconStyle === 'object' ? thIconStyles.iconStyle : {}}
                          >
                            {thIconStyles.icon || <PlayCircle size={14} className="animate-spin" />}
                          </span>
                        </MarkerIcon>
                        <MarkerContent className={cn("shimmer", typeof thTitleStyle === 'string' ? thTitleStyle : "")} style={typeof thTitleStyle === 'object' ? thTitleStyle : {}}>
                          {activeStepName ? `Executing step: ${activeStepName}...` : 'AI is thinking...'}
                        </MarkerContent>
                      </Marker>
                    </MessageScrollerItem>
                  );
                }
                return null;
              })()}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton
                  className="rounded-full shadow-md w-8 h-8 opacity-90 hover:opacity-100"
                >
                  <span
                    className={typeof scrollButtonStyles.iconStyles === 'string' ? scrollButtonStyles.iconStyles : ""}
                    style={typeof scrollButtonStyles.iconStyles === 'object' ? scrollButtonStyles.iconStyles : {}}
                  >
                    {scrollButtonStyles.icon || <ArrowDown size={16} />}
                  </span>
                </MessageScrollerButton>
              </MessageScroller>
            </MessageScrollerProvider>
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
            className={cn("p-4 flex flex-col gap-2 shrink-0 relative", typeof inputSectionStyle.containerStyle === 'string' ? inputSectionStyle.containerStyle : "", typeof inputSectionStyle.backgroundStyle === 'string' ? inputSectionStyle.backgroundStyle : "", (!promptChips?.promptChipList || promptChips.promptChipList.length === 0 || (!promptChips.alwaysShow && messages.length > 0)) ? "border-t border-inherit" : "")}
            style={{ ...(typeof inputSectionStyle.containerStyle === 'object' ? inputSectionStyle.containerStyle : {}), ...(typeof inputSectionStyle.backgroundStyle === 'object' ? inputSectionStyle.backgroundStyle : {}) }}
          >
            {attachedFiles.length > 0 && (
              <div
                className={cn("flex gap-3 w-full overflow-x-auto pb-2 pt-2 px-2 shrink-0", typeof inputSectionStyle.attachmentMenuStyles?.previewContainerStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.previewContainerStyles : "")}
                style={typeof inputSectionStyle.attachmentMenuStyles?.previewContainerStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.previewContainerStyles : undefined}
              >
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="relative group shrink-0">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full z-10 flex items-center justify-center shadow-sm"
                      onClick={() => removeAttachedFile(idx)}
                    >
                      <X size={12} />
                    </Button>
                    <div
                      className={cn("h-16 w-16 border rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center relative cursor-pointer hover:opacity-80 transition-opacity", typeof inputSectionStyle.attachmentMenuStyles?.previewItemContainerStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.previewItemContainerStyles : "")}
                      style={typeof inputSectionStyle.attachmentMenuStyles?.previewItemContainerStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.previewItemContainerStyles : undefined}
                      onClick={() => {
                        if (file.type === 'application/pdf') {
                          window.open(URL.createObjectURL(file.file), '_blank');
                        } else if (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/') || file.type.startsWith('text/')) {
                          setSelectedPreviewFile(file);
                        }
                      }}
                    >
                      {file.type.startsWith('image/') ? (
                        <img src={file.base64} className="h-full w-full object-cover" alt="Preview" />
                      ) : file.type.startsWith('video/') ? (
                        <Video size={24} className="text-zinc-500" />
                      ) : file.type.startsWith('audio/') ? (
                        <Mic size={24} className="text-zinc-500" />
                      ) : (
                        <FileText size={24} className="text-zinc-500" />
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/50 text-[9px] text-white truncate px-1 text-center backdrop-blur-sm pb-0.5">
                        {file.file.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 w-full items-end relative">
              {inputTypeList && inputTypeList.length > 0 && (
                <div className="relative shrink-0 flex items-center justify-center h-full mb-1" ref={attachMenuRef}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept={selectedMimeTypeFilter}
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn("rounded-full w-10 h-10 border-dashed", typeof inputSectionStyle.attachmentMenuStyles?.plusButtonContainerStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.plusButtonContainerStyles : "")}
                    style={typeof inputSectionStyle.attachmentMenuStyles?.plusButtonContainerStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.plusButtonContainerStyles : undefined}
                    onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                  >
                    <span
                      className={cn("flex items-center justify-center", typeof inputSectionStyle.attachmentMenuStyles?.plusButtonIconStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.plusButtonIconStyles : "")}
                      style={typeof inputSectionStyle.attachmentMenuStyles?.plusButtonIconStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.plusButtonIconStyles : undefined}
                    >
                      {inputSectionStyle.attachmentMenuStyles?.plusButtonIcon || (
                        <Plus size={18} className={cn("transition-transform duration-200 text-zinc-500", isAttachMenuOpen ? "rotate-45" : "")} />
                      )}
                    </span>
                  </Button>

                  {isAttachMenuOpen && (
                    <div
                      className={cn("absolute bottom-[calc(100%+0.5rem)] left-0 bg-background/80 backdrop-blur-md border border-border/50 shadow-lg rounded-xl p-1 z-50 flex flex-col min-w-[120px] animate-in fade-in zoom-in duration-200 origin-bottom-left", typeof inputSectionStyle.attachmentMenuStyles?.menuContainerStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuContainerStyles : "")}
                      style={typeof inputSectionStyle.attachmentMenuStyles?.menuContainerStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuContainerStyles : undefined}
                    >
                      {inputTypeList.includes('image') && (
                        <button
                          type="button"
                          className={cn("flex items-center gap-2.5 px-2.5 py-2 text-xs hover:bg-accent hover:text-accent-foreground rounded-lg text-left transition-colors text-foreground font-medium", typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : "")}
                          style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : undefined}
                          onClick={() => triggerFileInput('image/*')}
                        >
                          <span className={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : ""} style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : undefined}>
                            <ImageIcon size={14} className="text-zinc-500" />
                          </span>
                          Image
                        </button>
                      )}
                      {inputTypeList.includes('document') && (
                        <button
                          type="button"
                          className={cn("flex items-center gap-2.5 px-2.5 py-2 text-xs hover:bg-accent hover:text-accent-foreground rounded-lg text-left transition-colors text-foreground font-medium", typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : "")}
                          style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : undefined}
                          onClick={() => triggerFileInput('.pdf,.doc,.docx,.txt,application/pdf,text/plain')}
                        >
                          <span className={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : ""} style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : undefined}>
                            <FileText size={14} className="text-zinc-500" />
                          </span>
                          Document
                        </button>
                      )}
                      {inputTypeList.includes('audio') && (
                        <button
                          type="button"
                          className={cn("flex items-center gap-2.5 px-2.5 py-2 text-xs hover:bg-accent hover:text-accent-foreground rounded-lg text-left transition-colors text-foreground font-medium", typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : "")}
                          style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : undefined}
                          onClick={() => triggerFileInput('audio/*')}
                        >
                          <span className={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : ""} style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : undefined}>
                            <Mic size={14} className="text-zinc-500" />
                          </span>
                          Audio
                        </button>
                      )}
                      {inputTypeList.includes('video') && (
                        <button
                          type="button"
                          className={cn("flex items-center gap-2.5 px-2.5 py-2 text-xs hover:bg-accent hover:text-accent-foreground rounded-lg text-left transition-colors text-foreground font-medium", typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : "")}
                          style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemStyles : undefined}
                          onClick={() => triggerFileInput('video/*')}
                        >
                          <span className={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : ""} style={typeof inputSectionStyle.attachmentMenuStyles?.menuItemIconStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.menuItemIconStyles : undefined}>
                            <Video size={14} className="text-zinc-500" />
                          </span>
                          Video
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div
                className="flex-1 flex flex-col rounded-2xl overflow-hidden bg-foreground/5 focus-within:bg-transparent focus-within:ring-3 focus-within:ring-ring/30 focus-within:border-ring transition-[color,box-shadow,background-color] border border-transparent shadow-sm"
                style={{ maxHeight: 140 }}
              >
                <OverlayScrollbarsComponent
                  className="w-full flex-1 min-h-0"
                  options={{ scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' } }}
                  defer
                >
                  <Textarea
                    ref={textareaRef}
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
                    className={cn("w-full bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:border-transparent min-h-[44px] !max-h-none resize-none", typeof inputSectionStyle.inputStyle === 'string' ? inputSectionStyle.inputStyle : "")}
                    style={typeof inputSectionStyle.inputStyle === 'object' ? inputSectionStyle.inputStyle : undefined}
                    suppressHydrationWarning={true}
                    maxLength={maxInputCharacter}
                    {...inputProps as any}
                  />
                </OverlayScrollbarsComponent>
              </div>
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => context?.stop && context.stop()}
                  variant={isAgUI ? 'secondary' : 'default'}
                  className={typeof inputSectionStyle.sendButtonStyles?.containerStyle === 'string' ? inputSectionStyle.sendButtonStyles.containerStyle : ""}
                  style={typeof inputSectionStyle.sendButtonStyles?.containerStyle === 'object' ? inputSectionStyle.sendButtonStyles.containerStyle : undefined}
                  suppressHydrationWarning={true}
                  title={labels.stopButton || "Stop Generating"}
                >
                  <Square size={16} fill="currentColor" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant={isAgUI ? 'secondary' : 'default'}
                  disabled={!input.trim() && attachedFiles.length === 0}
                  className={typeof inputSectionStyle.sendButtonStyles?.containerStyle === 'string' ? inputSectionStyle.sendButtonStyles.containerStyle : ""}
                  style={typeof inputSectionStyle.sendButtonStyles?.containerStyle === 'object' ? inputSectionStyle.sendButtonStyles.containerStyle : undefined}
                  suppressHydrationWarning={true}
                >
                  <span
                    className={cn("flex items-center justify-center gap-2", typeof inputSectionStyle.sendButtonStyles?.iconStyles === 'string' ? inputSectionStyle.sendButtonStyles.iconStyles : "")}
                    style={typeof inputSectionStyle.sendButtonStyles?.iconStyles === 'object' ? inputSectionStyle.sendButtonStyles.iconStyles : undefined}
                  >
                    {inputSectionStyle.sendButtonStyles?.icon !== undefined ? inputSectionStyle.sendButtonStyles.icon : <Send size={16} />}
                  </span>
                  {labels.sendButton && (
                    <span
                      className={typeof inputSectionStyle.sendButtonStyles?.labelStyles === 'string' ? inputSectionStyle.sendButtonStyles.labelStyles : ""}
                      style={typeof inputSectionStyle.sendButtonStyles?.labelStyles === 'object' ? inputSectionStyle.sendButtonStyles.labelStyles : undefined}
                    >
                      {labels.sendButton}
                    </span>
                  )}
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
          <OverlayScrollbarsComponent
            className="flex-1 p-4 relative"
            options={{ scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' } }}
            defer
          >
            <A2UICanvas />
          </OverlayScrollbarsComponent>
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

  const previewDialog = (
    <Dialog open={!!selectedPreviewFile} onOpenChange={(open) => !open && setSelectedPreviewFile(null)}>
      <DialogContent
        className={cn("max-w-4xl w-[95vw] md:w-full max-h-[90vh] p-0 border-none bg-black/95 text-white flex flex-col overflow-hidden shadow-2xl", typeof inputSectionStyle.attachmentMenuStyles?.previewDialogContainerStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.previewDialogContainerStyles : "")}
        style={typeof inputSectionStyle.attachmentMenuStyles?.previewDialogContainerStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.previewDialogContainerStyles : undefined}
      >
        <DialogTitle className="sr-only">Preview Attachment</DialogTitle>
        <div
          className={cn("flex-1 overflow-auto flex items-center justify-center p-4", typeof inputSectionStyle.attachmentMenuStyles?.previewDialogMediaStyles === 'string' ? inputSectionStyle.attachmentMenuStyles.previewDialogMediaStyles : "")}
          style={typeof inputSectionStyle.attachmentMenuStyles?.previewDialogMediaStyles === 'object' ? inputSectionStyle.attachmentMenuStyles.previewDialogMediaStyles : undefined}
        >
          {selectedPreviewFile?.type.startsWith('image/') && (
            <img src={selectedPreviewFile.base64} className="max-w-full max-h-[85vh] object-contain" alt="Preview" />
          )}
          {selectedPreviewFile?.type.startsWith('video/') && (
            <video src={selectedPreviewFile.base64} controls autoPlay className="max-w-full max-h-[85vh]" />
          )}
          {selectedPreviewFile?.type.startsWith('audio/') && (
            <audio src={selectedPreviewFile.base64} controls autoPlay className="w-full max-w-md" />
          )}
          {selectedPreviewFile?.type.startsWith('text/') && (
            <iframe src={selectedPreviewFile.base64} className="w-full h-[85vh] bg-white rounded-md border-none" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isEmbedded || (!isSheet && !isFloating)) {
    if (isEmbeddedCollapsible && !isOpen) {
      return (
        <>
          {renderToggleButton()}
          {a2uiSheetContent}
          {previewDialog}
        </>
      );
    }

    return (
      <>
        {innerContent}
        {a2uiSheetContent}
        {previewDialog}
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
          <DialogPortal>
            <DialogPrimitive.Popup
              className={cn(
                "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl bg-popover p-6 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none sm:max-w-md dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                "flex flex-col overflow-hidden max-w-[90vw] md:max-w-[800px] w-full h-[85vh] p-0 border-none bg-transparent shadow-none"
              )}
              style={getFloatingDialogStyle(collapseToggleButtonPosition)}
            >
              {innerContent}
              <DialogPrimitive.Close
                data-slot="dialog-close"
                render={
                  <Button
                    variant="ghost"
                    className="absolute top-4 right-4 bg-secondary"
                    size="icon-sm"
                  />
                }
              >
                <X size={16} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </DialogPrimitive.Popup>
          </DialogPortal>
        </Dialog>
        {a2uiSheetContent}
        {previewDialog}
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
      {previewDialog}
    </>
  );
}

