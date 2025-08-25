'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeleton } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Video,
  Users,
  Plus,
  Calendar,
  Clock,
  Play,
  RadioIcon as Live,
  Globe,
  Lock,
  Mic,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { CreateRoomModal } from '@/components/live/create-room-modal';
import { LiveRoomsList } from '@/components/live/live-rooms-list';
import { MassLiveStreams } from '@/components/live/mass-live-streams';
import { useLiveRooms } from '@/hooks/live/use-live-rooms';
import { useMassStreams } from '@/hooks/live/use-mass-streams';

export default function LivePage() {
  const [activeTab, setActiveTab] = useState('rooms');
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isCreateStreamOpen, setIsCreateStreamOpen] = useState(false);

  const { data: rooms, isLoading: roomsLoading, error: roomsError, refetch: refetchRooms } = useLiveRooms();
  const { data: streams, isLoading: streamsLoading, error: streamsError, refetch: refetchStreams } = useMassStreams();

  const handleCreateRoom = () => {
    setIsCreateRoomOpen(true);
  };

  const handleCreateStream = () => {
    setIsCreateStreamOpen(true);
  };

  const onRoomCreated = () => {
    setIsCreateRoomOpen(false);
    refetchRooms();
  };

  const onStreamCreated = () => {
    setIsCreateStreamOpen(false);
    refetchStreams();
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Live Streaming"
          description="Join live classes, create rooms, and stream to large audiences."
        />
        <div className="flex gap-2">
          <Button onClick={handleCreateRoom} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Room
          </Button>
          <Button onClick={handleCreateStream} variant="outline" className="flex items-center gap-2">
            <Live className="h-4 w-4" />
            Start Mass Stream
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Now</CardTitle>
            <Live className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {roomsLoading ? (
                <LoadingSkeleton className="h-8 w-12" />
              ) : (
                rooms?.rooms?.filter(room => room.status === 'live').length || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Active live sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {roomsLoading ? (
                <LoadingSkeleton className="h-8 w-12" />
              ) : (
                rooms?.rooms?.filter(room => room.status === 'scheduled').length || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upcoming sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {roomsLoading ? (
                <LoadingSkeleton className="h-8 w-12" />
              ) : (
                rooms?.rooms?.reduce((total, room) => total + (room.currentParticipants || 0), 0) || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Active participants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mass Streams</CardTitle>
            <Globe className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {streamsLoading ? (
                <LoadingSkeleton className="h-8 w-12" />
              ) : (
                streams?.streams?.filter(stream => stream.status === 'live').length || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Broadcasting now
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Live Rooms
          </TabsTrigger>
          <TabsTrigger value="streams" className="flex items-center gap-2">
            <Live className="h-4 w-4" />
            Mass Streams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6">
          <LiveRoomsList 
            rooms={rooms?.rooms} 
            loading={roomsLoading} 
            error={roomsError} 
            onRefresh={refetchRooms}
          />
        </TabsContent>

        <TabsContent value="streams" className="space-y-6">
          <MassLiveStreams 
            streams={streams?.streams} 
            loading={streamsLoading} 
            error={streamsError} 
            onRefresh={refetchStreams}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateRoomModal 
        open={isCreateRoomOpen} 
        onOpenChange={setIsCreateRoomOpen}
        onSuccess={onRoomCreated}
      />
    </div>
  );
}
