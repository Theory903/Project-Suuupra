'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Shield,
  Crown,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  Volume2,
  VolumeX,
  Ban,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Participant {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'instructor' | 'student' | 'moderator';
  joinedAt: Date;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

interface ParticipantsListProps {
  roomId: string;
  compact?: boolean;
}

export function ParticipantsList({ roomId, compact = false }: ParticipantsListProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joinedAt'>('role');

  useEffect(() => {
    loadParticipants();
    
    // Set up real-time participant updates
    const interval = setInterval(loadParticipants, 5000);
    
    return () => clearInterval(interval);
  }, [roomId]);

  const loadParticipants = async () => {
    try {
      // Mock participants for demo - in real implementation would call API
      // GET /live-classes/api/v1/rooms/{roomId}/participants
      const mockParticipants: Participant[] = [
        {
          id: '1',
          userId: 'instructor-1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'instructor',
          joinedAt: new Date(Date.now() - 300000),
          isAudioEnabled: true,
          isVideoEnabled: true,
          isScreenSharing: false,
          isHandRaised: false,
          connectionStatus: 'connected',
        },
        {
          id: '2',
          userId: 'student-1',
          name: 'Alice Smith',
          email: 'alice@example.com',
          role: 'student',
          joinedAt: new Date(Date.now() - 240000),
          isAudioEnabled: true,
          isVideoEnabled: false,
          isScreenSharing: false,
          isHandRaised: true,
          connectionStatus: 'connected',
        },
        {
          id: '3',
          userId: 'student-2',
          name: 'Bob Johnson',
          email: 'bob@example.com',
          role: 'student',
          joinedAt: new Date(Date.now() - 180000),
          isAudioEnabled: false,
          isVideoEnabled: true,
          isScreenSharing: false,
          isHandRaised: false,
          connectionStatus: 'connected',
        },
        {
          id: '4',
          userId: 'moderator-1',
          name: 'Carol Williams',
          email: 'carol@example.com',
          role: 'moderator',
          joinedAt: new Date(Date.now() - 120000),
          isAudioEnabled: true,
          isVideoEnabled: true,
          isScreenSharing: false,
          isHandRaised: false,
          connectionStatus: 'connected',
        },
      ];
      
      setParticipants(mockParticipants);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load participants:', error);
      setIsLoading(false);
    }
  };

  const filteredParticipants = participants
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'role') {
        const roleOrder = { instructor: 0, moderator: 1, student: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'joinedAt') {
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      }
      return 0;
    });

  const handleMuteParticipant = async (participantId: string) => {
    try {
      // Call API to mute participant
      toast.success('Participant muted');
    } catch (error) {
      toast.error('Failed to mute participant');
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      // Call API to remove participant
      toast.success('Participant removed');
    } catch (error) {
      toast.error('Failed to remove participant');
    }
  };

  const handlePromoteToModerator = async (participantId: string) => {
    try {
      // Call API to promote participant
      toast.success('Participant promoted to moderator');
    } catch (error) {
      toast.error('Failed to promote participant');
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Participants ({participants.length})</span>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          {participants.slice(0, 5).map((participant) => (
            <div key={participant.id} className="flex items-center gap-2 py-1">
              <ParticipantAvatar participant={participant} size="sm" />
              <span className="text-sm truncate flex-1">{participant.name}</span>
              {participant.role === 'instructor' && <Crown className="h-3 w-3 text-yellow-500" />}
              {participant.role === 'moderator' && <Shield className="h-3 w-3 text-blue-500" />}
            </div>
          ))}
          {participants.length > 5 && (
            <div className="text-xs text-muted-foreground py-1">
              +{participants.length - 5} more participants
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <span className="font-semibold">Participants ({participants.length})</span>
        </div>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search participants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Participants List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Raised Hands First */}
            {filteredParticipants.filter(p => p.isHandRaised).map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                onMute={() => handleMuteParticipant(participant.id)}
                onRemove={() => handleRemoveParticipant(participant.id)}
                onPromote={() => handlePromoteToModerator(participant.id)}
                highlighted
              />
            ))}
            
            {/* Other Participants */}
            {filteredParticipants.filter(p => !p.isHandRaised).map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                onMute={() => handleMuteParticipant(participant.id)}
                onRemove={() => handleRemoveParticipant(participant.id)}
                onPromote={() => handlePromoteToModerator(participant.id)}
              />
            ))}
            
            {filteredParticipants.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No participants found</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ParticipantItemProps {
  participant: Participant;
  onMute: () => void;
  onRemove: () => void;
  onPromote: () => void;
  highlighted?: boolean;
}

function ParticipantItem({ participant, onMute, onRemove, onPromote, highlighted = false }: ParticipantItemProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors",
      highlighted && "bg-yellow-50 border border-yellow-200"
    )}>
      <ParticipantAvatar participant={participant} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{participant.name}</span>
          {participant.role === 'instructor' && (
            <Crown className="h-4 w-4 text-yellow-500" title="Instructor" />
          )}
          {participant.role === 'moderator' && (
            <Shield className="h-4 w-4 text-blue-500" title="Moderator" />
          )}
          {participant.isHandRaised && (
            <Hand className="h-4 w-4 text-orange-500 animate-bounce" title="Hand raised" />
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {participant.email}
        </div>
      </div>

      {/* Media Status */}
      <div className="flex items-center gap-1">
        {participant.isAudioEnabled ? (
          <Mic className="h-4 w-4 text-green-500" />
        ) : (
          <MicOff className="h-4 w-4 text-red-500" />
        )}
        {participant.isVideoEnabled ? (
          <Video className="h-4 w-4 text-green-500" />
        ) : (
          <VideoOff className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {/* Connection Status */}
      <div className={cn(
        "w-2 h-2 rounded-full",
        participant.connectionStatus === 'connected' && "bg-green-500",
        participant.connectionStatus === 'connecting' && "bg-yellow-500",
        participant.connectionStatus === 'disconnected' && "bg-red-500"
      )} />

      {/* Actions Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onMute}>
            <VolumeX className="h-4 w-4 mr-2" />
            Mute Participant
          </DropdownMenuItem>
          {participant.role === 'student' && (
            <DropdownMenuItem onClick={onPromote}>
              <Shield className="h-4 w-4 mr-2" />
              Promote to Moderator
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRemove} className="text-red-600">
            <Ban className="h-4 w-4 mr-2" />
            Remove from Room
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ParticipantAvatarProps {
  participant: Participant;
  size?: 'sm' | 'md' | 'lg';
}

function ParticipantAvatar({ participant, size = 'md' }: ParticipantAvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className={cn(
      "bg-gray-200 rounded-full flex items-center justify-center font-medium text-gray-600 flex-shrink-0",
      sizeClasses[size],
      participant.role === 'instructor' && "bg-yellow-100 text-yellow-800",
      participant.role === 'moderator' && "bg-blue-100 text-blue-800"
    )}>
      {participant.name.charAt(0).toUpperCase()}
    </div>
  );
}
