import * as mediasoup from 'mediasoup';

export interface Room {
  id: string;
  name: string;
  description?: string;
  instructorId: string;
  status: 'scheduled' | 'active' | 'ended';
  maxParticipants: number;
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  isRecording: boolean;
  recordingUrl?: string;
  settings: RoomSettings;
  participants: Map<string, Participant>;
  router?: mediasoup.types.Router;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomSettings {
  allowChat: boolean;
  allowScreenShare: boolean;
  allowWhiteboard: boolean;
  allowBreakoutRooms: boolean;
  muteParticipantsOnJoin: boolean;
  requireApprovalToJoin: boolean;
  recordingEnabled: boolean;
}

export interface Participant {
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
  transport?: {
    producer?: mediasoup.types.WebRtcTransport;
    consumer?: mediasoup.types.WebRtcTransport;
  };
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'file' | 'system';
  metadata?: {
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  };
}

export interface Recording {
  id: string;
  roomId: string;
  instructorId: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  filePath?: string;
  s3Url?: string;
  duration?: number;
  fileSize?: number;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
  roomId?: string;
}

export interface WebRTCStats {
  roomId: string;
  participantId: string;
  stats: {
    inboundRtp: any[];
    outboundRtp: any[];
    candidatePair: any[];
    transport: any[];
  };
  timestamp: Date;
}

export interface RoomAnalytics {
  roomId: string;
  totalParticipants: number;
  peakParticipants: number;
  duration: number;
  chatMessages: number;
  screenShareSessions: number;
  recordingDuration?: number;
  participantEngagement: {
    userId: string;
    joinTime: Date;
    leaveTime?: Date;
    audioTime: number;
    videoTime: number;
    chatMessages: number;
  }[];
}

export interface BreakoutRoom {
  id: string;
  parentRoomId: string;
  name: string;
  participants: string[];
  createdAt: Date;
  endedAt?: Date;
  router?: mediasoup.types.Router;
}

export interface WhiteboardState {
  roomId: string;
  elements: any[];
  version: number;
  lastModified: Date;
  modifiedBy: string;
}

export interface ScreenShareSession {
  id: string;
  roomId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  producer?: mediasoup.types.Producer;
}
