'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSkeleton } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Video,
  Users,
  Clock,
  Calendar,
  Play,
  RadioIcon as Live,
  Globe,
  Lock,
  Mic,
  MicOff,
  VideoIcon,
  VideoOff,
  Settings,
  MoreHorizontal,
  UserPlus,
  Share,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { LiveRoom } from '@/types/api';
import { useJoinLiveRoom } from '@/hooks/live/use-live-rooms';
import { toast } from 'sonner';

interface LiveRoomsListProps {
  rooms?: LiveRoom[];
  loading: boolean;
  error: any;
  onRefresh: () => void;
}

export function LiveRoomsList({ rooms, loading, error, onRefresh }: LiveRoomsListProps) {
  const [activeTab, setActiveTab] = useState('live');
  const { mutate: joinRoom, isPending: isJoining } = useJoinLiveRoom();

  const handleJoinRoom = async (roomId: string) => {
    try {
      await joinRoom(roomId);
      toast.success('Successfully joined the room!');
      // Navigate to room page or open room interface
      window.location.href = `/live/room/${roomId}`;
    } catch (error) {
      toast.error('Failed to join room. Please try again.');
    }
  };

  const filteredRooms = rooms?.filter(room => {
    if (activeTab === 'live') return room.status === 'live';
    if (activeTab === 'scheduled') return room.status === 'scheduled';
    if (activeTab === 'ended') return room.status === 'ended';
    return true;
  }) || [];

  if (error) {
    return (
      <EmptyState
        title="Failed to load live rooms"
        description="There was an error loading the live rooms. Please try refreshing."
        action={{
          label: 'Refresh',
          onClick: onRefresh,
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Live className="h-4 w-4 text-red-500" />
            Live Now
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Scheduled
          </TabsTrigger>
          <TabsTrigger value="ended" className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            Recent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-6">
          <RoomsGrid 
            rooms={filteredRooms} 
            loading={loading} 
            status="live" 
            onJoinRoom={handleJoinRoom}
            isJoining={isJoining}
          />
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          <RoomsGrid 
            rooms={filteredRooms} 
            loading={loading} 
            status="scheduled" 
            onJoinRoom={handleJoinRoom}
            isJoining={isJoining}
          />
        </TabsContent>

        <TabsContent value="ended" className="mt-6">
          <RoomsGrid 
            rooms={filteredRooms} 
            loading={loading} 
            status="ended" 
            onJoinRoom={handleJoinRoom}
            isJoining={isJoining}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface RoomsGridProps {
  rooms: LiveRoom[];
  loading: boolean;
  status: 'live' | 'scheduled' | 'ended';
  onJoinRoom: (roomId: string) => void;
  isJoining: boolean;
}

function RoomsGrid({ rooms, loading, status, onJoinRoom, isJoining }: RoomsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-3">
              <LoadingSkeleton className="h-6 w-3/4 mb-2" />
              <LoadingSkeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <LoadingSkeleton className="h-4 w-1/2" />
              <LoadingSkeleton className="h-4 w-2/3" />
              <LoadingSkeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <EmptyState
        title={getEmptyStateTitle(status)}
        description={getEmptyStateDescription(status)}
        action={status === 'scheduled' ? {
          label: 'Create Room',
          onClick: () => {
            // This would open the create room modal
            const event = new CustomEvent('openCreateRoomModal');
            window.dispatchEvent(event);
          },
        } : undefined}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => (
        <RoomCard 
          key={room.id} 
          room={room} 
          status={status}
          onJoinRoom={onJoinRoom}
          isJoining={isJoining}
        />
      ))}
    </div>
  );
}

interface RoomCardProps {
  room: LiveRoom;
  status: 'live' | 'scheduled' | 'ended';
  onJoinRoom: (roomId: string) => void;
  isJoining: boolean;
}

function RoomCard({ room, status, onJoinRoom, isJoining }: RoomCardProps) {
  const getStatusBadge = () => {
    switch (room.status) {
      case 'live':
        return <Badge className="bg-red-500 text-white animate-pulse">
          <Live className="h-3 w-3 mr-1" />
          LIVE
        </Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Calendar className="h-3 w-3 mr-1" />
          Scheduled
        </Badge>;
      case 'ended':
        return <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Ended
        </Badge>;
      default:
        return null;
    }
  };

  const getTimeInfo = () => {
    if (room.status === 'live') {
      return `Live for ${formatDistanceToNow(new Date(room.scheduledStartTime || Date.now()))}`;
    }
    if (room.status === 'scheduled') {
      return `Starts ${formatDistanceToNow(new Date(room.scheduledStartTime || Date.now()))} from now`;
    }
    if (room.status === 'ended') {
      return `Ended ${formatDistanceToNow(new Date(room.scheduledStartTime || Date.now()))} ago`;
    }
    return '';
  };

  const canJoin = room.status === 'live' || (room.status === 'scheduled' && 
    new Date(room.scheduledStartTime || Date.now()) <= new Date());

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors line-clamp-2">
              {room.title}
            </CardTitle>
            {room.description && (
              <CardDescription className="line-clamp-2">
                {room.description}
              </CardDescription>
            )}
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Room Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {room.currentParticipants || 0}/{room.maxParticipants || 0}
          </div>
          <div className="flex items-center gap-1">
            {room.isPublic ? (
              <>
                <Globe className="h-4 w-4" />
                Public
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Private
              </>
            )}
          </div>
        </div>

        {/* Time Info */}
        <div className="text-sm text-muted-foreground">
          <Clock className="h-4 w-4 inline mr-1" />
          {getTimeInfo()}
        </div>

        {/* Instructor Info */}
        {room.hostId && (
          <div className="text-sm text-muted-foreground">
            <UserPlus className="h-4 w-4 inline mr-1" />
            Host ID: {room.hostId}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {canJoin ? (
            <Button 
              onClick={() => onJoinRoom(room.id)}
              disabled={isJoining}
              className="flex-1"
              size="sm"
            >
              {room.status === 'live' ? (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Join Live
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Join
                </>
              )}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="flex-1"
              size="sm"
              disabled
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          )}
          
          <Button variant="outline" size="sm">
            <Share className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Media Controls Preview (for live rooms) */}
        {room.status === 'live' && (
          <div className="flex items-center justify-center gap-2 pt-2 border-t">
            <div className="text-xs text-muted-foreground flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Mic className="h-3 w-3" />
                Audio
              </div>
              <div className="flex items-center gap-1">
                <VideoIcon className="h-3 w-3" />
                Video
              </div>
              <div className="flex items-center gap-1">
                <Share className="h-3 w-3" />
                Screen
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getEmptyStateTitle(status: string): string {
  switch (status) {
    case 'live':
      return 'No live sessions';
    case 'scheduled':
      return 'No scheduled sessions';
    case 'ended':
      return 'No recent sessions';
    default:
      return 'No rooms found';
  }
}

function getEmptyStateDescription(status: string): string {
  switch (status) {
    case 'live':
      return 'There are no live classes happening right now. Check back later or view scheduled sessions.';
    case 'scheduled':
      return 'No upcoming live sessions are scheduled. Create a new room to get started.';
    case 'ended':
      return 'No recent live sessions to display. Recordings may be available in your library.';
    default:
      return 'No rooms are available at the moment.';
  }
}
