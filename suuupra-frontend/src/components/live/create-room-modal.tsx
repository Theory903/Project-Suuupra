'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  Video,
  MessageCircle,
  Share,
  Palette,
  Shield,
  Circle,
  Settings,
  Globe,
  Lock,
  Zap,
} from 'lucide-react';
import { useCreateLiveRoom } from '@/hooks/live/use-live-rooms';
import { toast } from 'sonner';

const createRoomSchema = z.object({
  title: z.string().min(1, 'Room title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  scheduledStartTime: z.string().min(1, 'Start time is required'),
  maxParticipants: z.number().min(1).max(1000).default(100),
  isPublic: z.boolean().default(true),
  settings: z.object({
    allowChat: z.boolean().default(true),
    allowScreenShare: z.boolean().default(true),
    allowWhiteboard: z.boolean().default(true),
    allowBreakoutRooms: z.boolean().default(false),
    muteParticipantsOnJoin: z.boolean().default(false),
    requireApprovalToJoin: z.boolean().default(false),
    recordingEnabled: z.boolean().default(false),
  }),
});

// Use the input type (before transformation) for the form
type CreateRoomForm = z.input<typeof createRoomSchema>;

interface CreateRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateRoomModal({ open, onOpenChange, onSuccess }: CreateRoomModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { mutate: createRoom, isPending } = useCreateLiveRoom();

  const form = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      title: '',
      description: '',
      scheduledStartTime: '',
      maxParticipants: 100,
      isPublic: true,
      settings: {
        allowChat: true,
        allowScreenShare: true,
        allowWhiteboard: true,
        allowBreakoutRooms: false,
        muteParticipantsOnJoin: false,
        requireApprovalToJoin: false,
        recordingEnabled: false,
      },
    },
  });

  // Set default start time to 15 minutes from now
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    const defaultTime = now.toISOString().slice(0, 16);
    form.setValue('scheduledStartTime', defaultTime);
  }, [form]);

  const onSubmit = async (data: CreateRoomForm) => {
    try {
      await createRoom({
        title: data.title,
        description: data.description,
        scheduledStartTime: data.scheduledStartTime,
        maxParticipants: data.maxParticipants,
        isPublic: data.isPublic,
        ...data.settings,
      });
      
      toast.success('Live room created successfully!');
      onSuccess();
      handleClose();
    } catch {
      toast.error('Failed to create room. Please try again.');
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    form.reset();
    onOpenChange(false);
  };

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Create Live Room
          </DialogTitle>
          <DialogDescription>
            Set up a new live class room with customizable features and settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center ${step < 3 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                <span className={`ml-2 text-sm ${
                  currentStep >= step ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {step === 1 && 'Basic Info'}
                  {step === 2 && 'Features'}
                  {step === 3 && 'Advanced'}
                </span>
                {step < 3 && (
                  <div className={`flex-1 h-px mx-4 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Basic Information
                  </CardTitle>
                  <CardDescription>
                    Set up the basic details for your live room.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Room Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter room title..."
                      {...form.register('title')}
                    />
                    {form.formState.errors.title && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this live session is about..."
                      rows={3}
                      {...form.register('description')}
                    />
                    {form.formState.errors.description && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="scheduledStartTime">Start Time *</Label>
                      <Input
                        id="scheduledStartTime"
                        type="datetime-local"
                        {...form.register('scheduledStartTime')}
                      />
                      {form.formState.errors.scheduledStartTime && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.scheduledStartTime.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="maxParticipants">Max Participants</Label>
                      <Input
                        id="maxParticipants"
                        type="number"
                        min="1"
                        max="1000"
                        {...form.register('maxParticipants', { valueAsNumber: true })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Room Visibility</Label>
                      <p className="text-sm text-muted-foreground">
                        Make this room discoverable by others
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Switch
                        checked={form.watch('isPublic')}
                        onCheckedChange={(checked) => form.setValue('isPublic', checked)}
                      />
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Features */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Interactive Features
                  </CardTitle>
                  <CardDescription>
                    Configure the interactive features available in your room.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FeatureToggle
                    icon={<MessageCircle className="h-4 w-4" />}
                    title="Chat"
                    description="Allow participants to send messages"
                    checked={form.watch('settings.allowChat') ?? true}
                    onCheckedChange={(checked) => form.setValue('settings.allowChat', checked)}
                  />

                  <FeatureToggle
                    icon={<Share className="h-4 w-4" />}
                    title="Screen Sharing"
                    description="Enable participants to share their screens"
                    checked={form.watch('settings.allowScreenShare') ?? true}
                    onCheckedChange={(checked) => form.setValue('settings.allowScreenShare', checked)}
                  />

                  <FeatureToggle
                    icon={<Palette className="h-4 w-4" />}
                    title="Whiteboard"
                    description="Provide a collaborative whiteboard"
                    checked={form.watch('settings.allowWhiteboard') ?? true}
                    onCheckedChange={(checked) => form.setValue('settings.allowWhiteboard', checked)}
                  />

                  <FeatureToggle
                    icon={<Users className="h-4 w-4" />}
                    title="Breakout Rooms"
                    description="Create smaller discussion groups"
                    checked={form.watch('settings.allowBreakoutRooms') ?? false}
                    onCheckedChange={(checked) => form.setValue('settings.allowBreakoutRooms', checked)}
                  />

                  <FeatureToggle
                    icon={<Circle className="h-4 w-4" />}
                    title="Recording"
                    description="Record the live session automatically"
                    checked={form.watch('settings.recordingEnabled') ?? false}
                    onCheckedChange={(checked) => form.setValue('settings.recordingEnabled', checked)}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Advanced Settings */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Advanced Settings
                  </CardTitle>
                  <CardDescription>
                    Fine-tune the room behavior and access controls.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FeatureToggle
                    title="Mute Participants on Join"
                    description="Automatically mute participants when they join"
                    checked={form.watch('settings.muteParticipantsOnJoin') ?? false}
                    onCheckedChange={(checked) => form.setValue('settings.muteParticipantsOnJoin', checked)}
                  />

                  <FeatureToggle
                    title="Require Approval to Join"
                    description="Manually approve participants before they can join"
                    checked={form.watch('settings.requireApprovalToJoin') ?? false}
                    onCheckedChange={(checked) => form.setValue('settings.requireApprovalToJoin', checked)}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Room Summary</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Title:</span>
                        <span className="font-medium">{form.watch('title') || 'Untitled Room'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Max Participants:</span>
                        <span className="font-medium">{form.watch('maxParticipants')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Visibility:</span>
                        <span className="font-medium">
                          {form.watch('isPublic') ? 'Public' : 'Private'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Features:</span>
                        <span className="font-medium">
                          {[
                            form.watch('settings.allowChat') && 'Chat',
                            form.watch('settings.allowScreenShare') && 'Screen Share',
                            form.watch('settings.allowWhiteboard') && 'Whiteboard',
                            form.watch('settings.allowBreakoutRooms') && 'Breakout Rooms',
                            form.watch('settings.recordingEnabled') && 'Recording'
                          ].filter(Boolean).length} enabled
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  Previous
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              
              {currentStep < 3 ? (
                <Button type="button" onClick={nextStep}>
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Creating...' : 'Create Room'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FeatureToggleProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function FeatureToggle({ icon, title, description, checked, onCheckedChange }: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between space-x-4">
      <div className="flex items-start space-x-3 flex-1">
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
