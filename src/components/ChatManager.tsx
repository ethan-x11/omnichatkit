"use client"
import React, { useState } from 'react';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';
import { ChatManagerProps } from '../types';
import { A2UICanvas } from './A2UICanvas';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from './ui/sheet';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from './ui/dialog';
import { MessageCircle, PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp, Copy, Check, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  toggleButtonStyle,
  defaultOpen = false,
  autoScroll = true,
  inputProps = {},
  welcomeScreen,
  labels = {},
  agentId,
  sessionId,
  a2uiPosition = 'left',
  collapsibleA2UI = false
}: ChatManagerProps) {
  const {
    messageStyle = {},
    inputSectionStyle = {},
    headerStyle = {}
  } = chatManagerComponentStyles;

  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;

  if (!context) {
    throw new Error('ChatManager must be used within either an AIChatProvider or an AGUIChatProvider');
  }

  const { messages, input, handleInputChange, handleSubmit, status } = context;
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
    <div className={cn(`flex border rounded-xl flex-col relative ${chatContainerClass} ${sizeClass}`, className)} style={combinedStyle}>
      {resizeHandle}
      {(isSheet || isFloating || isEmbedded) && (
        <div className="p-4 border-b flex flex-row items-center justify-between shrink-0">
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
          <div className="flex-1 overflow-y-auto p-4">
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
              // Check if the message contains a tool invocation that requires rendering UI
              const hasTool = msg.toolInvocations && msg.toolInvocations.length > 0;
              
              const isUser = msg.role === 'user';
              const customStyleRaw = isUser ? messageStyle.userMessageStyle : messageStyle.assistantMessageStyle;
              const customStyleObj = typeof customStyleRaw === 'object' ? customStyleRaw : undefined;
              const customStyleClass = typeof customStyleRaw === 'string' ? customStyleRaw : '';

              return (
                <div key={msg.id} className={cn("mb-4 group relative pr-8", customStyleClass)} style={customStyleObj}>
                  <span className="font-bold">{isUser ? 'You' : 'AI'}: </span>
                  <span>{msg.content}</span>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-foreground" 
                    onClick={() => handleCopy(msg.id, msg.content)}
                    title="Copy message"
                  >
                    {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </Button>
                  
                  {useA2UI && layout === 'inline' && hasTool && (
                    <div className="mt-2">
                      {msg.toolInvocations?.map(tool => (
                        tool.toolName === a2uiToolName ? (
                          <A2UICanvas 
                            key={tool.toolCallId} 
                            componentPayload={{ 
                              name: tool.args.componentName || tool.args.name || tool.toolName, 
                              props: tool.args.props || tool.args 
                            }} 
                          />
                        ) : null
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isLoading && (
              <div 
                className={cn("text-sm text-zinc-500 animate-pulse", typeof messageStyle.thinkingStepStyle === 'string' ? messageStyle.thinkingStepStyle : "")}
                style={typeof messageStyle.thinkingStepStyle === 'object' ? messageStyle.thinkingStepStyle : undefined}
              >
                AI is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleFormSubmit} className={cn("p-4 border-t border-inherit flex flex-col gap-2 shrink-0", typeof inputSectionStyle.containerStyle === 'string' ? inputSectionStyle.containerStyle : "")} style={typeof inputSectionStyle.containerStyle === 'object' ? inputSectionStyle.containerStyle : undefined}>
            <div className="flex gap-2 w-full">
              <Input 
                value={input} 
                onChange={handleInputChange}
                placeholder={labels.placeholder || "Type a message..."} 
                className={cn("flex-1 bg-foreground/5 border-transparent shadow-sm focus-visible:bg-transparent", typeof inputSectionStyle.inputStyle === 'string' ? inputSectionStyle.inputStyle : "")} 
                style={typeof inputSectionStyle.inputStyle === 'object' ? inputSectionStyle.inputStyle : undefined}
                suppressHydrationWarning={true}
                {...inputProps}
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

  if (isEmbedded || (!isSheet && !isFloating)) {
    if (isEmbeddedCollapsible && !isOpen) {
      return (
        <>
          <Button 
            variant="default" 
            size="icon" 
            className={cn("fixed h-14 w-14 rounded-full shadow-lg z-50", typeof toggleButtonStyle === 'string' ? toggleButtonStyle : "")}
            style={typeof toggleButtonStyle === 'object' ? { ...getTogglePositionStyle(collapseToggleButtonPosition), ...toggleButtonStyle } : getTogglePositionStyle(collapseToggleButtonPosition)}
            onClick={() => setIsOpen(true)}
            suppressHydrationWarning={true}
          >
            <MessageCircle size={28} />
          </Button>
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
            render={
              <Button variant="default" size="icon" className={cn("fixed h-14 w-14 rounded-full shadow-lg z-50", isOpen ? "hidden" : "", typeof toggleButtonStyle === 'string' ? toggleButtonStyle : "")} style={typeof toggleButtonStyle === 'object' ? { ...getTogglePositionStyle(collapseToggleButtonPosition), ...toggleButtonStyle } : getTogglePositionStyle(collapseToggleButtonPosition)} suppressHydrationWarning={true}>
                <MessageCircle size={28} />
              </Button>
            }
          />
          <DialogContent 
            className="max-w-[90vw] md:max-w-[800px] w-full h-[85vh] p-0 border-none bg-transparent shadow-none" 
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
          render={
            <Button variant="default" size="icon" className={cn("fixed h-14 w-14 rounded-full shadow-lg z-50", isOpen ? "hidden" : "", typeof toggleButtonStyle === 'string' ? toggleButtonStyle : "")} style={typeof toggleButtonStyle === 'object' ? { ...getTogglePositionStyle(collapseToggleButtonPosition), ...toggleButtonStyle } : getTogglePositionStyle(collapseToggleButtonPosition)} suppressHydrationWarning={true}>
              <MessageCircle size={28} />
            </Button>
          }
        />
        <SheetContent side={position} showCloseButton={false} className="w-[400px] sm:w-[500px] md:w-[600px] flex flex-col p-4 bg-transparent border-none shadow-none">
          {innerContent}
        </SheetContent>
      </Sheet>
      {a2uiSheetContent}
    </>
  );
}
