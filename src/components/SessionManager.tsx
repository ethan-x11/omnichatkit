"use client"
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Button } from './ui/button';
import { SessionManagerProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp, MessageSquarePlus, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SheetClose } from './ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

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
  const { sessions, activeSessionId, setActiveSessionId, removeSession, addSession } = useAIChatStore();
  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;
  
  const [isOpen, setIsOpen] = useState(false);
  const [isInlineCollapsed, setIsInlineCollapsed] = useState(false);
  
  const isSheetCollapsible = collapsible === true || collapsible === 'sheet';
  const isInlineCollapsible = collapsible === 'inline';

  // Restore session messages on mount if there's an active session
  React.useEffect(() => {
    if (activeSessionId) {
      const initialSession = sessions.find(s => s.id === activeSessionId);
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
      }
    }
    // We explicitly only want this to run once on mount!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewSession = () => {
    if (onNewSession) {
      onNewSession();
    } else {
      const newSession = {
        id: Date.now().toString(),
        title: 'New Session',
        model: 'default',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addSession(newSession);
      setActiveSessionId(newSession.id);
    }
    
    // Clear chat messages and stop ongoing requests when a new session is created
    if (context) {
      if (context.stop) context.stop();
      if (context.setMessages) {
        context.setMessages([]);
      }
    }
  };

  const handleSessionSelect = (id: string) => {
    if (context && context.stop) {
      context.stop();
    }
    const sessionToLoad = sessions.find(s => s.id === id);
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
    if (onSessionSelect) {
      onSessionSelect(id);
    } else {
      setActiveSessionId(id);
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
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare size={16} className="text-muted-foreground flex-shrink-0" />
                <span className={cn("truncate text-sm", typeof listStyle?.textStyle === 'string' ? listStyle.textStyle : "")} style={typeof listStyle?.textStyle === 'object' ? listStyle.textStyle : undefined}>{s.title}</span>
              </div>
              
              <div className={cn("flex items-center transition-opacity", activeSessionId === s.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")} onClick={(e) => e.stopPropagation()}>
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
                      <AlertDialogAction onClick={() => {
                        removeSession(s.id);
                        if (activeSessionId === s.id && context && context.setMessages) {
                          context.setMessages([]);
                        }
                      }}>Delete</AlertDialogAction>
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
