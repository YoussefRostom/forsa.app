# Forsa App - Complete Backend Development Plan

## 📋 Overview
Complete backend implementation plan for Forsa app. Migrating from Firebase to production-ready Node.js backend with PostgreSQL, supporting video-heavy content, bookings, admin moderation, and scalable architecture.

---

## 🎯 Backend Goals

✅ **Primary Objectives:**
- Build full backend supporting current React Native/Expo frontend
- Provide stable APIs + database + authentication
- Handle media-heavy usage (lots of long videos)
- Support bookings between users
- Include admin role with moderation and management tools
- Deploy in production-ready way (cloud + monitoring + backups)

---

## 🗄️ Database: PostgreSQL ✅

**Decision: PostgreSQL**

**Reasons:**
- Relational data with strong relationships (users, bookings, content)
- ACID compliance for bookings and transactions
- Complex queries for search, filtering, reporting
- Data integrity with foreign keys and constraints
- Production-ready scalability
- Better for structured data with relationships

---

## 🏗️ Tech Stack

```
Backend Framework: Node.js + Express.js
Database: PostgreSQL 15+
ORM: Prisma (type-safe, migrations, excellent DX)
Authentication: JWT + bcrypt
File Storage: AWS S3 (for videos/images)
Video Processing: AWS MediaConvert / FFmpeg (optional, future)
Validation: Zod (type-safe validation)
Environment: dotenv
API Docs: Swagger/OpenAPI
Logging: Winston / Pino
Error Tracking: Sentry
Background Jobs: Bull (Redis-based) for heavy tasks
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # Prisma client
│   │   ├── aws.ts               # AWS S3 config
│   │   ├── jwt.ts               # JWT config
│   │   └── env.ts               # Environment validation
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── migrations/          # Migration files
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── content.controller.ts
│   │   ├── media.controller.ts  # Video/image uploads
│   │   ├── booking.controller.ts
│   │   ├── message.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── admin.controller.ts   # Admin moderation
│   │   └── report.controller.ts # Content/user reports
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── content.routes.ts
│   │   ├── media.routes.ts
│   │   ├── booking.routes.ts
│   │   ├── message.routes.ts
│   │   ├── notification.routes.ts
│   │   ├── admin.routes.ts
│   │   └── report.routes.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT verification
│   │   ├── role.middleware.ts    # RBAC
│   │   ├── validation.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   ├── errorHandler.middleware.ts
│   │   └── upload.middleware.ts  # File upload validation
│   ├── services/
│   │   ├── s3.service.ts        # AWS S3 operations
│   │   ├── video.service.ts     # Video processing (future)
│   │   ├── email.service.ts     # Email notifications
│   │   ├── notification.service.ts
│   │   └── payment.service.ts   # Future payment integration
│   ├── jobs/
│   │   ├── videoProcessing.job.ts  # Background video tasks
│   │   ├── thumbnailGeneration.job.ts
│   │   └── cleanup.job.ts       # Cleanup deleted media
│   ├── utils/
│   │   ├── bcrypt.util.ts
│   │   ├── jwt.util.ts
│   │   ├── validators.ts
│   │   ├── logger.ts
│   │   └── helpers.ts
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   └── app.ts                   # Express app setup
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   └── api/                     # API documentation
├── .env.example
├── .env
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma
└── server.ts                     # Entry point
```

---

## 📊 Database Schema (Prisma)

### Core Models

```prisma
// User & Authentication
model User {
  id            String    @id @default(uuid())
  email         String?   @unique
  phone         String    @unique
  passwordHash  String    @map("password_hash")
  role          UserRole
  profilePhotoUrl String? @map("profile_photo_url")
  isVerified    Boolean   @default(false) @map("is_verified")
  isActive      Boolean   @default(true) @map("is_active")
  accountStatus AccountStatus @default(ACTIVE) @map("account_status")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // Relations
  profile       UserProfile?
  posts         Post[]
  bookings      Booking[] @relation("UserBookings")
  providerBookings Booking[] @relation("ProviderBookings")
  sentMessages  Message[]
  conversations1 Conversation[] @relation("Participant1")
  conversations2 Conversation[] @relation("Participant2")
  notifications Notification[]
  reports       Report[] @relation("Reporter")
  reportedBy    Report[] @relation("ReportedUser")
  adminActions  AdminAction[]
  media         Media[]

  @@index([email])
  @@index([phone])
  @@index([role])
  @@map("users")
}

enum UserRole {
  PLAYER
  AGENT
  ACADEMY
  PARENT
  CLINIC
  ADMIN
}

enum AccountStatus {
  ACTIVE
  PENDING_VERIFICATION
  SUSPENDED
  BANNED
}

// Role-specific Profiles
model UserProfile {
  id        String   @id @default(uuid())
  userId    String   @unique @map("user_id")
  role      UserRole

  // Player fields
  playerName String? @map("player_name")
  age        Int?
  position   String?
  height     Decimal? @db.Decimal(5, 2)
  weight     Decimal? @db.Decimal(5, 2)
  bio        String?  @db.Text

  // Agent fields
  agentName    String? @map("agent_name")
  companyName  String? @map("company_name")
  licenseNumber String? @map("license_number")

  // Academy fields
  academyName  String? @map("academy_name")
  city         String?
  address      String? @db.Text
  description  String? @db.Text
  fees         Decimal? @db.Decimal(10, 2)

  // Parent fields
  parentName   String? @map("parent_name")
  childrenCount Int?    @map("children_count")

  // Clinic fields
  clinicName   String? @map("clinic_name")
  workingHours Json?   @map("working_hours") // Store as JSON

  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

// Content & Media
model Post {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  content       String?   @db.Text
  visibility    Visibility @default(PUBLIC)
  likesCount    Int       @default(0) @map("likes_count")
  commentsCount Int       @default(0) @map("comments_count")
  isDeleted     Boolean   @default(false) @map("is_deleted")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  media         Media[]
  likes         PostLike[]
  comments      PostComment[]
  reports       Report[]

  @@index([userId])
  @@index([createdAt])
  @@index([visibility])
  @@map("posts")
}

enum Visibility {
  PUBLIC
  PRIVATE
  ROLE_BASED
}

// Media (Videos & Images)
model Media {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  postId        String?   @map("post_id")
  type          MediaType
  url           String    // S3 URL
  thumbnailUrl  String?   @map("thumbnail_url")
  duration      Int?      // Duration in seconds (for videos)
  size          BigInt    // File size in bytes
  format        String    // mime type
  width         Int?
  height        Int?
  isProcessed   Boolean   @default(false) @map("is_processed")
  processingStatus ProcessingStatus @default(PENDING) @map("processing_status")
  createdAt     DateTime  @default(now()) @map("created_at")

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  post          Post?     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([postId])
  @@index([type])
  @@map("media")
}

enum MediaType {
  IMAGE
  VIDEO
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model PostLike {
  id        String   @id @default(uuid())
  postId    String   @map("post_id")
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([postId, userId])
  @@index([postId])
  @@index([userId])
  @@map("post_likes")
}

model PostComment {
  id        String   @id @default(uuid())
  postId    String   @map("post_id")
  userId    String   @map("user_id")
  content   String   @db.Text
  isDeleted Boolean  @default(false) @map("is_deleted")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@index([userId])
  @@map("post_comments")
}

// Bookings
model Booking {
  id            String        @id @default(uuid())
  userId       String        @map("user_id") // Who made booking
  providerId   String        @map("provider_id") // Academy/Clinic
  bookingType  BookingType   @map("booking_type")
  serviceId    String?       @map("service_id")
  programId    String?       @map("program_id")
  date         DateTime      @db.Date
  time         DateTime      @db.Time
  status       BookingStatus @default(REQUESTED)
  price        Decimal       @db.Decimal(10, 2)
  notes        String?       @db.Text
  paymentStatus PaymentStatus? @default(PENDING) @map("payment_status")
  paymentId    String?       @map("payment_id") // Future payment integration
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  user         User          @relation("UserBookings", fields: [userId], references: [id])
  provider     User          @relation("ProviderBookings", fields: [providerId], references: [id])
  service      Service?      @relation(fields: [serviceId], references: [id])
  program      AcademyProgram? @relation(fields: [programId], references: [id])

  @@index([userId])
  @@index([providerId])
  @@index([status])
  @@index([date])
  @@map("bookings")
}

enum BookingType {
  ACADEMY
  CLINIC
}

enum BookingStatus {
  REQUESTED
  ACCEPTED
  REJECTED
  CANCELLED
  COMPLETED
}

enum PaymentStatus {
  PENDING
  PAID
  REFUNDED
  FAILED
}

// Services & Programs
model Service {
  id          String   @id @default(uuid())
  clinicId    String   @map("clinic_id")
  name        String
  fee         Decimal  @db.Decimal(10, 2)
  description String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  clinic      User     @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  bookings    Booking[]

  @@index([clinicId])
  @@map("services")
}

model AcademyProgram {
  id                String           @id @default(uuid())
  academyId         String           @map("academy_id")
  name              String
  type              AcademyProgramType @default(GROUP_TRAINING) @map("type")
  fee               Decimal          @db.Decimal(10, 2)
  description       String?          @db.Text
  isActive          Boolean          @default(true) @map("is_active")

  // Private Training specific fields
  coachName         String?          @map("coach_name")
  coachBio          String?          @db.Text @map("coach_bio")
  coachPhotoUrl     String?          @map("coach_photo_url")
  specializations    String[]         @map("specializations") // Array of specialization strings
  maxParticipants   Int              @default(1) @map("max_participants")
  duration          Int              @default(60) @map("duration") // Duration in minutes
  availability      Json?            @map("availability") // JSON object with schedule

  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")

  academy           User             @relation(fields: [academyId], references: [id], onDelete: Cascade)
  bookings          Booking[]

  @@index([academyId])
  @@index([type])
  @@index([isActive])
  @@map("academy_programs")
}

enum AcademyProgramType {
  GROUP_TRAINING
  PRIVATE_TRAINING
  SPECIALIZED_PROGRAM
}

// Messaging
model Conversation {
  id            String    @id @default(uuid())
  participant1Id String  @map("participant1_id")
  participant2Id String  @map("participant2_id")
  lastMessageId String?  @map("last_message_id")
  lastMessageAt DateTime? @map("last_message_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  participant1 User      @relation("Participant1", fields: [participant1Id], references: [id])
  participant2 User       @relation("Participant2", fields: [participant2Id], references: [id])
  messages      Message[]

  @@unique([participant1Id, participant2Id])
  @@index([participant1Id])
  @@index([participant2Id])
  @@map("conversations")
}

model Message {
  id            String    @id @default(uuid())
  conversationId String   @map("conversation_id")
  senderId      String    @map("sender_id")
  content       String?   @db.Text
  mediaUrl      String?   @map("media_url")
  isRead        Boolean   @default(false) @map("is_read")
  createdAt     DateTime  @default(now()) @map("created_at")

  conversation  Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender        User         @relation(fields: [senderId], references: [id])

  @@index([conversationId])
  @@index([senderId])
  @@index([createdAt])
  @@map("messages")
}

// Notifications
model Notification {
  id        String           @id @default(uuid())
  userId    String           @map("user_id")
  type      NotificationType
  title     String
  body      String           @db.Text
  relatedId String?          @map("related_id") // ID of related entity
  isRead    Boolean          @default(false) @map("is_read")
  createdAt DateTime         @default(now()) @map("created_at")

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
  @@map("notifications")
}

enum NotificationType {
  BOOKING_CREATED
  BOOKING_UPDATED
  BOOKING_ACCEPTED
  BOOKING_REJECTED
  BOOKING_CANCELLED
  MESSAGE_RECEIVED
  POST_LIKED
  POST_COMMENTED
  ACCOUNT_VERIFIED
  ACCOUNT_SUSPENDED
  CONTENT_REPORTED
  CONTENT_REMOVED
}

// Reports & Moderation
model Report {
  id          String      @id @default(uuid())
  reporterId  String      @map("reporter_id")
  reportedUserId String?  @map("reported_user_id")
  reportedPostId String?  @map("reported_post_id")
  reason      String      @db.Text
  status      ReportStatus @default(PENDING)
  adminNotes  String?     @db.Text @map("admin_notes")
  resolvedAt  DateTime?   @map("resolved_at")
  resolvedBy  String?     @map("resolved_by") // Admin user ID
  createdAt   DateTime    @default(now()) @map("created_at")

  reporter    User        @relation("Reporter", fields: [reporterId], references: [id])
  reportedUser User?      @relation("ReportedUser", fields: [reportedUserId], references: [id])
  post        Post?       @relation(fields: [reportedPostId], references: [id], onDelete: Cascade)

  @@index([reporterId])
  @@index([status])
  @@index([createdAt])
  @@map("reports")
}

enum ReportStatus {
  PENDING
  REVIEWING
  RESOLVED
  REJECTED
}

// Admin Actions (Audit Log)
model AdminAction {
  id          String      @id @default(uuid())
  adminId     String      @map("admin_id")
  actionType  AdminActionType @map("action_type")
  targetUserId String?    @map("target_user_id")
  targetPostId String?    @map("target_post_id")
  targetReportId String?  @map("target_report_id")
  details     Json?       // Additional action details
  createdAt   DateTime    @default(now()) @map("created_at")

  admin       User        @relation(fields: [adminId], references: [id])

  @@index([adminId])
  @@index([actionType])
  @@index([createdAt])
  @@map("admin_actions")
}

enum AdminActionType {
  USER_SUSPENDED
  USER_BANNED
  USER_VERIFIED
  USER_ACTIVATED
  POST_REMOVED
  POST_RESTORED
  REPORT_RESOLVED
  REPORT_REJECTED
  CONTENT_MODERATED
}

// Agent-Player Relationships
model AgentPlayer {
  id        String   @id @default(uuid())
  agentId   String   @map("agent_id")
  playerId  String   @map("player_id")
  status    String   @default("pending") // pending, active, inactive
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([agentId, playerId])
  @@index([agentId])
  @@index([playerId])
  @@map("agent_players")
}
```

---

## 🔐 Authentication & Security

### Authentication Flow

**Sign Up:**
1. User submits email/phone + password + role
2. Backend validates input
3. Hash password with bcrypt (12 rounds)
4. Create user record
5. Generate JWT access token + refresh token
6. Return user data + tokens

**Sign In:**
1. User submits email/phone + password
2. Find user by email/phone
3. Verify password with bcrypt.compare
4. Check account status (active/suspended)
5. Generate JWT tokens
6. Return user data + tokens

**JWT Token Structure:**
```json
{
  "userId": "uuid",
  "role": "player|agent|academy|parent|clinic|admin",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Refresh Token:**
- Stored in database (or Redis)
- Longer expiry (7-30 days)
- Used to get new access tokens

### Security Measures

1. **Password Hashing**: bcrypt with 12 salt rounds
2. **JWT**: Short-lived access tokens (15min-1hr) + refresh tokens
3. **Rate Limiting**: 
   - Auth endpoints: 5 requests/15min
   - Upload endpoints: 10 requests/hour
   - General API: 100 requests/15min
4. **Input Validation**: Zod schemas for all inputs
5. **SQL Injection**: Prisma handles parameterized queries
6. **CORS**: Configured for mobile app domains
7. **Helmet**: Security headers
8. **Request Size Limits**: 50MB for uploads, 1MB for JSON
9. **File Type Validation**: Only allowed image/video formats
10. **Environment Variables**: All secrets in .env

---

## 🎥 Video/Media Handling (Critical)

### Upload Flow

**Direct-to-S3 Upload (Recommended):**
1. Client requests signed URL from backend
2. Backend generates presigned S3 URL (PUT operation)
3. Client uploads directly to S3
4. Client notifies backend of successful upload
5. Backend creates Media record with metadata

**Alternative (Server Upload):**
1. Client uploads to backend endpoint
2. Backend validates file (size, type)
3. Backend uploads to S3
4. Backend creates Media record

### Media Metadata Storage

```typescript
{
  url: "https://s3.../video.mp4",
  thumbnailUrl: "https://s3.../thumb.jpg",
  duration: 3600, // seconds
  size: 104857600, // bytes
  format: "video/mp4",
  width: 1920,
  height: 1080,
  isProcessed: false,
  processingStatus: "PENDING"
}
```

### Video Processing (Future)

- **Thumbnail Generation**: Extract frame at 10% of video
- **Transcoding**: Multiple resolutions (1080p, 720p, 480p)
- **Background Jobs**: Use Bull (Redis) for async processing
- **Cleanup**: Delete S3 objects when media deleted

### Upload Limits

- **Video**: Max 500MB per file, max 5 files per post
- **Image**: Max 10MB per file, max 10 files per post
- **Rate Limit**: 10 uploads/hour per user

---

## 📅 Booking System

### Booking States

```
REQUESTED → ACCEPTED → COMPLETED
         ↘ REJECTED
         ↘ CANCELLED
```

### Booking Flow

1. **Create Booking**: User selects provider, date, time, service/program
2. **Validation**: Check for double-booking, validate time slot
3. **Notification**: Notify provider of new booking request
4. **Provider Action**: Accept/Reject booking
5. **Notification**: Notify user of status change
6. **Completion**: Mark as completed after service

### Double-Booking Prevention

- Check existing bookings for provider at same date/time
- Reject if conflict exists
- Allow cancellation to free up slot

---

## 👮 Admin System

### Admin Capabilities

**User Management:**
- View/search all users
- View user profiles
- Suspend/ban users
- Verify accounts
- View user activity

**Content Management:**
- View all posts/media
- Remove content
- Restore removed content
- View content reports

**Booking Management:**
- View all bookings
- View booking history
- Cancel bookings (if needed)

**Moderation:**
- View pending reports
- Resolve/reject reports
- Take action on reported content/users
- View audit log

**Analytics (Future):**
- User statistics
- Content statistics
- Booking statistics

### Admin APIs

```
GET    /api/admin/users              # List users with filters
GET    /api/admin/users/:id          # Get user details
PUT    /api/admin/users/:id/status   # Update user status
GET    /api/admin/posts              # List all posts
DELETE /api/admin/posts/:id          # Remove post
GET    /api/admin/bookings           # List all bookings
GET    /api/admin/reports            # List reports
PUT    /api/admin/reports/:id        # Resolve report
GET    /api/admin/actions            # Audit log
```

---

## 🔔 Notifications

### Notification Types

- Booking created/updated/accepted/rejected/cancelled
- Message received
- Post liked/commented
- Account verified/suspended
- Content reported/removed

### Implementation

1. **Database Storage**: All notifications in `notifications` table
2. **Real-time (Future)**: Socket.io or Server-Sent Events
3. **Push Notifications (Future)**: Expo Push Notifications
4. **Email (Optional)**: Nodemailer for important notifications

### Notification Service

```typescript
async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  relatedId?: string
) {
  // Create notification record
  // Optionally send push notification
  // Optionally send email
}
```

---

## 📊 Reports & Moderation

### Report Flow

1. User reports content/user
2. Report stored with status PENDING
3. Admin reviews report
4. Admin takes action (remove content, suspend user, etc.)
5. Report status updated to RESOLVED/REJECTED
6. Admin action logged in audit log

### Report Reasons

- Inappropriate content
- Spam
- Harassment
- Fake account
- Other

---

## 💳 Payments (Future-Proof)

### Design for Future Integration

**Database Schema:**
- `paymentStatus` in bookings table
- `paymentId` for transaction reference
- Separate `transactions` table (future)

**Payment Service Interface:**
```typescript
interface PaymentService {
  createPayment(bookingId: string, amount: number): Promise<PaymentResult>;
  verifyPayment(paymentId: string): Promise<boolean>;
  refundPayment(paymentId: string): Promise<boolean>;
}
```

**Future Integration:**
- Stripe / PayPal / Local payment gateway
- Subscription support
- Transaction history

---

## 🛣️ API Endpoints

### Authentication
```
POST   /api/auth/signup
POST   /api/auth/signin
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/verify-email
POST   /api/auth/logout
```

### Users
```
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/:id
GET    /api/users/search
```

### Content/Posts
```
GET    /api/posts                    # Get feed (paginated)
GET    /api/posts/:id
POST   /api/posts                    # Create post
PUT    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/like
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments
```

### Media Upload
```
POST   /api/media/presigned-url      # Get signed URL for direct upload
POST   /api/media/upload              # Server-side upload (alternative)
GET    /api/media/:id
DELETE /api/media/:id
```

### Bookings
```
GET    /api/bookings                 # User's bookings
GET    /api/bookings/:id
POST   /api/bookings                 # Create booking
PUT    /api/bookings/:id             # Update booking (status)
DELETE /api/bookings/:id              # Cancel booking
GET    /api/bookings/provider        # Provider's bookings
```

### Messages
```
GET    /api/conversations
GET    /api/conversations/:id
POST   /api/conversations
GET    /api/messages/:conversationId
POST   /api/messages
PUT    /api/messages/:id/read
```

### Notifications
```
GET    /api/notifications
PUT    /api/notifications/:id/read
PUT    /api/notifications/read-all
```

### Reports
```
POST   /api/reports                  # Create report
GET    /api/reports                  # User's reports (own)
```

### Admin (Admin only)
```
GET    /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id/status
GET    /api/admin/posts
DELETE /api/admin/posts/:id
GET    /api/admin/bookings
GET    /api/admin/reports
PUT    /api/admin/reports/:id
GET    /api/admin/actions            # Audit log
```

### Search
```
GET    /api/search/academies
GET    /api/search/clinics
GET    /api/search/agents
GET    /api/search/players
```

---

## 📝 API Standards

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { ... }
  }
}
```

### Pagination

```
GET /api/posts?page=1&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict (e.g., duplicate)
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

---

## 🔒 Security Checklist

- [x] Password hashing (bcrypt)
- [x] JWT authentication
- [x] Role-based access control
- [x] Rate limiting
- [x] Input validation
- [x] SQL injection prevention (Prisma)
- [x] CORS configuration
- [x] Security headers (Helmet)
- [x] File upload validation
- [x] Request size limits
- [x] Environment variables for secrets
- [x] HTTPS in production
- [x] Error handling (no sensitive data in errors)

---

## 📦 Required Packages

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "@prisma/client": "^5.7.0",
    "prisma": "^5.7.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "@aws-sdk/client-s3": "^3.490.0",
    "@aws-sdk/s3-request-presigner": "^3.490.0",
    "uuid": "^9.0.1",
    "winston": "^3.11.0",
    "@sentry/node": "^7.91.0",
    "bull": "^4.12.0",
    "ioredis": "^5.3.2",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11"
  }
}
```

---

## 🚀 Deployment & Infrastructure

### Cloud Provider Options

**Recommended: AWS / Railway / Render / Fly.io**

### Infrastructure Components

1. **Application Server**: Node.js/Express (multiple instances for scaling)
2. **Database**: PostgreSQL (managed service: RDS, Supabase, Neon)
3. **Storage**: AWS S3 (for videos/images)
4. **Cache**: Redis (for sessions, rate limiting, background jobs)
5. **CDN**: CloudFront (for media delivery)
6. **Monitoring**: Sentry (errors), CloudWatch/DataDog (metrics)
7. **Logging**: CloudWatch Logs / Papertrail

### Environment Setup

**Environments:**
- Development (local)
- Staging (cloud)
- Production (cloud)

**Environment Variables:**
```env
# Database
DATABASE_URL=

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# Redis
REDIS_URL=

# Sentry
SENTRY_DSN=

# Server
PORT=
NODE_ENV=
API_VERSION=

# Email (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

### CI/CD Pipeline

1. **GitHub Actions / GitLab CI**
2. **Steps:**
   - Run tests
   - Build application
   - Run database migrations
   - Deploy to staging/production
   - Health check

### Health Checks

```
GET /health
Response: { "status": "ok", "database": "connected", "redis": "connected" }
```

### Backups

- **Database**: Daily automated backups (retain 30 days)
- **S3**: Versioning enabled
- **Disaster Recovery**: Regular restore testing

---

## 📊 Observability

### Logging

- **Structured Logging**: Winston/Pino with JSON format
- **Log Levels**: error, warn, info, debug
- **Log Aggregation**: CloudWatch / Papertrail / Datadog

### Error Tracking

- **Sentry**: Automatic error capture
- **Error Context**: User ID, request details, stack traces

### Monitoring

- **Metrics**: Request rate, error rate, response time
- **Alerts**: High error rate, slow responses, database issues
- **Dashboards**: Grafana / CloudWatch Dashboards

---

## 📚 API Documentation

### Swagger/OpenAPI

- Auto-generated from code annotations
- Interactive API explorer
- Request/response examples
- Authentication documentation

### Endpoint: `/api-docs`

---

## 🧪 Testing Strategy

### Unit Tests
- Controllers
- Services
- Utilities

### Integration Tests
- API endpoints
- Database operations
- Authentication flows

### E2E Tests
- Complete user flows
- Booking creation
- Content upload

---

## 📅 Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup
- [ ] Database schema & migrations
- [ ] Authentication (signup/signin)
- [ ] JWT middleware
- [ ] User profiles
- [ ] Basic error handling

### Phase 2: Content & Media (Week 2-3)
- [ ] Post model & CRUD
- [ ] Media upload (S3 presigned URLs)
- [ ] Media metadata storage
- [ ] Feed pagination
- [ ] Like/comment system

### Phase 3: Bookings (Week 3-4)
- [ ] Booking model & CRUD
- [ ] Booking state management
- [ ] Double-booking prevention
- [ ] Booking notifications

### Phase 4: Messaging & Notifications (Week 4-5)
- [ ] Conversation & message models
- [ ] Messaging APIs
- [ ] Notification system
- [ ] Notification APIs

### Phase 5: Admin & Moderation (Week 5-6)
- [ ] Admin authentication
- [ ] Admin user management
- [ ] Admin content management
- [ ] Report system
- [ ] Audit logging

### Phase 6: Search & Optimization (Week 6)
- [ ] Search endpoints
- [ ] Database indexing
- [ ] Query optimization
- [ ] Caching (if needed)

### Phase 7: Deployment & Documentation (Week 7)
- [ ] API documentation (Swagger)
- [ ] Deployment setup
- [ ] Monitoring & logging
- [ ] Health checks
- [ ] Backup strategy

### Phase 8: Testing & Polish (Week 8)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance testing
- [ ] Security audit
- [ ] Documentation review

---

## ✅ Deliverables

1. **Backend Repository**
   - Complete source code
   - Setup documentation
   - Environment configuration

2. **Database**
   - Schema definition (Prisma)
   - Migration files
   - Seed data (optional)

3. **API Documentation**
   - Swagger/OpenAPI spec
   - Endpoint documentation
   - Authentication guide

4. **Deployment Guide**
   - Infrastructure setup
   - Environment configuration
   - Deployment steps

5. **Integration Guide**
   - Frontend integration steps
   - API usage examples
   - Error handling guide

---

## 🎯 Next Steps

1. **Review & Approve Plan**: Confirm this plan meets requirements
2. **Setup Backend Project**: Initialize Node.js project with structure
3. **Database Setup**: Create PostgreSQL database, setup Prisma
4. **Start Phase 1**: Begin with authentication & user management

**Ready to start implementation!** 🚀
