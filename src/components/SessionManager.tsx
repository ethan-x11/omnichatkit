"use client"
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Button } from './ui/button';
import { SessionManagerProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import type { ChatSession } from '../store/useAIChatStore';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp, MessageSquarePlus, Trash2, MessageSquare, Pin, PinOff, Pencil, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SheetClose } from './ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

const formatRelativeTime = (value: Date | string, now: number) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';

  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 5) return 'now';
  if (elapsedSeconds < 60) return `${elapsedSeconds} second${elapsedSeconds === 1 ? '' : 's'} ago`;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 365) return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;

  const elapsedYears = Math.floor(elapsedDays / 365);
  return `${elapsedYears} year${elapsedYears === 1 ? '' : 's'} ago`;
};

export function SessionManager({ 
  label = "Sessions", 
  recentLabel = "Recent Conversations",
  className,
  style,
  position = 'left',
  collapsible = true,
  onSessionSelect,
  onNewSession,
  sessionManagerComponentStyles = {}
}: SessionManagerProps) {
  const {
    titleStyle = {},
    listStyle = {},
    newConversationButtonStyles = {}
  } = sessionManagerComponentStyles;
  const { sessions, activeSessionId, sessionStorageMode, setActiveSessionId, removeSession, createSession, getSession, renameSession, setSessionPinned } = useAIChatStore();
  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isInlineCollapsed, setIsInlineCollapsed] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const configuredSessionStorageMode = context?.sessionStorageMode ?? sessionStorageMode;
  if (configuredSessionStorageMode === 'disabled') {
    throw new Error('SessionManager requires sessionStorageMode to be "memory" or "api".');
  }
  
  const isSheetCollapsible = collapsible === true || collapsible === 'sheet';
  const isInlineCollapsible = collapsible === 'inline';

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Restore session messages on mount if there's an active session
  React.useEffect(() => {
    const loadInitialSession = async () => {
      if (!activeSessionId) return;

      try {
        const initialSession = await getSession(activeSessionId);

        if (initialSession && context && context.setMessages) {
          const vercelMessages = (initialSession.messages || []).map((m: any) => {
            let toolInvocations: any[] | undefined = undefined;
            if (m.toolCalls && m.toolCalls.length > 0) {
              toolInvocations = m.toolCalls.map((tc: any) => ({
                state: 'result',
                toolCallId: tc.id,
                toolName: tc.function.name,
                args: JSON.parse(tc.function.arguments || '{}'),
                result: {}
              }));
            }
            return {
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: typeof m.createdAt === 'string' ? new Date(m.createdAt) : m.createdAt,
              toolInvocations
            };
          });
          context.setMessages(vercelMessages as any[]);
        } else if (context?.setMessages) {
          context.setMessages([]);
        }
      } catch (error) {
        console.error('Failed to load the initial session:', error);
      }
    };
    
    loadInitialSession();
    // We explicitly only want this to run once on mount!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewSession = async () => {
    if (onNewSession) {
      onNewSession();
    } else {
      try {
        const now = new Date();
        const newSession = await createSession({
          id: typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: 'New Session',
          model: 'default',
          metadata: {},
          createdAt: now,
          updatedAt: now,
        });
        setActiveSessionId(newSession.id);
      } catch (error) {
        console.error('Failed to create a new session:', error);
        return;
      }
    }
    
    // Clear chat messages and stop ongoing requests when a new session is created
    if (context) {
      if (context.stop) context.stop();
      if (context.setMessages) {
        context.setMessages([]);
      }
    }
  };

  const handleSessionSelect = async (id: string) => {
    if (context && context.stop) {
      context.stop();
    }
    
    let sessionToLoad;
    try {
      sessionToLoad = await getSession(id);
    } catch (error) {
      console.error('Error fetching session:', error);
      return;
    }

    if (!sessionToLoad) return;

    if (context && context.setMessages) {
      const vercelMessages = (sessionToLoad?.messages || []).map((m: any) => {
        let toolInvocations: any[] | undefined = undefined;
        if (m.toolCalls && m.toolCalls.length > 0) {
          toolInvocations = m.toolCalls.map((tc: any) => ({
            state: 'result',
            toolCallId: tc.id,
            toolName: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
            result: {}
          }));
        }
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: typeof m.createdAt === 'string' ? new Date(m.createdAt) : m.createdAt,
          toolInvocations
        };
      });
      context.setMessages(vercelMessages as any[]);
    }
    setActiveSessionId(id);
    onSessionSelect?.(id);
  };

  const handleAgentRename = async (session: ChatSession) => {
    const chatContext = context;
    if (!chatContext?.generateSessionTitle) return;

    const sourceMessages = session.id === activeSessionId && chatContext.messages.length > 0
      ? chatContext.messages
      : session.messages || [];

    if (sourceMessages.length === 0) return;

    setRenamingSessionId(session.id);
    try {
      const title = await chatContext.generateSessionTitle(sourceMessages);
      await renameSession(session.id, title);
    } catch (error) {
      console.error('Failed to generate a session title:', error);
    } finally {
      setRenamingSessionId(null);
    }
  };

  const handlePinToggle = async (id: string, isPinned: boolean) => {
    try {
      await setSessionPinned(id, !isPinned);
    } catch (error) {
      console.error('Failed to update the pinned state:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeSession(id);
      if (activeSessionId === id && context?.setMessages) {
        context.setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete the session:', error);
    }
  };

  const CollapseIcon = position === 'right' ? PanelRightClose : 
                       position === 'left' ? PanelLeftClose :
                       position === 'top' ? ChevronUp : ChevronDown;
                       
  const ExpandIcon = position === 'right' ? PanelLeftClose : 
                     position === 'left' ? PanelRightClose :
                     position === 'top' ? ChevronDown : ChevronUp;

  if (isInlineCollapsible && isInlineCollapsed) {
    const borderClass = position === 'right' ? 'border-l' : 
                        position === 'top' ? 'border-b' :
                        position === 'bottom' ? 'border-t' : 'border-r';
    return (
      <div className={cn(`flex flex-col h-full bg-background items-center py-4 ${borderClass}`, className)} style={{ width: '60px', minWidth: '60px', ...style }}>
        <Button variant="ghost" size="icon" onClick={() => setIsInlineCollapsed(false)} title="Expand Sessions">
           <ExpandIcon size={20} />
        </Button>
      </div>
    );
  }

  const innerContent = (
    <div className={cn("flex flex-col h-full bg-background", className)} style={style}>
      <SheetHeader className="p-4 border-b flex flex-row items-center justify-between">
        {isSheetCollapsible && (position === 'right' || position === 'bottom') && (
          <SheetClose render={<Button variant="ghost" size="icon-sm" className="h-8 w-8"><CollapseIcon size={16} /></Button>} />
        )}
        {isInlineCollapsible && (position === 'right' || position === 'bottom') && (
          <Button variant="ghost" size="icon-sm" className="h-8 w-8" onClick={() => setIsInlineCollapsed(true)}>
            <CollapseIcon size={16} />
          </Button>
        )}
        {isSheetCollapsible ? (
          <SheetTitle 
            className={cn("flex-1", typeof titleStyle === 'string' ? titleStyle : "")}
            style={typeof titleStyle === 'object' ? titleStyle : undefined}
          >
            {label}
          </SheetTitle>
        ) : (
          <div 
            className={cn("font-heading text-base font-medium text-foreground flex-1", typeof titleStyle === 'string' ? titleStyle : "")}
            style={typeof titleStyle === 'object' ? titleStyle : undefined}
          >
            {label}
          </div>
        )}
        {isSheetCollapsible && (position === 'left' || position === 'top') && (
          <SheetClose render={<Button variant="ghost" size="icon-sm" className="h-8 w-8" suppressHydrationWarning={true}><CollapseIcon size={16} /></Button>} />
        )}
        {isInlineCollapsible && (position === 'left' || position === 'top') && (
          <Button variant="ghost" size="icon-sm" className="h-8 w-8" onClick={() => setIsInlineCollapsed(true)} suppressHydrationWarning={true}>
            <CollapseIcon size={16} />
          </Button>
        )}
      </SheetHeader>
      
      <div className="p-4 border-b">
        <Button 
          onClick={handleNewSession} 
          className={cn("w-full justify-start gap-2", typeof newConversationButtonStyles.newConversationButtonStyle === 'string' ? newConversationButtonStyles.newConversationButtonStyle : "")} 
          style={typeof newConversationButtonStyles.newConversationButtonStyle === 'object' ? newConversationButtonStyles.newConversationButtonStyle : undefined}
          variant="default" 
          disabled={!context?.messages || context.messages.length === 0}
          suppressHydrationWarning={true}
        >
           <MessageSquarePlus 
             size={16} 
             className={typeof newConversationButtonStyles.newConversationButtonIconStyle === 'string' ? newConversationButtonStyles.newConversationButtonIconStyle : ""}
             style={typeof newConversationButtonStyles.newConversationButtonIconStyle === 'object' ? newConversationButtonStyles.newConversationButtonIconStyle : undefined}
           /> 
           <span
             className={typeof newConversationButtonStyles.newConversationButtonTextStyle === 'string' ? newConversationButtonStyles.newConversationButtonTextStyle : ""}
             style={typeof newConversationButtonStyles.newConversationButtonTextStyle === 'object' ? newConversationButtonStyles.newConversationButtonTextStyle : undefined}
           >
             New Conversation
           </span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {recentLabel}
        </div>
        <div className="flex flex-col gap-1 mt-1">
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={cn(`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted ${activeSessionId === s.id ? 'bg-muted font-medium' : ''}`, typeof listStyle?.itemStyle === 'string' ? listStyle.itemStyle : "")}
              style={typeof listStyle?.itemStyle === 'object' ? listStyle.itemStyle : undefined}
              onClick={() => handleSessionSelect(s.id)}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                <MessageSquare size={16} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", typeof listStyle?.textStyle === 'string' ? listStyle.textStyle : "")} style={typeof listStyle?.textStyle === 'object' ? listStyle.textStyle : undefined}>{s.title}</span>
                  <span className={cn("block truncate text-xs text-muted-foreground", typeof listStyle?.timeStyle === 'string' ? listStyle.timeStyle : "")} style={typeof listStyle?.timeStyle === 'object' ? listStyle.timeStyle : undefined} title={new Date(s.updatedAt).toLocaleString()}>
                    {formatRelativeTime(s.updatedAt, currentTime)}
                  </span>
                </div>
                {s.metadata?.isPinned && <Pin size={13} className="shrink-0 text-muted-foreground" aria-label="Pinned" />}
              </div>
              
              <div className={cn("flex items-center transition-opacity", activeSessionId === s.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")} onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  title={s.metadata?.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                  onClick={() => void handlePinToggle(s.id, Boolean(s.metadata?.isPinned))}
                >
                  {s.metadata?.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  title="Generate conversation title"
                  disabled={renamingSessionId !== null || (!s.messages?.length && (s.id !== activeSessionId || !context?.messages.length))}
                  onClick={() => void handleAgentRename(s)}
                >
                  {renamingSessionId === s.id ? <LoaderCircle size={14} className="animate-spin" /> : <Pencil size={14} />}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger render={
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:bg-red-500/20", typeof listStyle?.deleteButtonStyle === 'string' ? listStyle.deleteButtonStyle : "")}
                        style={typeof listStyle?.deleteButtonStyle === 'object' ? listStyle.deleteButtonStyle : undefined}
                        title="Delete Session"
                        suppressHydrationWarning={true}
                    >
                      <Trash2 size={14} className={typeof listStyle?.deleteIconStyle === 'string' ? listStyle.deleteIconStyle : undefined} style={typeof listStyle?.deleteIconStyle === 'object' ? listStyle.deleteIconStyle : undefined} />
                    </Button>
                  } />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{s.title}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void handleDelete(s.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No active sessions
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!isSheetCollapsible) {
    return innerContent;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger 
        render={
          <Button variant="outline" className="gap-2">
            <MessageSquare size={16} /> {label}
          </Button>
        }
      />
      <SheetContent side={position} showCloseButton={false} className="w-[300px] sm:w-[400px] flex flex-col p-0">
        {innerContent}
      </SheetContent>
    </Sheet>
  );
}
