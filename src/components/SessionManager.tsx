"use client"
import React, { useState } from 'react';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Button } from './ui/button';
import { SessionManagerProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp, MessageSquarePlus, Trash2, MessageSquare, Pin, PinOff, Pencil, Check, X, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SheetClose } from './ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Skeleton } from './ui/skeleton';

type StyleValue = React.CSSProperties | string | undefined;

const styleClassName = (...styles: StyleValue[]) => cn(
  ...styles.filter((style): style is string => typeof style === 'string'),
);

const styleObject = (...styles: StyleValue[]) => {
  const styleValues = styles.filter((style): style is React.CSSProperties => typeof style === 'object' && style !== null);
  return styleValues.length > 0 ? Object.assign({}, ...styleValues) : undefined;
};

const renderStyledIcon = (
  icon: React.ReactNode | undefined,
  fallback: React.ReactElement<{ className?: string; style?: React.CSSProperties }>,
  ...styles: StyleValue[]
) => {
  const iconElement = icon ?? fallback;
  const className = styleClassName(...styles);
  const style = styleObject(...styles);

  if (React.isValidElement<{ className?: string; style?: React.CSSProperties }>(iconElement)) {
    return React.cloneElement(iconElement, {
      className: cn(iconElement.props.className, className),
      style: { ...iconElement.props.style, ...style },
    });
  }

  return <span className={className} style={style}>{iconElement}</span>;
};

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

/**
 * A sidebar or drawer component that manages chat sessions (history).
 * Allows users to switch between past conversations, rename them, pin them,
 * or delete them. Connects automatically to the `useAIChatStore`.
 *
 * @param props - Configuration and styling options for the session list.
 * @returns A rendered session manager UI component.
 */
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
  const { sessions, activeSessionId, sessionStorageMode, setActiveSessionId, removeSession, getSession, renameSession, setSessionPinned } = useAIChatStore();
  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isInlineCollapsed, setIsInlineCollapsed] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const configuredSessionStorageMode = context?.sessionStorageMode ?? sessionStorageMode;
  if (configuredSessionStorageMode === 'disabled') {
    throw new Error('SessionManager requires sessionStorageMode to be "memory" or "api".');
  }
  
  const isSheetCollapsible = collapsible === true || collapsible === 'sheet';
  const isInlineCollapsible = collapsible === 'inline';

  const [isHydrated, setIsHydrated] = useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
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

  const handleNewSession = () => {
    // A new conversation is a blank, unselected draft. Its session is created
    // only when the user sends the first message.
    setActiveSessionId(null);

    if (context) {
      if (context.stop) context.stop();
      if (context.setMessages) {
        context.setMessages([]);
      }
    }

    onNewSession?.();
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

  const handleRename = async (id: string) => {
    try {
      await renameSession(id, sessionTitle);
      setEditingSessionId(null);
      setSessionTitle('');
    } catch (error) {
      console.error('Failed to rename the session:', error);
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

  const deletingSession = sessions.find((session) => session.id === deletingSessionId);
  const showSessionActions = (id: string) => setHoveredSessionId(id);
  const hideSessionActions = (id: string) => {
    setHoveredSessionId((currentId) => currentId === id ? null : currentId);
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

  if (!isHydrated) {
    if (isSheetCollapsible) return null;
    if (isInlineCollapsible && isInlineCollapsed) {
      const borderClass = position === 'right' ? 'border-l' : 
                          position === 'top' ? 'border-b' :
                          position === 'bottom' ? 'border-t' : 'border-r';
      return (
        <div className={cn(`flex flex-col h-full bg-background items-center py-4 ${borderClass}`, className)} style={{ width: '60px', minWidth: '60px', ...style }}>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      );
    }
    return (
      <div className={cn("flex flex-col h-full bg-background border-r border-border", className)} style={style}>
        <div className="p-4 border-b flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="p-4 border-b">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <OverlayScrollbarsComponent 
          className="flex-1 p-4 space-y-4"
          options={{ scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' } }}
          defer
        >
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </OverlayScrollbarsComponent>
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

      <OverlayScrollbarsComponent 
        className="flex-1 p-2"
        options={{ scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' } }}
        defer
      >
        <div className="px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {recentLabel}
        </div>
        <div className="flex flex-col gap-1 mt-1">
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={cn(`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted ${activeSessionId === s.id ? 'bg-muted font-medium' : ''}`, typeof listStyle?.containerStyle === 'string' ? listStyle.containerStyle : "")}
              style={typeof listStyle?.containerStyle === 'object' ? listStyle.containerStyle : undefined}
              onClick={() => handleSessionSelect(s.id)}
              onMouseEnter={() => showSessionActions(s.id)}
              onMouseLeave={() => hideSessionActions(s.id)}
              onPointerEnter={() => showSessionActions(s.id)}
              onPointerLeave={() => hideSessionActions(s.id)}
              onFocusCapture={() => showSessionActions(s.id)}
              onBlurCapture={() => hideSessionActions(s.id)}
            >
              {editingSessionId === s.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-1"
                  onClick={(event) => event.stopPropagation()}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRename(s.id);
                  }}
                >
                  <input
                    autoFocus
                    value={sessionTitle}
                    onChange={(event) => setSessionTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setEditingSessionId(null);
                        setSessionTitle('');
                      }
                    }}
                    className="h-7 min-w-0 flex-1 rounded border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Conversation title"
                  />
                  <Button type="submit" variant="ghost" size="icon-sm" className="h-7 w-7" title="Save title">
                    <Check size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    title="Cancel rename"
                    onClick={() => {
                      setEditingSessionId(null);
                      setSessionTitle('');
                    }}
                  >
                    <X size={14} />
                  </Button>
                </form>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                  {renderStyledIcon(
                    listStyle?.listItemIconStyles?.icon,
                    <MessageSquare size={16} className="shrink-0 text-muted-foreground" />,
                    listStyle?.listItemIconStyles?.iconStyle,
                  )}
                  <div className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", typeof listStyle?.textStyle === 'string' ? listStyle.textStyle : "")} style={typeof listStyle?.textStyle === 'object' ? listStyle.textStyle : undefined}>{s.title}</span>
                    <span className={cn("block truncate text-xs text-muted-foreground", typeof listStyle?.timeStyle === 'string' ? listStyle.timeStyle : "")} style={typeof listStyle?.timeStyle === 'object' ? listStyle.timeStyle : undefined} title={new Date(s.updatedAt).toLocaleString()}>
                      {formatRelativeTime(s.updatedAt, currentTime)}
                    </span>
                  </div>
                  {s.metadata?.isPinned && <Pin size={13} className="shrink-0 text-muted-foreground" aria-label="Pinned" />}
                </div>
              )}
              
              <div
                className={cn("items-center", (hoveredSessionId === s.id || openSessionMenuId === s.id) ? "flex" : "hidden")}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                className="h-7 w-7 text-muted-foreground"
                title={s.metadata?.isPinned ? 'Unpin conversation' : 'Pin conversation'}
                onClick={() => void handlePinToggle(s.id, Boolean(s.metadata?.isPinned))}
              >
                  {renderStyledIcon(
                    listStyle?.listItemPinButtonStyles?.icon,
                    s.metadata?.isPinned ? <PinOff size={14} /> : <Pin size={14} />,
                    listStyle?.listItemPinButtonStyles?.iconStyles,
                  )}
                </Button>
                <DropdownMenu onOpenChange={(open) => setOpenSessionMenuId(open ? s.id : null)}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        title="Conversation actions"
                        aria-label="Conversation actions"
                      >
                        {renderStyledIcon(
                          listStyle?.listItemMenuButtonStyles?.icon,
                          <MoreHorizontal size={16} />,
                          listStyle?.listItemMenuButtonStyles?.iconStyle,
                        )}
                      </Button>
                    }
                  />
                  <DropdownMenuContent
                    align="end"
                    className="rounded-2xl p-1"
                    style={{ width: '9rem', minWidth: '9rem' }}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        className={cn(
                          "gap-1.5 rounded-xl px-2 py-1.5 text-xs",
                          styleClassName(listStyle?.listItemRenameButtonStyles?.containerStyle),
                        )}
                        style={styleObject(listStyle?.listItemRenameButtonStyles?.containerStyle)}
                        onClick={() => {
                          setEditingSessionId(s.id);
                          setSessionTitle(s.title);
                        }}
                      >
                        {renderStyledIcon(
                          listStyle?.listItemRenameButtonStyles?.icon,
                          <Pencil />,
                          listStyle?.listItemRenameButtonStyles?.iconStyle,
                        )}
                        <span
                          className={styleClassName(listStyle?.listItemRenameButtonStyles?.textStyle)}
                          style={styleObject(listStyle?.listItemRenameButtonStyles?.textStyle)}
                        >
                          {listStyle?.listItemRenameButtonStyles?.text ?? 'Rename'}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="my-0.5" />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        className={cn(
                          "gap-1.5 rounded-xl px-2 py-1.5 text-xs",
                          styleClassName(listStyle?.listItemDeleteButtonStyles?.containerStyle),
                        )}
                        style={styleObject(listStyle?.listItemDeleteButtonStyles?.containerStyle)}
                        onClick={() => setDeletingSessionId(s.id)}
                      >
                        {renderStyledIcon(
                          listStyle?.listItemDeleteButtonStyles?.icon,
                          <Trash2 />,
                          listStyle?.listItemDeleteButtonStyles?.iconStyle,
                        )}
                        <span
                          className={styleClassName(listStyle?.listItemDeleteButtonStyles?.textStyle)}
                          style={styleObject(listStyle?.listItemDeleteButtonStyles?.textStyle)}
                        >
                          {listStyle?.listItemDeleteButtonStyles?.text ?? 'Delete'}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No active sessions
            </div>
          )}
        </div>
        <AlertDialog open={Boolean(deletingSession)} onOpenChange={(open) => !open && setDeletingSessionId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingSession?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingSessionId) void handleDelete(deletingSessionId);
                  setDeletingSessionId(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </OverlayScrollbarsComponent>
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
