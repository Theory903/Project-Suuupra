# Suuupra Frontend Architecture & Routing Plan

A clean, non-redundant, API-aligned plan for the Suuupra EdTech platform frontend. Written to be immediately actionable for implementation in **Next.js 15 (App Router)** with **TypeScript**, **Tailwind**, **shadcn/ui**, and **TanStack Query**. All endpoints sourced from the unified OpenAPI specification.

---

## 0) Assumptions

* **Stack:** Next.js 15 App Router, React Server Components where feasible, Client Components for interactivity.
* **Data:** REST/JSON from 20+ microservices via API Gateway (port 8080).
* **Auth:** JWT-based authentication with refresh tokens via Identity Service (OIDC compliant).
* **State/Data:** TanStack Query for client fetching, RSC for SSR where safe.
* **Design System:** Tailwind + shadcn/ui components.
* **Build:** Next.js build, ESLint + Prettier.
* **Testing:** Vitest/Jest, React Testing Library, Playwright.

---

## 1) Service & API Inventory

Based on the comprehensive OpenAPI specification, here are all API endpoints mapped to frontend usage:

| Domain              | Endpoint                                    | Method | Auth    | Request Key Params                    | Response (shape)                        | Errors      | Cache   | Used By Pages                           |
| ------------------- | ------------------------------------------- | ------ | ------- | ------------------------------------- | --------------------------------------- | ----------- | ------- | --------------------------------------- |
| **Gateway**         | `/health`                                   | GET    | Public  | `-`                                   | `{status, service, uptime}`             | 503         | No      | Status page, monitoring                 |
| **Auth**            | `/identity/api/v1/auth/register`            | POST   | Public  | `{email, password, firstName, lastName}` | `{token, refreshToken, user}`           | 400, 409    | No      | `/auth/sign-up`                         |
| **Auth**            | `/identity/api/v1/auth/login`               | POST   | Public  | `{email, password}`                   | `{token, refreshToken, user}`           | 401         | No      | `/auth/sign-in`                         |
| **Auth**            | `/identity/api/v1/auth/logout`              | POST   | Token   | `-`                                   | `{success}`                             | 401         | No      | Header logout, middleware               |
| **Auth**            | `/identity/api/v1/auth/refresh`             | POST   | Public  | `{refreshToken}`                      | `{token, expiresIn}`                    | 401         | No      | API client interceptor                  |
| **Users**           | `/identity/api/v1/users/profile`            | GET    | Token   | `-`                                   | `{id, email, firstName, lastName}`      | 401         | SWR 5m  | Layout, header, profile page            |
| **Users**           | `/identity/api/v1/users/profile`            | PUT    | Token   | `{firstName, lastName, phoneNumber}`  | `{user}`                                | 400, 401    | No      | `/settings/profile`                     |
| **Commerce**        | `/commerce/api/v1/cart`                     | POST   | Token   | `{currency?}`                         | `{cart}`                                | 401         | No      | Cart creation                           |
| **Commerce**        | `/commerce/api/v1/cart`                     | GET    | Token   | `-`                                   | `{cart}`                                | 401         | SWR 30s | Header cart, `/cart`                    |
| **Commerce**        | `/commerce/api/v1/cart/{id}/items`          | POST   | Token   | `{productId, quantity, price}`        | `{cart}`                                | 400, 401    | No      | Product pages, cart management          |
| **Commerce**        | `/commerce/api/v1/orders`                   | POST   | Token   | `{cartId, shippingAddress}`           | `{order}`                               | 400, 401    | No      | Checkout flow                           |
| **Commerce**        | `/commerce/api/v1/orders`                   | GET    | Token   | `?page, size`                         | `{orders, total, page}`                 | 401         | SWR 2m  | `/dashboard/orders`                     |
| **Payments**        | `/payments/api/v1/intents`                  | POST   | Token   | `{amount, currency, orderId}`         | `{paymentIntent}`                       | 400, 401    | No      | Checkout, payment flow                  |
| **Payments**        | `/payments/api/v1/intents/{id}`             | GET    | Token   | `:id`                                 | `{paymentIntent}`                       | 401, 404    | SWR 1m  | Payment status tracking                 |
| **Payments**        | `/payments/api/v1/payments`                 | POST   | Token   | `{paymentIntentId, paymentMethod}`    | `{payment}`                             | 400, 401    | No      | Payment processing                      |
| **Payments**        | `/payments/api/v1/webhooks/endpoints`       | GET    | Token   | `-`                                   | `{webhookEndpoints[]}`                  | 401         | SWR 5m  | `/settings/webhooks`                    |
| **Payments**        | `/payments/api/v1/webhooks/endpoints`       | POST   | Token   | `{url, events[], description?}`       | `{webhookEndpoint}`                     | 400, 401    | No      | `/settings/webhooks/new`                |
| **Content**         | `/content/api/v1/content`                   | GET    | Token   | `?page, limit, search, category`      | `{content[], total, page}`              | 401         | SWR 2m  | `/dashboard/content`, `/library`        |
| **Content**         | `/content/api/v1/content`                   | POST   | Token   | `{title, type, category, tags}`       | `{content}`                             | 400, 401    | No      | `/dashboard/content/new`                |
| **Content**         | `/content/api/v1/content/{id}`              | GET    | Token   | `:id`                                 | `{content}`                             | 401, 404    | SWR 5m  | `/dashboard/content/[id]`, `/learn/[id]` |
| **Content**         | `/content/api/v1/content/{id}`              | PUT    | Token   | `{title?, description?, tags?}`       | `{content}`                             | 400, 401    | No      | Content editing                         |
| **Content**         | `/content/api/v1/search`                    | GET    | Token   | `?q, page, limit`                     | `{results[], total, searchTime}`        | 401         | No      | `/search`, global search                |
| **Live Classes**    | `/live-classes/api/v1/rooms`                | GET    | Token   | `?status, page`                       | `{rooms[]}`                             | 401         | SWR 1m  | `/live`, `/dashboard/classes`           |
| **Live Classes**    | `/live-classes/api/v1/rooms`                | POST   | Token   | `{title, maxParticipants, isPublic}`  | `{liveRoom}`                            | 400, 401    | No      | `/dashboard/classes/new`                |
| **Live Classes**    | `/live-classes/api/v1/rooms/{id}/join`      | POST   | Token   | `:id`                                 | `{participantId, webrtcConfig, chatToken}` | 401, 404    | No      | Live class join flow                    |
| **VOD**             | `/vod/api/v1/videos`                        | GET    | Token   | `?skip, limit, status, search`        | `{videos[], total}`                     | 401         | SWR 2m  | `/dashboard/videos`, `/library/videos`  |
| **VOD**             | `/vod/api/v1/upload`                        | POST   | Token   | `{file, title, description, isPublic}` | `{video}`                               | 400, 401    | No      | `/dashboard/videos/upload`              |
| **LLM Tutor**       | `/llm-tutor/api/v1/conversations`          | POST   | Token   | `{subject, level, language?}`         | `{conversation}`                        | 400, 401    | No      | `/tutor`, AI chat initiation            |
| **LLM Tutor**       | `/llm-tutor/api/v1/conversations/{id}/messages` | POST   | Token   | `{content, type?}`                    | `{tutorResponse}`                       | 401, 404    | No      | AI chat interface                       |
| **LLM Tutor**       | `/llm-tutor/api/v1/voice/voices`           | GET    | Token   | `-`                                   | `{voices[]}`                            | 401         | SWR 1h  | Voice settings, TTS setup               |
| **LLM Tutor**       | `/llm-tutor/api/v1/voice/transcribe`       | POST   | Token   | `{audio, language?}`                  | `{text, confidence, duration}`          | 400, 401    | No      | Voice input processing                  |
| **Notifications**   | `/notifications/api/v1/notifications/send` | POST   | Token   | `{type, recipient, message}`          | `{notificationId, status}`              | 400, 401    | No      | Admin notifications                     |
| **Analytics**       | `/analytics/api/v1/events/track`           | POST   | Token   | `{event, userId, properties, timestamp?}` | `{success}`                             | 401         | No      | Event tracking (background)             |
| **Analytics**       | `/admin/api/v1/analytics/dashboard`        | GET    | Token   | `?period`                             | `{dashboardData}`                       | 401, 403    | SWR 1m  | `/admin/dashboard`                      |
| **Banks**           | `/bank-simulator/api/banks`                | GET    | Public  | `-`                                   | `{banks[]}`                             | 500         | SWR 1h  | Payment method selection                |
| **Banks**           | `/bank-simulator/api/transactions`         | POST   | Token   | `{fromAccount, toAccount, amount}`    | `{bankTransaction}`                     | 400, 401    | No      | Bank payment processing                 |
| **UPI**             | `/upi-core/upi/transactions`               | POST   | Token   | `{payerVPA, payeeVPA, amount}`        | `{upiTransaction}`                      | 400, 401    | No      | UPI payment processing                  |
| **Recommendations** | `/recommendations/api/v1/recommendations/{userId}` | GET    | Token   | `?type, limit`                        | `{recommendations[]}`                   | 401         | SWR 5m  | Dashboard, course suggestions           |
| **Mass Live**       | `/mass-live/api/v1/streams`                | POST   | Token   | `{title, scheduledStartTime, maxViewers}` | `{massLiveStream}`                      | 400, 401    | No      | `/dashboard/streams/new`                |
| **Mass Live**       | `/mass-live/api/v1/streams/{streamId}/start` | POST   | Token   | `{streamKey}`                         | `{success}`                             | 401, 404    | No      | Stream broadcasting controls            |
| **Admin**           | `/admin/api/v1/system/status`              | GET    | Token   | `-`                                   | `{systemStatus}`                        | 401, 403    | SWR 30s | `/admin/system`                         |
| **Admin**           | `/admin/api/v1/users`                      | GET    | Token   | `?page, size, role`                   | `{users[], total}`                      | 401, 403    | SWR 1m  | `/admin/users`                          |
| **Content Delivery** | `/content-delivery/api/v1/content/{contentId}` | GET    | Public  | `:contentId`                          | Binary content                          | 404         | CDN     | Media serving (images, videos)          |
| **Content Delivery** | `/content-delivery/api/v1/upload`          | POST   | Token   | `{file, metadata?}`                   | `{contentId, url, size}`                | 400, 401    | No      | File upload flows                       |
| **Search**          | `/search-crawler/search`                   | GET    | Public  | `?q, page, size`                      | `{results[], total, searchTime}`        | 400         | SWR 30s | `/search` global search                 |
| **Ledger**          | `/ledger/api/v1/accounts`                  | POST   | Token   | `{accountName, accountType, currency}` | `{ledgerAccount}`                       | 400, 401    | No      | Financial admin tools                   |
| **Ledger**          | `/ledger/api/v1/transactions`              | POST   | Token   | `{description, entries[]}`            | `{ledgerTransaction}`                   | 400, 401    | No      | Financial transaction recording         |
| **Creator Studio**  | `/creator-studio/api/auth/register`        | POST   | Public  | `{username, email, password}`         | `{creator}`                             | 400, 409    | No      | `/creators/sign-up`                     |
| **Creator Studio**  | `/creator-studio/api/content`              | POST   | Token   | `{title, type, monetizationSettings}` | `{creatorContent}`                      | 400, 401    | No      | `/creators/content/new`                 |
| **Live Tracking**   | `/live-tracking/api/v1/events`             | POST   | Token   | `{eventType, userId, sessionId}`      | `{success}`                             | 401         | No      | Background event tracking               |
| **Counters**        | `/counters/api/v1/counters/{name}`         | GET    | Token   | `:name`                               | `{name, value, lastUpdated}`            | 401         | SWR 30s | Analytics components                    |
| **Counters**        | `/counters/api/v1/counters/{name}`         | POST   | Token   | `{increment?, metadata?}`             | `{name, value, lastUpdated}`            | 401         | No      | Increment counters                      |
| **Gateway Admin**   | `/admin/config`                            | GET    | Token   | `-`                                   | `{config, version}`                     | 401, 403    | SWR 10m | `/admin/gateway`                        |
| **OIDC**            | `/identity/.well-known/openid-configuration` | GET    | Public  | `-`                                   | OIDC discovery document                 | 500         | Static  | OAuth setup                             |
| **JWKS**            | `/identity/oauth2/jwks`                    | GET    | Public  | `-`                                   | `{keys[]}`                              | 500         | Static  | JWT verification                        |

---

## 2) Information Architecture (IA) & Navigation

### Primary Nav (authenticated)

* **Dashboard** (overview with KPIs and recommendations)
* **Learn** (content consumption - courses, videos, live classes)
* **Library** (personal content library and progress)
* **Live** (live classes and mass streaming events)
* **Tutor** (AI-powered tutoring chat)
* **Cart & Orders** (e-commerce functionality)
* **Settings** (profile, billing, notifications, API keys)
* **Analytics** (personal learning analytics)

### Creator Nav (creator role)

* **Creator Studio** (content creation and management)
* **My Content** (creator's published content)
* **Analytics** (creator analytics and earnings)
* **Live Streaming** (broadcast tools)
* **Monetization** (pricing, subscriptions)

### Admin Nav (admin role)

* **Admin Dashboard** (system overview)
* **User Management** (user administration)
* **Content Moderation** (content approval)
* **System Status** (health monitoring)
* **Financial** (ledger, payments, sagas)
* **Gateway Config** (API routing and rules)

### Public Nav

* **Home** (marketing landing)
* **Courses** (public course catalog)
* **Live Events** (public live streams)
* **Pricing** (subscription plans)
* **About** (company info)
* **Sign In / Sign Up**

### Cross-cutting

* **Header:** global search, notifications bell, cart icon, user avatar
* **Sidebar:** app sections with role-based visibility
* **Breadcrumbs:** dynamic based on current route
* **Footer:** links, status, support

---

## 3) Route Map (canonical, non-redundant)

### Public Routes

* `/` - Home (marketing landing)
* `/pricing` - Subscription plans and pricing
* `/courses` - Public course catalog
* `/courses/[id]` - Public course preview
* `/live` - Public live events
* `/about` - Company information
* `/status` - System status page
* `/auth/sign-in` - Login page
* `/auth/sign-up` - Registration page
* `/auth/callback` - OAuth callback
* `/creators/sign-up` - Creator registration

### App Routes (authenticated)

* `/dashboard` - Main dashboard with overview
* `/learn` - Learning hub

  * `/learn/courses` - Course catalog
  * `/learn/courses/[id]` - Course detail and consumption
  * `/learn/videos` - Video library
  * `/learn/videos/[id]` - Video player
* `/library` - Personal library

  * `/library/progress` - Learning progress
  * `/library/bookmarks` - Saved content
  * `/library/downloads` - Offline content
* `/live` - Live streaming

  * `/live/classes` - Live classes list
  * `/live/classes/[id]` - Live class room
  * `/live/events` - Mass live events
  * `/live/events/[id]` - Live event viewer
* `/tutor` - AI tutor chat interface
* `/cart` - Shopping cart
* `/orders` - Order history

  * `/orders/[id]` - Order detail
* `/settings` - Settings hub

  * `/settings/profile` - Profile management
  * `/settings/billing` - Billing and subscriptions
  * `/settings/notifications` - Notification preferences
  * `/settings/api-keys` - API key management
  * `/settings/webhooks` - Webhook configuration
* `/search` - Global search results
* `/analytics` - Personal learning analytics

### Creator Routes (creator role)

* `/creators` - Creator dashboard
* `/creators/content` - Content management

  * `/creators/content/new` - Create content
  * `/creators/content/[id]` - Edit content
* `/creators/videos` - Video management

  * `/creators/videos/upload` - Video upload
  * `/creators/videos/[id]` - Video management
* `/creators/live` - Live streaming tools

  * `/creators/live/new` - Create live stream
  * `/creators/live/[id]` - Stream management
* `/creators/analytics` - Creator analytics
* `/creators/earnings` - Revenue and payouts

### Admin Routes (admin role)

* `/admin` - Admin dashboard
* `/admin/users` - User management
* `/admin/content` - Content moderation
* `/admin/system` - System health and monitoring
* `/admin/financial` - Financial management

  * `/admin/financial/ledger` - Ledger accounts
  * `/admin/financial/transactions` - Transaction history
  * `/admin/financial/sagas` - Saga orchestration monitoring
* `/admin/gateway` - API Gateway configuration

### Error/Fallback

* `/error` - Global error page
* `/not-found` - 404 page
* `/maintenance` - Maintenance mode

---

## 4) Page-by-Page Plan (data, components, states)

### `/` Home

* **Purpose:** Marketing landing with course highlights and platform features
* **Data:** Static content + featured courses via `/content/api/v1/content?category=featured`
* **Components:** Hero, FeaturedCourses, TestimonialCarousel, PricingPreview, Footer
* **Performance:** SSG/ISR, optimized images, critical CSS inline

### `/auth/sign-in`

* **Data:** POST `/identity/api/v1/auth/login`
* **States:** idle, submitting, invalid credentials, success
* **Components:** SignInForm, SocialAuth (if OIDC), ForgotPassword link
* **Interactions:** Success → store tokens, redirect to `/dashboard` or return URL
* **Security:** CSRF protection, rate limiting

### `/auth/sign-up`

* **Data:** POST `/identity/api/v1/auth/register`
* **States:** idle, submitting, validation errors, email verification sent
* **Components:** SignUpForm, TermsCheckbox, EmailVerification
* **Interactions:** Success → auto login or verification flow

### `/dashboard`

* **Data:** 
  - GET `/identity/api/v1/users/profile`
  - GET `/recommendations/api/v1/recommendations/{userId}`
  - GET `/analytics/api/v1/events/track` (dashboard view tracking)
  - GET `/counters/api/v1/counters/course_views`
* **Components:** WelcomeCard, RecommendationsWidget, ProgressOverview, QuickActions, ActivityFeed
* **Performance:** RSC for initial data, client hydration for interactive widgets
* **States:** loading skeleton, error boundary, empty states

### `/learn/courses`

* **Data:** GET `/content/api/v1/content?type=course&page=0&limit=20`
* **Components:** CourseGrid, FilterSidebar, SearchBar, PaginationControls
* **States:** loading, empty (explore CTA), error
* **Interactions:** Course click → `/learn/courses/[id]`, filters update URL params

### `/learn/courses/[id]`

* **Data:** GET `/content/api/v1/content/{id}`
* **Components:** CourseHeader, LessonList, ProgressTracker, EnrollButton, ReviewsSection
* **States:** loading, not found, access denied (if paid), enrolled
* **Interactions:** Enroll → payment flow, Start lesson → lesson player

### `/live/classes`

* **Data:** GET `/live-classes/api/v1/rooms?status=scheduled,live`
* **Components:** ClassSchedule, UpcomingClasses, LiveIndicator, JoinButton
* **States:** loading, no upcoming classes, join success/failure
* **Interactions:** Join → POST `/live-classes/api/v1/rooms/{id}/join`

### `/live/classes/[id]`

* **Data:** GET `/live-classes/api/v1/rooms/{id}` + WebRTC setup
* **Components:** VideoPlayer, ChatWindow, ParticipantList, ScreenShare, Whiteboard
* **States:** connecting, connected, disconnected, ended
* **Performance:** WebRTC optimization, adaptive bitrate

### `/tutor`

* **Data:** 
  - POST `/llm-tutor/api/v1/conversations` (conversation init)
  - POST `/llm-tutor/api/v1/conversations/{id}/messages`
  - GET `/llm-tutor/api/v1/voice/voices`
* **Components:** ChatInterface, VoiceInput, MessageBubbles, TypingIndicator
* **States:** conversation loading, thinking, voice processing, error
* **Performance:** Streaming responses, voice chunking

### `/cart`

* **Data:** 
  - GET `/commerce/api/v1/cart`
  - POST `/commerce/api/v1/cart/{id}/items` (add/remove)
* **Components:** CartItemList, PricingSummary, CheckoutButton, PromoCodeInput
* **States:** empty cart, loading, checkout processing
* **Interactions:** Update quantities → optimistic updates, Checkout → payment flow

### `/orders`

* **Data:** GET `/commerce/api/v1/orders?page=0&size=20`
* **Components:** OrderTable, StatusFilter, OrderCard, PaginationControls
* **States:** loading, empty (shop CTA), error
* **Interactions:** Order click → `/orders/[id]`

### `/orders/[id]`

* **Data:** 
  - GET `/commerce/api/v1/orders/{id}` (order details)
  - GET `/payments/api/v1/intents/{paymentIntentId}` (payment status)
* **Components:** OrderTimeline, PaymentStatus, ItemsList, ShippingTracker, InvoiceDownload
* **States:** loading, not found, payment pending/success/failed
* **Interactions:** Refund button (if available), Download invoice

### `/settings/profile`

* **Data:** 
  - GET `/identity/api/v1/users/profile`
  - PUT `/identity/api/v1/users/profile`
* **Components:** ProfileForm, AvatarUpload, PasswordChange, AccountDeletion
* **States:** loading, saving, validation errors, success
* **Interactions:** Form submit → optimistic update + toast

### `/settings/billing`

* **Data:** 
  - GET `/payments/api/v1/intents?orderId={subscriptionOrderId}`
  - Subscription management endpoints (implied)
* **Components:** CurrentPlan, UsageMetrics, InvoiceHistory, PaymentMethods, PlanUpgrade
* **States:** loading, billing error, plan change processing
* **Interactions:** Change plan → payment flow

### `/settings/webhooks`

* **Data:** 
  - GET `/payments/api/v1/webhooks/endpoints`
  - POST `/payments/api/v1/webhooks/endpoints`
* **Components:** WebhookList, CreateWebhook, TestWebhook, WebhookLogs
* **States:** loading, testing webhook, creation success/error
* **Interactions:** Create → form validation, Test → ping endpoint

### `/admin/users`

* **Data:** GET `/admin/api/v1/users?page=0&size=20&role=USER`
* **Components:** UserTable, RoleFilter, SearchInput, UserActions, BulkActions
* **States:** loading, empty, bulk operation processing
* **Interactions:** Role change → PATCH user role, Ban/Unban users
* **Security:** Admin role guard

### `/admin/system`

* **Data:** GET `/admin/api/v1/system/status`
* **Components:** ServiceHealthGrid, AlertsList, MetricsCharts, SystemActions
* **States:** healthy, degraded, unhealthy, refreshing
* **Performance:** Auto-refresh every 30s, real-time alerts

### `/admin/financial/sagas`

* **Data:** GET `/commerce/api/v1/admin/sagas?status=failed`
* **Components:** SagaTable, StatusFilter, RetryButton, SagaTimeline
* **States:** loading, retrying saga, retry success/failure
* **Interactions:** Retry → POST `/commerce/api/v1/admin/sagas/{id}/retry`

### `/creators/content/new`

* **Data:** POST `/creator-studio/api/content`
* **Components:** ContentTypeSelector, TitleForm, DescriptionEditor, MonetizationSettings, TagInput
* **States:** draft saving, publishing, validation errors
* **Interactions:** Save draft → optimistic save, Publish → content review flow

### `/creators/videos/upload`

* **Data:** POST `/vod/api/v1/upload`
* **Components:** VideoUploader, ProgressBar, MetadataForm, ThumbnailGenerator
* **States:** selecting file, uploading, processing, upload complete/failed
* **Performance:** Chunked upload, progress tracking, background processing

---

## 5) Routing, Guards, and Layouts

### Layout Structure

```typescript
// app/(public)/layout.tsx
export default function PublicLayout({ children }) {
  return (
    <>
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </>
  );
}

// app/(app)/layout.tsx  
export default async function AppLayout({ children }) {
  const user = await getCurrentUser(); // RSC auth check
  return (
    <div className="flex h-screen">
      <AppSidebar user={user} />
      <div className="flex-1 flex flex-col">
        <AppHeader user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

// app/(creators)/layout.tsx
export default async function CreatorLayout({ children }) {
  const user = await getCurrentUser();
  if (user.role !== 'CREATOR') redirect('/dashboard');
  return (
    <div className="flex h-screen">
      <CreatorSidebar user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}

// app/(admin)/layout.tsx
export default async function AdminLayout({ children }) {
  const user = await getCurrentUser();
  if (user.role !== 'ADMIN') redirect('/dashboard');
  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

### Middleware Guards

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname.startsWith('/auth') || pathname === '/' || pathname.startsWith('/pricing')) {
    return NextResponse.next();
  }

  // Protected routes
  if (!token) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    const userRole = validateTokenAndGetRole(token.value);
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Creator routes
  if (pathname.startsWith('/creators')) {
    const userRole = validateTokenAndGetRole(token.value);
    if (!['CREATOR', 'ADMIN'].includes(userRole)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}
```

---

## 6) Data Fetching Strategy

### Server vs Client

* **RSC (Server Components):** Static content, initial page data, SEO-critical data
* **Client + TanStack Query:** Interactive data, mutations, real-time updates, user-specific data

### API Client Setup

```typescript
// lib/api-client.ts
import axios, { AxiosInstance } from 'axios';

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  timeout: 10000,
});

// Request interceptor for auth
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await refreshToken();
        return apiClient.request(error.config);
      } catch {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);
```

### Query Hooks Examples

```typescript
// hooks/use-courses.ts
export function useCourses(filters: CourseFilters) {
  return useQuery({
    queryKey: ['courses', filters],
    queryFn: () => apiClient.get('/content/api/v1/content', { params: filters }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// hooks/use-live-rooms.ts
export function useLiveRooms() {
  return useQuery({
    queryKey: ['live-rooms'],
    queryFn: () => apiClient.get('/live-classes/api/v1/rooms?status=live,scheduled'),
    refetchInterval: 30 * 1000, // 30 seconds for live data
  });
}

// hooks/use-tutor-conversation.ts
export function useTutorConversation(conversationId: string) {
  return useMutation({
    mutationFn: (message: string) => 
      apiClient.post(`/llm-tutor/api/v1/conversations/${conversationId}/messages`, {
        content: message,
        type: 'text'
      }),
    onSuccess: (response) => {
      // Update conversation history
      queryClient.setQueryData(['conversation', conversationId], response.data);
    }
  });
}
```

---

## 7) Component Architecture

### Core UI Components (shadcn/ui based)

* **DataTable** - Reusable table with sorting, filtering, pagination
* **Form** - Form wrapper with validation and error handling
* **LoadingSpinner** - Consistent loading states
* **EmptyState** - Empty states with CTAs
* **ConfirmDialog** - Confirmation dialogs for destructive actions
* **Toast** - Success/error notifications
* **StatCard** - KPI display cards
* **SearchInput** - Global search component
* **FileUpload** - File upload with progress

### Domain-Specific Components

* **CourseCard** - Course display in grids
* **VideoPlayer** - Custom video player with controls
* **ChatInterface** - Real-time chat for live classes and tutor
* **PaymentForm** - Payment method selection and processing
* **LiveStreamViewer** - Live stream video player with chat
* **AnalyticsChart** - Chart components for analytics
* **SagaStatusBadge** - Status indicator for saga orchestration
* **NotificationBell** - Header notification dropdown

### Layout Components

* **AppSidebar** - Main navigation sidebar
* **AppHeader** - Top header with search and user menu
* **Breadcrumbs** - Dynamic breadcrumb navigation
* **PageHeader** - Consistent page headers with actions

---

## 8) Authentication Flow

### Initial Auth Setup

1. User visits protected route
2. Middleware checks `auth-token` cookie
3. If no token → redirect to `/auth/sign-in`
4. Sign-in form submits to `/identity/api/v1/auth/login`
5. Success → store `token` and `refreshToken` in httpOnly cookies
6. Redirect to original destination or `/dashboard`

### Token Refresh Flow

1. API call returns 401
2. API client interceptor triggers refresh
3. POST `/identity/api/v1/auth/refresh` with refresh token
4. Success → update auth cookie, retry original request
5. Failure → clear cookies, redirect to sign-in

### OIDC Integration

* Discovery endpoint: `/identity/.well-known/openid-configuration`
* JWKS endpoint: `/identity/oauth2/jwks`
* OAuth callback: `/auth/callback` (Next.js route handler)

---

## 9) Real-time Features

### Live Class Integration

* **WebRTC:** Direct peer-to-peer for video/audio
* **Chat:** WebSocket connection for real-time messaging
* **Screen Share:** WebRTC screen capture API
* **Participant Management:** Real-time participant list updates

### AI Tutor Chat

* **Streaming Responses:** Server-sent events for AI responses
* **Voice Input:** Web Speech API → `/llm-tutor/api/v1/voice/transcribe`
* **Voice Output:** Text-to-speech with available voices
* **Real-time Typing:** Typing indicators during AI processing

### Live Tracking

* **Event Tracking:** Background POST to `/live-tracking/api/v1/events`
* **Analytics:** Real-time counter updates via `/counters/api/v1/counters/{name}`
* **User Activity:** Session tracking and engagement metrics

---

## 10) Performance & Optimization

### Next.js Optimizations

* **App Router:** RSC for static content, client components for interactivity
* **Image Optimization:** Next.js Image component with CDN integration
* **Code Splitting:** Dynamic imports for heavy components (charts, video players)
* **Bundle Analysis:** Regular bundle size monitoring

### Caching Strategy

* **Static Assets:** CDN caching via `/content-delivery/api/v1/content/{contentId}`
* **API Responses:** TanStack Query cache with appropriate stale times
* **Database Queries:** Server-side caching for expensive operations
* **CDN:** CloudFlare/CloudFront for global content delivery

### Progressive Enhancement

* **Offline Support:** Service worker for basic offline functionality
* **Progressive Web App:** Installable app with offline content
* **Lazy Loading:** Intersection Observer for content loading
* **Virtual Scrolling:** For large lists (courses, orders, users)

---

## 11) Security Considerations

### Client-Side Security

* **Token Storage:** httpOnly cookies for auth tokens
* **CSRF Protection:** Double-submit cookie pattern
* **XSS Prevention:** Content Security Policy, input sanitization
* **Input Validation:** Zod schemas for all form inputs

### API Security

* **Rate Limiting:** Enforced by API Gateway (100 req/min default)
* **Request Signing:** For sensitive operations
* **Audit Logging:** All admin and financial operations logged
* **Role-Based Access:** Granular permissions per route and API

---

## 12) Error Handling & Monitoring

### Error Boundaries

```typescript
// components/ErrorBoundary.tsx
export function ErrorBoundary({ children, fallback }) {
  return (
    <ErrorBoundaryComponent 
      fallback={({ error, retry }) => (
        <div className="p-8 text-center">
          <h2>Something went wrong</h2>
          <button onClick={retry}>Try Again</button>
        </div>
      )}
    >
      {children}
    </ErrorBoundaryComponent>
  );
}
```

### Global Error States

* **Network Errors:** Retry mechanism with exponential backoff
* **Validation Errors:** Field-level error display
* **Permission Errors:** Redirect to appropriate access level
* **Service Outages:** Graceful degradation with cached content

### Monitoring Integration

* **Error Tracking:** Sentry for production error monitoring
* **Performance:** Core Web Vitals tracking
* **User Analytics:** PostHog/Mixpanel for user behavior
* **API Monitoring:** Response time and error rate tracking

---

## 13) Testing Strategy

### Unit Testing

* **Components:** React Testing Library for UI components
* **Hooks:** Testing Library for custom hooks
* **Utils:** Jest for utility functions
* **API Client:** Mock API responses for client logic

### Integration Testing

* **API Integration:** MSW (Mock Service Worker) for API mocking
* **Data Flow:** End-to-end data fetching and state management
* **Form Validation:** Complete form submission flows

### E2E Testing (Playwright)

```typescript
// tests/e2e/auth.spec.ts
test('complete auth flow', async ({ page }) => {
  await page.goto('/auth/sign-in');
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'password123');
  await page.click('[data-testid=submit]');
  await expect(page).toHaveURL('/dashboard');
});

// tests/e2e/course-enrollment.spec.ts
test('course enrollment flow', async ({ page }) => {
  await authenticateUser(page);
  await page.goto('/learn/courses');
  await page.click('[data-testid=course-card]:first-child');
  await page.click('[data-testid=enroll-button]');
  await completePayment(page);
  await expect(page.locator('[data-testid=enrolled-badge]')).toBeVisible();
});
```

---

## 14) File Structure

```
suuupra-frontend/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 # Home
│   │   │   ├── pricing/page.tsx
│   │   │   ├── courses/
│   │   │   │   ├── page.tsx            # Public course catalog
│   │   │   │   └── [id]/page.tsx       # Course preview
│   │   │   ├── live/page.tsx           # Public live events
│   │   │   ├── about/page.tsx
│   │   │   └── auth/
│   │   │       ├── sign-in/page.tsx
│   │   │       ├── sign-up/page.tsx
│   │   │       └── callback/route.ts
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── learn/
│   │   │   │   ├── courses/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [id]/page.tsx
│   │   │   │   │   └── loading.tsx
│   │   │   │   └── videos/
│   │   │   │       ├── page.tsx
│   │   │   │       └── [id]/page.tsx
│   │   │   ├── library/
│   │   │   │   ├── progress/page.tsx
│   │   │   │   ├── bookmarks/page.tsx
│   │   │   │   └── downloads/page.tsx
│   │   │   ├── live/
│   │   │   │   ├── classes/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   └── events/
│   │   │   │       ├── page.tsx
│   │   │   │       └── [id]/page.tsx
│   │   │   ├── tutor/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── search/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   └── settings/
│   │   │       ├── layout.tsx
│   │   │       ├── profile/page.tsx
│   │   │       ├── billing/page.tsx
│   │   │       ├── api-keys/page.tsx
│   │   │       └── webhooks/page.tsx
│   │   ├── (creators)/
│   │   │   ├── layout.tsx
│   │   │   ├── creators/
│   │   │   │   ├── page.tsx            # Creator dashboard
│   │   │   │   ├── content/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── videos/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── upload/page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── live/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   └── [id]/page.tsx
│   │   │   │   ├── analytics/page.tsx
│   │   │   │   └── earnings/page.tsx
│   │   └── (admin)/
│   │       ├── layout.tsx
│   │       └── admin/
│   │           ├── page.tsx            # Admin dashboard
│   │           ├── users/page.tsx
│   │           ├── content/page.tsx    # Content moderation
│   │           ├── system/page.tsx     # System health
│   │           ├── financial/
│   │           │   ├── ledger/page.tsx
│   │           │   ├── transactions/page.tsx
│   │           │   └── sagas/page.tsx
│   │           └── gateway/page.tsx
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   ├── forms/                      # Form components
│   │   │   ├── SignInForm.tsx
│   │   │   ├── CourseForm.tsx
│   │   │   ├── PaymentForm.tsx
│   │   │   └── ProfileForm.tsx
│   │   ├── charts/                     # Analytics charts
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   └── PieChart.tsx
│   │   ├── media/                      # Media components
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── LiveStreamViewer.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── ImageGallery.tsx
│   │   ├── layout/                     # Layout components
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── AppHeader.tsx
│   │   │   ├── Breadcrumbs.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── learning/                   # Learning-specific
│   │   │   ├── CourseCard.tsx
│   │   │   ├── LessonList.tsx
│   │   │   ├── ProgressTracker.tsx
│   │   │   └── ChatInterface.tsx
│   │   └── commerce/                   # Commerce components
│   │       ├── CartItem.tsx
│   │       ├── OrderTimeline.tsx
│   │       ├── PaymentStatus.tsx
│   │       └── PricingCard.tsx
│   ├── hooks/                          # Custom hooks
│   │   ├── auth/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-login.ts
│   │   │   └── use-profile.ts
│   │   ├── commerce/
│   │   │   ├── use-cart.ts
│   │   │   ├── use-orders.ts
│   │   │   └── use-payments.ts
│   │   ├── content/
│   │   │   ├── use-courses.ts
│   │   │   ├── use-content.ts
│   │   │   └── use-search.ts
│   │   ├── live/
│   │   │   ├── use-live-rooms.ts
│   │   │   ├── use-webrtc.ts
│   │   │   └── use-stream.ts
│   │   ├── ai/
│   │   │   ├── use-tutor.ts
│   │   │   ├── use-recommendations.ts
│   │   │   └── use-voice.ts
│   │   └── admin/
│   │       ├── use-users.ts
│   │       ├── use-system-status.ts
│   │       └── use-sagas.ts
│   ├── lib/
│   │   ├── api-client.ts               # Axios setup with interceptors
│   │   ├── auth.ts                     # Auth utilities
│   │   ├── query-client.ts             # TanStack Query setup
│   │   ├── validators/                 # Zod schemas
│   │   │   ├── auth.ts
│   │   │   ├── commerce.ts
│   │   │   ├── content.ts
│   │   │   └── admin.ts
│   │   ├── utils.ts                    # Utility functions
│   │   └── constants.ts                # App constants
│   ├── types/                          # TypeScript type definitions
│   │   ├── api.ts                      # Generated from OpenAPI
│   │   ├── auth.ts
│   │   ├── commerce.ts
│   │   ├── content.ts
│   │   └── admin.ts
│   └── styles/
│       ├── globals.css                 # Tailwind + global styles
│       └── components.css              # Component-specific styles
├── public/
│   ├── icons/
│   ├── images/
│   └── manifest.json                   # PWA manifest
├── tests/
│   ├── unit/                           # Component unit tests
│   ├── integration/                    # API integration tests
│   └── e2e/                           # Playwright E2E tests
├── middleware.ts                       # Route protection
└── next.config.ts                      # Next.js configuration
```

---

## 15) State Management Strategy

### Global State (Zustand)

```typescript
// stores/auth-store.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

// stores/cart-store.ts
interface CartState {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

// stores/tutor-store.ts
interface TutorState {
  activeConversation: string | null;
  messages: Message[];
  isTyping: boolean;
  sendMessage: (content: string) => void;
}
```

### Server State (TanStack Query)

* **Query Keys:** Hierarchical structure (`['courses', filters]`, `['users', 'profile']`)
* **Cache Invalidation:** Automatic invalidation on mutations
* **Optimistic Updates:** For cart operations and profile updates
* **Background Refetch:** For live data (notifications, system status)

---

## 16) Payment Integration

### Payment Flow Architecture

1. **Cart → Checkout:** `/commerce/api/v1/orders` (create order)
2. **Payment Intent:** `/payments/api/v1/intents` (create payment intent)
3. **Payment Processing:** Multiple payment methods
   - **UPI:** `/upi-core/upi/transactions`
   - **Bank Transfer:** `/bank-simulator/api/transactions`
   - **Card/Wallet:** `/payments/api/v1/payments`
4. **Webhook Handling:** `/payments/api/v1/webhooks/endpoints` for status updates
5. **Ledger Recording:** `/ledger/api/v1/transactions` for financial records

### Payment Components

```typescript
// components/commerce/PaymentMethodSelector.tsx
interface PaymentMethod {
  id: string;
  type: 'upi' | 'bank' | 'card' | 'wallet';
  display: string;
  icon: string;
}

// components/commerce/UPIPayment.tsx
// Integration with /upi-core/upi/transactions

// components/commerce/BankPayment.tsx  
// Integration with /bank-simulator/api/transactions
```

---

## 17) AI Integration Strategy

### LLM Tutor Implementation

* **Chat Interface:** Real-time messaging with streaming responses
* **Voice Integration:** Speech-to-text and text-to-speech
* **Context Awareness:** Subject and level-based conversations
* **Multi-modal:** Text, voice, and visual content support

### Recommendations Engine

* **Personalized Content:** Course and content recommendations based on user behavior
* **Learning Path:** AI-generated learning sequences
* **Progress Tracking:** Intelligent progress assessment and suggestions

### Content Intelligence

* **Search Enhancement:** AI-powered search with semantic understanding
* **Content Tagging:** Automatic content categorization and tagging
* **Quality Assessment:** Content quality scoring and recommendations

---

## 18) Live Streaming Architecture

### Live Classes

* **Room Management:** Create, join, and manage live class rooms
* **WebRTC Integration:** Peer-to-peer video/audio communication
* **Interactive Features:** Chat, screen sharing, whiteboard
* **Recording:** Automatic recording for later playback

### Mass Live Streaming

* **Broadcasting:** Large-scale live streaming for events and conferences
* **Stream Management:** Start, stop, and monitor streams
* **Viewer Analytics:** Real-time viewer count and engagement metrics
* **Chat Moderation:** Live chat with moderation tools

---

## 19) Content Management System

### Creator Tools

* **Content Creation:** Rich text editor with media embedding
* **Video Upload:** Chunked upload with progress tracking and transcoding
* **Course Builder:** Drag-and-drop course structure creation
* **Monetization:** Pricing, subscription, and revenue sharing setup

### Content Delivery

* **CDN Integration:** Fast global content delivery
* **Adaptive Streaming:** Quality adaptation based on bandwidth
* **DRM Protection:** Content protection for premium content
* **Offline Sync:** Download content for offline consumption

---

## 20) Analytics & Tracking

### User Analytics

* **Learning Progress:** Course completion, time spent, engagement metrics
* **Behavioral Tracking:** Page views, interactions, feature usage
* **Performance Metrics:** Load times, error rates, user satisfaction
* **Custom Events:** Domain-specific event tracking

### Business Analytics

* **Revenue Tracking:** Sales, subscriptions, creator earnings
* **Content Performance:** Most popular courses, engagement rates
* **User Acquisition:** Signup sources, conversion funnels
* **System Performance:** API response times, service health

---

## 21) Internationalization (i18n)

### Multi-language Support

* **Route-based:** `/[locale]/dashboard` structure
* **Content Translation:** Multi-language content support
* **RTL Support:** Right-to-left language support
* **Currency Localization:** Regional currency and payment methods

---

## 22) Progressive Web App (PWA)

### PWA Features

* **Offline Support:** Cached content for offline learning
* **Push Notifications:** Course reminders and updates
* **Installation:** Add to home screen capability
* **Background Sync:** Sync progress when connection restored

---

## 23) Deployment & CI/CD

### Build Pipeline

* **Linting:** ESLint + Prettier
* **Type Checking:** TypeScript strict mode
* **Testing:** Unit, integration, and E2E tests
* **Bundle Analysis:** Performance monitoring
* **Security Scanning:** Dependency vulnerability checks

### Environment Configuration

```typescript
// .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
NEXT_PUBLIC_CDN_URL=https://cdn.suuupra.com
NEXT_PUBLIC_SENTRY_DSN=https://...
AUTH_SECRET=...
DATABASE_URL=...
REDIS_URL=...
```

---

## 24) Single Source of Truth Prompt (for AI scaffolding)

```prompt
You are a senior frontend architect building the Suuupra EdTech platform. 

Target stack: Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query. Use React Server Components for cacheable reads and Client Components for interactivity.

The platform has 20+ microservices including:
- Identity/Auth (JWT + OIDC)
- Commerce (carts, orders, saga orchestration)  
- Payments (intents, UPI, bank transfers, webhooks)
- Content (courses, videos, articles)
- Live Classes (WebRTC rooms, chat)
- Mass Live Streaming (large events)
- VOD (video-on-demand with upload)
- LLM Tutor (AI chat with voice support)
- Creator Studio (content creation tools)
- Analytics (event tracking, dashboards)
- Admin (user management, system monitoring)

All APIs are accessible via API Gateway at localhost:8080 and documented in the OpenAPI spec.

Generate the complete frontend architecture with:

1) Route implementation exactly as specified in SUUUPRA-FRONTEND-ARCHITECTURE.md
2) API client with token refresh, error handling, and request/response interceptors
3) Authentication middleware for route protection
4) TanStack Query hooks for all API endpoints with appropriate cache strategies
5) TypeScript types generated from OpenAPI schemas
6) Form validation using Zod
7) Real-time features for live streaming and AI chat
8) Error boundaries and loading states for all routes
9) Responsive design with Tailwind
10) E2E tests for critical user flows

Focus on creating a production-ready, scalable frontend that handles:
- Multi-role authentication (User, Creator, Admin)
- Real-time learning experiences  
- Payment processing with multiple methods
- AI-powered tutoring
- Live and on-demand video streaming
- Comprehensive analytics and monitoring

Return organized code files with proper TypeScript types, error handling, and performance optimizations.
```

---

## 25) Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Next.js 15 setup with App Router
- [ ] Authentication system with Identity Service
- [ ] Basic layouts and navigation
- [ ] API client with error handling
- [ ] Core UI components (forms, tables, cards)

### Phase 2: Core Features (Week 3-4)
- [ ] Course catalog and content browsing
- [ ] Shopping cart and basic e-commerce
- [ ] User profile and settings
- [ ] Basic analytics dashboard
- [ ] Search functionality

### Phase 3: Interactive Features (Week 5-6)
- [ ] Live class integration with WebRTC
- [ ] AI tutor chat interface
- [ ] Video upload and management
- [ ] Payment processing (UPI, bank transfers)
- [ ] Real-time notifications

### Phase 4: Advanced Features (Week 7-8)
- [ ] Creator Studio tools
- [ ] Mass live streaming
- [ ] Advanced analytics and reporting
- [ ] Admin panel with system monitoring
- [ ] Webhook management

### Phase 5: Optimization (Week 9-10)
- [ ] Performance optimization
- [ ] PWA implementation
- [ ] Comprehensive testing
- [ ] Security audit
- [ ] Production deployment

---

## 26) Key Technical Decisions

### Architecture Principles

1. **API-First:** All data flows through documented REST APIs
2. **Progressive Enhancement:** Works without JavaScript for core content
3. **Responsive Design:** Mobile-first approach with Tailwind
4. **Accessibility:** WCAG AA compliance throughout
5. **Performance:** Core Web Vitals optimization
6. **Security:** Defense in depth with multiple layers
7. **Scalability:** Component reusability and code splitting
8. **Maintainability:** Clear separation of concerns and documentation

### Technology Choices

* **Next.js 15:** App Router for file-based routing and RSC
* **TypeScript:** Strict type safety with OpenAPI-generated types
* **TanStack Query:** Robust server state management
* **Tailwind CSS:** Utility-first styling with design system
* **shadcn/ui:** High-quality component library
* **Zustand:** Minimal global state management
* **Zod:** Runtime type validation for forms and API responses

---

**End of Document - Ready for Implementation**

This comprehensive architecture document provides a complete blueprint for building the Suuupra platform frontend, with every API endpoint mapped to specific UI components and user flows.
