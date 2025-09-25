'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Share,
  Hand,
  HandMetal,
  Phone,
  PhoneOff,
  Settings,
  Volume2,
  VolumeX,
  Users,
  MessageCircle,
  Circle as Record,
  StopCircle,
  Palette,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveRoom } from '@/types/api';
import { toast } from 'sonner';

interface StreamingControlsProps {
  roomId: string;
  room: LiveRoom;
  compact?: boolean;
}

export function StreamingControls({ roomId, room, compact = false }: StreamingControlsProps) {
  const [mediaState, setMediaState] = useState({
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,
    isHandRaised: false,
    isRecording: false,
  });
  
  const [deviceState, setDeviceState] = useState({
    hasVideoPermission: true,
    hasAudioPermission: true,
    availableCameras: [],
    availableMicrophones: [],
    selectedCamera: null,
    selectedMicrophone: null,
  });

  useEffect(() => {
    // Initialize device permissions and enumeration
    initializeDevices();
  }, []);

  const initializeDevices = async () => {
    try {
      // Check media permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      setDeviceState(prev => ({
        ...prev,
        availableCameras: cameras,
        availableMicrophones: microphones,
        selectedCamera: cameras[0]?.deviceId || null,
        selectedMicrophone: microphones[0]?.deviceId || null,
      }));
      
    } catch (error) {
      console.error('Failed to initialize devices:', error);
      setDeviceState(prev => ({
        ...prev,
        hasVideoPermission: false,
        hasAudioPermission: false,
      }));
      toast.error('Please allow camera and microphone access');
    }
  };

  const toggleVideo = async () => {
    try {
      const newState = !mediaState.isVideoEnabled;
      setMediaState(prev => ({ ...prev, isVideoEnabled: newState }));
      
      // Here we would integrate with the WebRTC connection to enable/disable video
      // This would use the MediaSoup API endpoints for producer management
      
      toast.success(newState ? 'Camera enabled' : 'Camera disabled');
    } catch (error) {
      toast.error('Failed to toggle camera');
    }
  };

  const toggleAudio = async () => {
    try {
      const newState = !mediaState.isAudioEnabled;
      setMediaState(prev => ({ ...prev, isAudioEnabled: newState }));
      
      // Here we would integrate with the WebRTC connection to enable/disable audio
      
      toast.success(newState ? 'Microphone enabled' : 'Microphone disabled');
    } catch (error) {
      toast.error('Failed to toggle microphone');
    }
  };

  const toggleScreenShare = async () => {
    try {
      const newState = !mediaState.isScreenSharing;
      
      if (newState) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        
        // Here we would create a screen share producer via the live-classes API
        
        setMediaState(prev => ({ ...prev, isScreenSharing: true }));
        toast.success('Screen sharing started');
        
        screenStream.getVideoTracks()[0].onended = () => {
          setMediaState(prev => ({ ...prev, isScreenSharing: false }));
          toast.info('Screen sharing ended');
        };
      } else {
        // Stop screen sharing
        setMediaState(prev => ({ ...prev, isScreenSharing: false }));
        toast.success('Screen sharing stopped');
      }
    } catch (error) {
      toast.error('Failed to toggle screen sharing');
    }
  };

  const toggleHandRaise = async () => {
    try {
      const newState = !mediaState.isHandRaised;
      setMediaState(prev => ({ ...prev, isHandRaised: newState }));
      
      // Send hand raise event via WebSocket to other participants
      
      toast.success(newState ? 'Hand raised' : 'Hand lowered');
    } catch (error) {
      toast.error('Failed to toggle hand raise');
    }
  };

  const toggleRecording = async () => {
    try {
      const newState = !mediaState.isRecording;
      
      if (newState) {
        // Start recording via API: POST /live-classes/api/v1/recording/{roomId}/start
        setMediaState(prev => ({ ...prev, isRecording: true }));
        toast.success('Recording started');
      } else {
        // Stop recording via API: POST /live-classes/api/v1/recording/{roomId}/stop
        setMediaState(prev => ({ ...prev, isRecording: false }));
        toast.success('Recording stopped');
      }
    } catch (error) {
      toast.error('Failed to toggle recording');
    }
  };

  const leaveRoom = async () => {
    try {
      // Leave room via API: POST /live-classes/api/v1/rooms/{roomId}/leave
      window.location.href = '/live';
    } catch (error) {
      toast.error('Failed to leave room');
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={mediaState.isAudioEnabled ? "default" : "destructive"}
          size="sm"
          onClick={toggleAudio}
        >
          {mediaState.isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        
        <Button
          variant={mediaState.isVideoEnabled ? "default" : "secondary"}
          size="sm"
          onClick={toggleVideo}
        >
          {mediaState.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        
        <Button variant="destructive" size="sm" onClick={leaveRoom}>
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg border shadow-lg px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Audio Control */}
        <div className="flex items-center gap-2">
          <Button
            variant={mediaState.isAudioEnabled ? "default" : "destructive"}
            size="sm"
            onClick={toggleAudio}
            className="relative"
          >
            {mediaState.isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          
          {/* Audio Device Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {deviceState.availableMicrophones.map((mic: any) => (
                <DropdownMenuItem key={mic.deviceId} onClick={() => {
                  setDeviceState(prev => ({ ...prev, selectedMicrophone: mic.deviceId }));
                }}>
                  {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Video Control */}
        <div className="flex items-center gap-2">
          <Button
            variant={mediaState.isVideoEnabled ? "default" : "secondary"}
            size="sm"
            onClick={toggleVideo}
          >
            {mediaState.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          
          {/* Camera Device Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {deviceState.availableCameras.map((camera: any) => (
                <DropdownMenuItem key={camera.deviceId} onClick={() => {
                  setDeviceState(prev => ({ ...prev, selectedCamera: camera.deviceId }));
                }}>
                  {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Screen Share */}
        <Button
          variant={mediaState.isScreenSharing ? "default" : "outline"}
          size="sm"
          onClick={toggleScreenShare}
        >
          {mediaState.isScreenSharing ? <Share className="h-4 w-4" /> : <Share className="h-4 w-4" />}
        </Button>

        {/* Raise Hand */}
        <Button
          variant={mediaState.isHandRaised ? "default" : "outline"}
          size="sm"
          onClick={toggleHandRaise}
          className={mediaState.isHandRaised ? "animate-pulse" : ""}
        >
          <Hand className="h-4 w-4" />
        </Button>

        {/* Recording (Host only) */}
        {(room.hostId === 'current-user-id') && (
          <Button
            variant={mediaState.isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={toggleRecording}
            className={mediaState.isRecording ? "animate-pulse" : ""}
          >
            {mediaState.isRecording ? <StopCircle className="h-4 w-4" /> : <Record className="h-4 w-4" />}
          </Button>
        )}

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300" />

        {/* More Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Volume2 className="h-4 w-4 mr-2" />
              Audio Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Palette className="h-4 w-4 mr-2" />
              Background Effects
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Users className="h-4 w-4 mr-2" />
              Participant List
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Leave Room */}
        <Button variant="destructive" size="sm" onClick={leaveRoom}>
          <PhoneOff className="h-4 w-4 mr-2" />
          Leave
        </Button>
      </div>

      {/* Status Indicators */}
      {(mediaState.isRecording || mediaState.isScreenSharing) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          {mediaState.isRecording && (
            <Badge className="bg-red-500 text-white animate-pulse">
              <Record className="h-3 w-3 mr-1" />
              Recording
            </Badge>
          )}
          {mediaState.isScreenSharing && (
            <Badge className="bg-blue-500 text-white">
              <Share className="h-3 w-3 mr-1" />
              Sharing Screen
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
