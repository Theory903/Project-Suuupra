'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  MessageCircle,
  Smile,
  MoreHorizontal,
  Shield,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'file';
  isOwn?: boolean;
  isInstructor?: boolean;
  isModerator?: boolean;
}

interface LiveChatProps {
  roomId: string;
  className?: string;
}

export function LiveChat({ roomId, className }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize WebSocket connection for real-time chat
    initializeChatConnection();
    
    // Load chat history
    loadChatHistory();

    return () => {
      // Cleanup WebSocket connection
    };
  }, [roomId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    scrollToBottom();
  }, [messages]);

  const initializeChatConnection = async () => {
    try {
      // Here we would establish WebSocket connection to the live-classes service
      // This would connect to the WebSocket handlers defined in the backend
      setIsConnected(true);
      setIsLoading(false);
      
      // Mock some initial messages for demo
      setMessages([
        {
          id: '1',
          userId: 'system',
          userName: 'System',
          message: 'Welcome to the live session!',
          timestamp: new Date(Date.now() - 300000),
          type: 'system',
        },
        {
          id: '2',
          userId: 'instructor',
          userName: 'John Doe',
          message: 'Hello everyone! Welcome to today\'s live class. We\'ll be covering advanced React patterns.',
          timestamp: new Date(Date.now() - 240000),
          type: 'text',
          isInstructor: true,
        },
        {
          id: '3',
          userId: 'student1',
          userName: 'Alice Smith',
          message: 'Excited to learn! Thank you for this session.',
          timestamp: new Date(Date.now() - 180000),
          type: 'text',
        },
      ]);
    } catch (error) {
      console.error('Failed to connect to chat:', error);
      toast.error('Failed to connect to chat');
      setIsLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      // Here we would load chat history from the API
      // GET /live-classes/api/v1/chat/{roomId}/history
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !isConnected) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: 'current-user', // This would come from auth context
      userName: 'You',
      message: newMessage.trim(),
      timestamp: new Date(),
      type: 'text',
      isOwn: true,
    };

    // Optimistic update
    setMessages(prev => [...prev, message]);
    setNewMessage('');

    try {
      // Send message to backend via WebSocket or API
      // This would integrate with the chat-manager service
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== message.id));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading chat...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chat Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="font-medium">Live Chat</span>
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t bg-gray-50">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            className="flex-1"
            maxLength={500}
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim() || !isConnected}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="text-xs text-muted-foreground mt-2">
          Press Enter to send • {newMessage.length}/500
        </div>
      </div>
    </div>
  );
}

interface ChatMessageItemProps {
  message: ChatMessage;
}

function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isSystem = message.type === 'system';
  const isOwn = message.isOwn;

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs flex items-center gap-2">
          <AlertTriangle className="h-3 w-3" />
          {message.message}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isOwn && "justify-end")}>
      {!isOwn && (
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-gray-600" />
        </div>
      )}
      
      <div className={cn("max-w-xs lg:max-w-md space-y-1", isOwn && "text-right")}>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium",
            message.isInstructor && "text-blue-600",
            message.isModerator && "text-purple-600",
            isOwn && "text-right"
          )}>
            {message.userName}
            {message.isInstructor && (
              <Badge variant="outline" className="ml-1 text-xs">
                <Shield className="h-2 w-2 mr-1" />
                Host
              </Badge>
            )}
            {message.isModerator && (
              <Badge variant="outline" className="ml-1 text-xs">
                Mod
              </Badge>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        
        <div className={cn(
          "inline-block p-3 rounded-lg text-sm",
          isOwn 
            ? "bg-blue-500 text-white rounded-br-sm" 
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        )}>
          {message.message}
        </div>
      </div>

      {isOwn && (
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}
