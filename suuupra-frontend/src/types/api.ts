// Minimal API types aligned with suuupra-complete-api-spec.yaml

export type Uuid = string;

export interface User {
  id: Uuid;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: 'USER' | 'ADMIN' | 'CREATOR' | 'INSTRUCTOR';
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface CartItem {
  productId: Uuid;
  quantity: number;
  price?: number;
  productName?: string;
  productImage?: string;
}

export interface Cart {
  id: Uuid;
  userId?: Uuid;
  items: CartItem[];
  totalAmount?: number;
  currency?: string;
  status?: 'active' | 'checkout' | 'completed' | 'abandoned';
  createdAt?: string;
  updatedAt?: string;
}

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface OrderItem {
  productId: Uuid;
  quantity: number;
  price?: number;
  productName?: string;
}

export interface Order {
  id: Uuid;
  userId?: Uuid;
  items: OrderItem[];
  totalAmount?: number;
  status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress?: Address;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt?: string;
}

export interface PaymentIntent {
  id: Uuid;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  orderId?: Uuid;
  createdAt?: string;
}

export interface Payment {
  id: Uuid;
  paymentIntentId: Uuid;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod?: Record<string, unknown>;
  transactionId?: string;
  processedAt?: string;
}

export interface ContentItem {
  id: Uuid;
  title: string;
  description?: string;
  type?: 'course' | 'lesson' | 'article' | 'video' | 'document';
  category?: string;
  tags?: string[];
  authorId?: Uuid;
  status?: 'draft' | 'published' | 'archived';
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type?: string;
  score?: number;
}

export interface LiveRoom {
  id: Uuid;
  title: string;
  description?: string;
  status?: 'scheduled' | 'live' | 'ended';
  maxParticipants?: number;
  currentParticipants?: number;
  hostId?: Uuid;
  isPublic?: boolean;
  streamUrl?: string;
  scheduledStartTime?: string;
}

export interface Video {
  id: Uuid;
  title: string;
  description?: string;
  duration?: number;
  status?: 'processing' | 'ready' | 'failed';
  url?: string;
  thumbnailUrl?: string;
  creatorId?: Uuid;
  isPublic?: boolean;
}

export interface Conversation {
  id: Uuid;
  userId?: Uuid;
  subject?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  language?: string;
  status?: 'active' | 'completed' | 'paused';
}

export interface TutorResponse {
  messageId: Uuid;
  content: string;
  type?: 'text' | 'voice' | 'image';
  confidence?: number;
  sources?: string[];
  timestamp?: string;
}

export interface Recommendation {
  id: string;
  type: 'course' | 'content' | 'product';
  title?: string;
  description?: string;
  score?: number;
}

export interface SystemStatus {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export interface DashboardData {
  overview?: { totalUsers?: number; activeUsers?: number; totalRevenue?: number; totalOrders?: number; conversionRate?: number };
}

export interface MassLiveStream {
  id: string;
  title: string;
  status?: 'scheduled' | 'live' | 'ended';
}

// Payments/Banks/UPI
export interface Bank {
  code: string;
  name: string;
  ifscPrefix?: string;
  features?: string[];
  dailyLimitPaisa?: number;
  minBalancePaisa?: number;
}

export interface BankTransactionRequest {
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency?: string;
  reference?: string;
  description?: string;
}

export interface BankTransaction {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export interface UPITransactionRequest {
  payerVPA: string;
  payeeVPA: string;
  amount: number;
  currency?: string;
  reference?: string;
  note?: string;
}

export interface UPITransaction {
  transactionId: string;
  rrn?: string;
  status: 'pending' | 'success' | 'failed';
  payerVPA: string;
  payeeVPA: string;
  amount: number;
  currency: string;
  processedAt?: string;
}

// Ledger
export interface LedgerAccount {
  id: Uuid;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountCode?: string;
  currency?: string;
  balance?: number;
  createdAt?: string;
}

export interface LedgerEntry {
  accountId: Uuid;
  amount: number;
  type: 'debit' | 'credit';
  description?: string;
}

export interface LedgerTransactionRequest {
  description: string;
  reference?: string;
  entries: LedgerEntry[];
}

export interface LedgerTransactionEntry extends LedgerEntry {
  runningBalance?: number;
}

export interface LedgerTransaction {
  id: Uuid;
  description: string;
  reference?: string;
  totalAmount?: number;
  entries?: LedgerTransactionEntry[];
  createdAt?: string;
}

// Webhooks
export interface WebhookEndpoint {
  id: Uuid;
  url: string;
  events: string[];
  description?: string;
  status?: 'active' | 'inactive';
  secret?: string;
  createdAt?: string;
  lastTriggered?: string;
}

// Counters
export interface CounterValue {
  name: string;
  value: number;
  lastUpdated: string;
}

// Content Delivery
export interface ContentDeliveryUploadResponse {
  contentId: string;
  url: string;
  size: number;
}

// Creator Studio
export interface Creator {
  id: Uuid;
  username: string;
  email: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface CreatorContent {
  id: Uuid;
  title: string;
  description?: string;
  type: 'video' | 'article' | 'course' | 'live_stream';
  category?: string;
  tags?: string[];
  creatorId: Uuid;
  status?: 'draft' | 'published' | 'archived' | 'monetized';
}

// Commerce admin saga monitoring
export interface SagaStep {
  name: string;
  status: 'pending' | 'completed' | 'failed' | 'compensated';
  attempt?: number;
  executedAt?: string;
}

export interface SagaInstance {
  id: Uuid;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'compensating';
  orderId?: Uuid;
  steps?: SagaStep[];
  errorMessage?: string;
  createdAt?: string;
  completedAt?: string;
}

// Notifications
export interface NotificationRequest {
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  recipient: string;
  message: string;
  template?: string;
  variables?: Record<string, unknown>;
}

export interface NotificationResponse {
  notificationId: string;
  status: string;
}

// Voice
export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
}

export interface TranscriptionResponse {
  text: string;
  confidence?: number;
  duration?: number;
  language?: string;
}

// Live Classes Join
export interface JoinRoomResponse {
  participantId: string;
  webrtcConfig?: unknown;
  chatToken?: string;
}

