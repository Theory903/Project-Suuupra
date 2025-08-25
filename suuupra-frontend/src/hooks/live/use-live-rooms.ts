import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LiveClassesApi } from '@/lib/api-client';
import { LiveRoom } from '@/types/api';

export function useLiveRooms(status?: 'scheduled' | 'live' | 'ended') {
  return useQuery({
    queryKey: ['live-rooms', status],
    queryFn: () => LiveClassesApi.listRooms({ status }),
    refetchInterval: (query) => {
      // Auto-refresh every 30 seconds if there are live rooms
      const data = query.state.data as { rooms: LiveRoom[] } | undefined;
      const hasLiveRooms = data?.rooms?.some((room: LiveRoom) => room.status === 'live');
      return hasLiveRooms ? 30000 : false;
    },
  });
}

export function useCreateLiveRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      maxParticipants?: number;
      isPublic?: boolean;
      scheduledStartTime?: string;
      allowChat?: boolean;
      allowScreenShare?: boolean;
      allowWhiteboard?: boolean;
      allowBreakoutRooms?: boolean;
      muteParticipantsOnJoin?: boolean;
      requireApprovalToJoin?: boolean;
      recordingEnabled?: boolean;
    }) => LiveClassesApi.createRoom({
      name: data.title,
      description: data.description,
      scheduledAt: data.scheduledStartTime ? new Date(data.scheduledStartTime).toISOString() : new Date().toISOString(),
      maxParticipants: data.maxParticipants || 100,
      settings: {
        allowChat: data.allowChat ?? true,
        allowScreenShare: data.allowScreenShare ?? true,
        allowWhiteboard: data.allowWhiteboard ?? true,
        allowBreakoutRooms: data.allowBreakoutRooms ?? false,
        muteParticipantsOnJoin: data.muteParticipantsOnJoin ?? false,
        requireApprovalToJoin: data.requireApprovalToJoin ?? false,
        recordingEnabled: data.recordingEnabled ?? false,
      }
    }),
    onSuccess: () => {
      // Invalidate and refetch live rooms
      queryClient.invalidateQueries({ queryKey: ['live-rooms'] });
    },
  });
}

export function useJoinLiveRoom() {
  return useMutation({
    mutationFn: (roomId: string) => LiveClassesApi.joinRoom(roomId),
  });
}

export function useLiveRoom(roomId: string) {
  return useQuery({
    queryKey: ['live-room', roomId],
    queryFn: () => LiveClassesApi.getRoom(roomId),
    enabled: !!roomId,
    refetchInterval: 30000, // Refresh every 30 seconds for live updates
  });
}

// Hook for getting rooms by different statuses
export function useLiveRoomsByStatus() {
  const liveRooms = useLiveRooms('live');
  const scheduledRooms = useLiveRooms('scheduled');
  const endedRooms = useLiveRooms('ended');

  return {
    live: liveRooms,
    scheduled: scheduledRooms,
    ended: endedRooms,
    isLoading: liveRooms.isLoading || scheduledRooms.isLoading || endedRooms.isLoading,
    error: liveRooms.error || scheduledRooms.error || endedRooms.error,
  };
}
