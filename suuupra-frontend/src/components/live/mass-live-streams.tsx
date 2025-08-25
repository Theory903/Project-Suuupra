'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  RadioIcon as Live,
  Globe,
  Users,
  Clock,
  Calendar,
  Play,
  Eye,
  Settings,
  MoreHorizontal,
  Share,
  MessageCircle,
  Maximize,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MassLiveStream } from '@/types/api';
import { toast } from 'sonner';

interface MassLiveStreamsProps {
  streams?: MassLiveStream[];
  loading: boolean;
  error: any;
  onRefresh: () => void;
}

export function MassLiveStreams({ streams, loading, error, onRefresh }: MassLiveStreamsProps) {
  const [selectedStream, setSelectedStream] = useState<string | null>(null);

  const handleJoinStream = async (streamId: string) => {
    try {
      // Navigate to mass stream viewer
      window.location.href = `/live/stream/${streamId}`;
      toast.success('Joining stream...');
    } catch (error) {
      toast.error('Failed to join stream. Please try again.');
    }
  };

  const handleStartStream = async (streamId: string) => {
    try {
      // This would integrate with the mass live API to start streaming
      toast.success('Stream started successfully!');
      onRefresh();
    } catch (error) {
      toast.error('Failed to start stream.');
    }
  };

  if (error) {
    return (
      <EmptyState
        title="Failed to load streams"
        description="There was an error loading the mass live streams. Please try refreshing."
        action={{
          label: 'Refresh',
          onClick: onRefresh,
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingStreamCards />
      </div>
    );
  }

  const liveStreams = streams?.filter(stream => stream.status === 'live') || [];
  const scheduledStreams = streams?.filter(stream => stream.status === 'scheduled') || [];
  const endedStreams = streams?.filter(stream => stream.status === 'ended') || [];

  return (
    <div className="space-y-8">
      {/* Live Streams */}
      {liveStreams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Live className="h-5 w-5 text-red-500 animate-pulse" />
            <h2 className="text-xl font-semibold">Live Now</h2>
            <Badge className="bg-red-500 text-white">
              {liveStreams.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {liveStreams.map((stream) => (
              <MassStreamCard
                key={stream.id}
                stream={stream}
                onJoinStream={handleJoinStream}
                onStartStream={handleStartStream}
                isSelected={selectedStream === stream.id}
                onSelect={() => setSelectedStream(stream.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Streams */}
      {scheduledStreams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-semibold">Upcoming Streams</h2>
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              {scheduledStreams.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scheduledStreams.map((stream) => (
              <MassStreamCard
                key={stream.id}
                stream={stream}
                onJoinStream={handleJoinStream}
                onStartStream={handleStartStream}
                isSelected={selectedStream === stream.id}
                onSelect={() => setSelectedStream(stream.id)}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Streams */}
      {endedStreams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-semibold">Recent Streams</h2>
            <Badge variant="secondary">
              {endedStreams.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {endedStreams.map((stream) => (
              <MassStreamCard
                key={stream.id}
                stream={stream}
                onJoinStream={handleJoinStream}
                onStartStream={handleStartStream}
                isSelected={selectedStream === stream.id}
                onSelect={() => setSelectedStream(stream.id)}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {streams?.length === 0 && (
        <EmptyState
          title="No mass live streams"
          description="There are no mass streaming events available. Create a new stream to reach large audiences."
          action={{
            label: 'Create Stream',
            onClick: () => {
              const event = new CustomEvent('openCreateStreamModal');
              window.dispatchEvent(event);
            },
          }}
        />
      )}
    </div>
  );
}

interface MassStreamCardProps {
  stream: MassLiveStream;
  onJoinStream: (streamId: string) => void;
  onStartStream: (streamId: string) => void;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}

function MassStreamCard({ 
  stream, 
  onJoinStream, 
  onStartStream, 
  isSelected, 
  onSelect,
  compact = false 
}: MassStreamCardProps) {
  const getStatusBadge = () => {
    switch (stream.status) {
      case 'live':
        return (
          <Badge className="bg-red-500 text-white animate-pulse">
            <Live className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Calendar className="h-3 w-3 mr-1" />
            Scheduled
          </Badge>
        );
      case 'ended':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Ended
          </Badge>
        );
      default:
        return null;
    }
  };

  const getViewerCount = () => {
    // Mock viewer count - in real implementation this would come from the stream data
    if (stream.status === 'live') {
      return Math.floor(Math.random() * 10000) + 100;
    }
    return 0;
  };

  const isLive = stream.status === 'live';
  const canJoin = isLive;
  const canStart = stream.status === 'scheduled';

  return (
    <Card 
      className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${compact ? '' : 'lg:aspect-video'}`}
      onClick={onSelect}
    >
      {!compact && isLive && (
        <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-700">
          {/* Stream Preview */}
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center text-white">
              <Play className="h-12 w-12 mx-auto mb-2 opacity-80" />
              <p className="text-sm opacity-80">Live Stream Preview</p>
            </div>
          </div>
          
          {/* Live Badge */}
          <div className="absolute top-4 left-4">
            {getStatusBadge()}
          </div>
          
          {/* Viewer Count */}
          {isLive && (
            <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 rounded text-sm">
              <Eye className="h-3 w-3 inline mr-1" />
              {getViewerCount().toLocaleString()}
            </div>
          )}
          
          {/* Stream Controls */}
          <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="secondary">
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CardHeader className={compact ? "pb-3" : ""}>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className={`group-hover:text-blue-600 transition-colors line-clamp-2 ${
              compact ? 'text-base' : 'text-lg'
            }`}>
              {stream.title}
            </CardTitle>
          </div>
          {compact && getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stream Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {isLive && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {getViewerCount().toLocaleString()} watching
            </div>
          )}
          <div className="flex items-center gap-1">
            <Globe className="h-4 w-4" />
            Public
          </div>
          {stream.status === 'live' && (
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              Chat
            </div>
          )}
        </div>

        {/* Time Info */}
        <div className="text-sm text-muted-foreground">
          <Clock className="h-4 w-4 inline mr-1" />
          {stream.status === 'live' && 'Broadcasting now'}
          {stream.status === 'scheduled' && 'Starts soon'}
          {stream.status === 'ended' && 'Stream ended'}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {canJoin && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onJoinStream(stream.id);
              }}
              className="flex-1"
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Watch Live
            </Button>
          )}
          
          {canStart && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onStartStream(stream.id);
              }}
              className="flex-1"
              size="sm"
            >
              <Live className="h-4 w-4 mr-2" />
              Go Live
            </Button>
          )}
          
          {!canJoin && !canStart && (
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
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Share className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingStreamCards() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <LoadingSkeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <LoadingSkeleton className="aspect-video" />
              <CardHeader>
                <LoadingSkeleton className="h-6 w-3/4" />
                <LoadingSkeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <LoadingSkeleton className="h-4 w-20" />
                  <LoadingSkeleton className="h-4 w-16" />
                  <LoadingSkeleton className="h-4 w-12" />
                </div>
                <LoadingSkeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
