'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSkeleton } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Share,
  MessageCircle,
  Users,
  Settings,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MoreHorizontal,
  Hand,
  Copy,
  RadioIcon as Live,
  Clock,
  Shield,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { useLiveRoom } from '@/hooks/live/use-live-rooms';
import { LiveStreamingInterface } from '@/components/live/live-streaming-interface';
import { LiveChat } from '@/components/live/live-chat';
import { ParticipantsList } from '@/components/live/participants-list';
import { StreamingControls } from '@/components/live/streaming-controls';
import { toast } from 'sonner';

export default function LiveRoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  
  const { data: room, isLoading, error, refetch } = useLiveRoom(roomId);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleCopyRoomLink = () => {
    const link = `${window.location.origin}/live/room/${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success('Room link copied to clipboard!');
  };

  if (isLoading) {
    return <RoomPageSkeleton />;
  }

  if (error || !room) {
    return (
      <EmptyState
        title="Room not found"
        description="The live room you're looking for doesn't exist or has been removed."
        action={{
          label: 'Back to Live Rooms',
          onClick: () => window.location.href = '/live',
        }}
      />
    );
  }

  const isLive = room.status === 'live';
  const isEnded = room.status === 'ended';

  return (
    <div className={`h-screen bg-gray-900 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header Bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isLive && <Live className="h-4 w-4 text-red-500 animate-pulse" />}
            <h1 className="text-lg font-semibold">{room.title}</h1>
            <Badge variant={isLive ? 'default' : isEnded ? 'secondary' : 'outline'}>
              {room.status}
            </Badge>
          </div>
          
          {isLive && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {room.currentParticipants || 0} participants
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Live now
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyRoomLink}>
            <Copy className="h-4 w-4 mr-2" />
            Share Link
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleToggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 bg-gray-900 relative">
          <LiveStreamingInterface 
            roomId={roomId}
            room={room}
            isFullscreen={isFullscreen}
          />
          
          {/* Floating Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <StreamingControls 
              roomId={roomId}
              room={room}
            />
          </div>
          
          {/* Participants Grid Overlay (for small screens) */}
          {isFullscreen && (
            <div className="absolute top-4 right-4 w-64">
              <Card className="bg-black/50 text-white border-gray-700">
                <CardContent className="p-4">
                  <ParticipantsList 
                    roomId={roomId}
                    compact
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {!isFullscreen && (
          <div className="w-80 bg-white border-l flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="participants" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  People ({room.currentParticipants || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 m-0">
                <LiveChat 
                  roomId={roomId}
                  className="h-full"
                />
              </TabsContent>

              <TabsContent value="participants" className="flex-1 m-0 p-4">
                <ParticipantsList 
                  roomId={roomId}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Mobile Bottom Panel */}
      <div className="md:hidden bg-white border-t p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </Button>
          
          <StreamingControls 
            roomId={roomId}
            room={room}
            compact
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowParticipants(!showParticipants)}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            People
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoomPageSkeleton() {
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <LoadingSkeleton className="h-6 w-48" />
          <LoadingSkeleton className="h-5 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <LoadingSkeleton className="h-8 w-20" />
          <LoadingSkeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 bg-gray-900 relative">
          <div className="w-full h-full flex items-center justify-center">
            <LoadingSkeleton className="w-32 h-32 rounded-full" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l">
          <div className="p-4 space-y-4">
            <LoadingSkeleton className="h-8 w-full" />
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <LoadingSkeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
