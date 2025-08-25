'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize,
  RadioIcon as Live,
  Users,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { LiveRoom } from '@/types/api';

interface LiveStreamingInterfaceProps {
  roomId: string;
  room: LiveRoom;
  isFullscreen: boolean;
}

export function LiveStreamingInterface({ roomId, room, isFullscreen }: LiveStreamingInterfaceProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Initialize WebRTC connection
    initializeWebRTC();
    
    return () => {
      // Cleanup WebRTC connections
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId]);

  const initializeWebRTC = async () => {
    try {
      setIsLoading(true);
      
      // Get user media (camera and microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      localStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Here we would initialize the actual WebRTC connection to the live-classes service
      // This would involve:
      // 1. Getting router capabilities from /live-classes/api/v1/rooms/{id}/webrtc/capabilities
      // 2. Creating WebRTC transports via /live-classes/api/v1/rooms/{id}/webrtc/transport
      // 3. Connecting transports via /live-classes/api/v1/rooms/{id}/webrtc/transport/connect
      // 4. Creating producers/consumers via /live-classes/api/v1/rooms/{id}/webrtc/produce and consume
      
      setIsConnected(true);
      setIsLoading(false);
      
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  const handleRetryConnection = () => {
    setHasError(false);
    initializeWebRTC();
  };

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-16 w-16 mx-auto text-red-500" />
          <div>
            <h3 className="text-lg font-semibold">Connection Failed</h3>
            <p className="text-gray-400">Unable to connect to the live stream.</p>
          </div>
          <Button onClick={handleRetryConnection} variant="outline">
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto"></div>
          <div>
            <h3 className="text-lg font-semibold">Connecting...</h3>
            <p className="text-gray-400">Setting up your video connection</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-gray-900">
      {/* Connection Status */}
      <div className="absolute top-4 left-4 z-10">
        <Badge 
          variant={isConnected ? "default" : "destructive"}
          className="flex items-center gap-2"
        >
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Disconnected
            </>
          )}
        </Badge>
      </div>

      {/* Live Indicator */}
      {room.status === 'live' && (
        <div className="absolute top-4 right-4 z-10">
          <Badge className="bg-red-500 text-white animate-pulse">
            <Live className="h-3 w-3 mr-1" />
            LIVE
          </Badge>
        </div>
      )}

      {/* Main Video Area */}
      <div className="w-full h-full flex items-center justify-center">
        {room.status === 'live' ? (
          <div className="relative w-full h-full">
            {/* Main Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Participant Videos Grid */}
            <div className="absolute bottom-4 right-4 flex gap-2">
              {participants.slice(0, 4).map((participant, index) => (
                <ParticipantVideo
                  key={participant.id || index}
                  participant={participant}
                  size="small"
                />
              ))}
              {participants.length > 4 && (
                <div className="w-20 h-16 bg-black/60 rounded flex items-center justify-center text-white text-xs">
                  +{participants.length - 4}
                </div>
              )}
            </div>

            {/* Screen Share Indicator */}
            {room.status === 'live' && (
              <div className="absolute bottom-4 left-4">
                <Badge variant="outline" className="text-white border-white/50 bg-black/30">
                  Screen Sharing: Off
                </Badge>
              </div>
            )}
          </div>
        ) : room.status === 'scheduled' ? (
          <div className="text-center text-white space-y-6">
            <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mx-auto">
              <Video className="h-16 w-16 text-gray-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Room Not Started</h3>
              <p className="text-gray-400 mb-4">
                The live session hasn't started yet. Please wait for the host to begin.
              </p>
              <div className="text-sm text-gray-500">
                Scheduled to start: {new Date(room.scheduledStartTime || Date.now()).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-white space-y-6">
            <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mx-auto">
              <VideoOff className="h-16 w-16 text-gray-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Session Ended</h3>
              <p className="text-gray-400">
                This live session has ended. Recordings may be available in your library.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Participant Count Overlay */}
      {room.status === 'live' && (
        <div className="absolute bottom-16 left-4">
          <div className="bg-black/60 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            {room.currentParticipants || 0} watching
          </div>
        </div>
      )}
    </div>
  );
}

interface ParticipantVideoProps {
  participant: any;
  size: 'small' | 'medium' | 'large';
}

function ParticipantVideo({ participant, size }: ParticipantVideoProps) {
  const dimensions = {
    small: 'w-20 h-16',
    medium: 'w-32 h-24',
    large: 'w-48 h-36',
  };

  return (
    <div className={`${dimensions[size]} bg-gray-800 rounded overflow-hidden relative`}>
      {participant.hasVideo ? (
        <video
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-medium">
              {participant.name?.[0] || '?'}
            </span>
          </div>
        </div>
      )}
      
      {/* Audio indicator */}
      <div className="absolute bottom-1 left-1">
        {participant.hasAudio ? (
          <Mic className="h-3 w-3 text-green-400" />
        ) : (
          <MicOff className="h-3 w-3 text-red-400" />
        )}
      </div>
      
      {/* Name overlay */}
      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
        {participant.name || 'Unknown'}
      </div>
    </div>
  );
}
