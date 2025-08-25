import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MassLiveApi } from '@/lib/api-client';
import { MassLiveStream } from '@/types/api';

// Note: The API spec shows that mass live endpoints return different response structures
// We need to adapt this based on the actual API responses

export function useMassStreams() {
  return useQuery({
    queryKey: ['mass-streams'],
    queryFn: async () => {
      // Since the API spec doesn't show a list endpoint, we'll need to mock or adapt
      // For now, returning a structure similar to live rooms
      return { streams: [] as MassLiveStream[] };
    },
    refetchInterval: (data) => {
      // Auto-refresh every 30 seconds if there are live streams
      const hasLiveStreams = data?.streams?.some(stream => stream.status === 'live');
      return hasLiveStreams ? 30000 : false;
    },
  });
}

export function useCreateMassStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      scheduledStartTime: string;
      maxViewers?: number;
      enableChat?: boolean;
    }) => MassLiveApi.createStream(data),
    onSuccess: () => {
      // Invalidate and refetch mass streams
      queryClient.invalidateQueries({ queryKey: ['mass-streams'] });
    },
  });
}

export function useStartMassStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ streamId, streamKey }: { streamId: string; streamKey: string }) => 
      MassLiveApi.startStream(streamId, { streamKey }),
    onSuccess: () => {
      // Invalidate and refetch mass streams
      queryClient.invalidateQueries({ queryKey: ['mass-streams'] });
    },
  });
}

export function useMassStream(streamId: string) {
  return useQuery({
    queryKey: ['mass-stream', streamId],
    queryFn: async () => {
      // Since there's no specific get stream endpoint in the spec,
      // we'd need to implement this based on actual API
      const streams = await useMassStreams().queryFn?.();
      return streams?.streams?.find(stream => stream.id === streamId);
    },
    enabled: !!streamId,
    refetchInterval: 10000, // Refresh every 10 seconds for live updates
  });
}
