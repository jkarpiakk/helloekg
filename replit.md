# EKG Academy

## Overview

EKG Academy is a comprehensive e-learning platform designed for teaching electrocardiogram (ECG/EKG) interpretation through interactive quizzes. The platform targets medical students, nursing students, paramedics, and healthcare professionals seeking to improve their ECG analysis skills.

The application provides a quiz-based learning experience with immediate feedback, progress tracking, certification system, and multi-language support (currently Polish with internationalization architecture for English and Spanish). Users can access different learning modes including regular learning, review of incorrect answers, and exam simulations.

## Product Focus

**Current MVP Focus**: Core learning platform with quiz system, progress tracking, and certification.

**Future Features** (implemented but disabled for users, available in Admin Panel → Future tab):
- **Gamification System**: Duolingo-style engagement with XP points, levels, streak tracking, achievements, and activity heatmaps
- **Live EKG Simulator**: Real-time interactive cardiac rhythm simulator with 3D heart visualization and 5 different arrhythmias

These advanced features are fully developed and tested but temporarily disabled to focus on perfecting the core product experience. Admins can access and test these features in the dedicated "Future" tab within the admin panel.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### December 11, 2025 - Streamlined Guest Checkout Flow

#### Simplified Payment UX
- **Guest Checkout**: Users can now pay without creating an account first - just enter email on pricing card and go to Stripe
- **Auto Account Creation**: After successful payment, account is automatically created with email-verified status
- **Auto Login**: Users are automatically logged in after payment completion
- **Simplified Registration**: Registration form now only requires email and password (removed firstName, lastName, profession fields)

#### API Endpoints
- `POST /api/stripe/guest-checkout` - Creates Stripe checkout session for guests (email + planId → Stripe URL)
- `POST /api/stripe/finalize-payment` - Called on payment-success page, auto-creates account if guest, logs user in

#### UX Flow
1. Guest clicks "Wybierz plan" on pricing card
2. Email input appears on the card
3. Enter email → Click "Przejdź do płatności" → Stripe Checkout
4. After payment → Automatic account creation + login → Dashboard

### December 8, 2025 - Premium App Store Quality Design System (Full Application)

#### App Store Quality Mobile + Desktop Experience
- **Completely Redesigned Dashboard**: Separate mobile (<768px) and desktop (≥768px) layouts with premium styling
- **Desktop Premium Hero Header**: Gradient background with blur effects, streak badge, subscription indicator
- **Desktop Sidebar Cards**: Certyfikat, Słabe obszary, Statystyki with premium glass styling
- **Desktop Quick Actions**: 3-column grid with hover animations and icon scaling
- **Desktop Module Progress**: Premium card list with dividers, chevron arrows, hover states

#### Mobile Dashboard Components
- **Welcome Header**: Greeting with streak badge and subscription indicator
- **ProgressCard**: Large 176px animated SVG progress ring with gradient stroke and 3 stat tiles
- **Quick Actions Grid**: 3-column touch-optimized tiles (Kontynuuj, Powtórka, Wykład)
- **Module Progress Cards**: Glass cards with numbered icons, progress bars, chevron arrows
- **Certificate Status**: Premium card with eligibility status
- **Stats Grid**: Bottom grid with questions count, average time, accuracy

#### Quiz Interface Premium Mobile Audit
- **Question Cards**: glass-card styling, 48px+ touch targets for answers
- **Answer Options**: active:scale-[0.97] touch feedback, shadow-glow-success on correct
- **Explanation Panel**: Readable 16px+ text, premium styling, motion-safe animations
- **Progress Bar**: Gradient fill, thicker height (h-2.5), shadow-inner
- **Navigation Buttons**: min-h-[48px] touch targets, shadow-glow-primary

#### Lecture Pages Premium Mobile Audit
- **Sticky Header**: Glass-card with progress bar and blur effects
- **Chapter Navigation**: Horizontal scrollable on mobile
- **Content Cards**: glass-card, rounded-2xl, shadow-app-lg styling
- **Bottom Navigation**: Fixed bar with 44px+ touch targets
- **EKG Simulator**: Mobile-optimized with responsive SVG display

#### Home Page Premium Mobile Audit
- **Hero Section**: 44px+ CTA touch targets, active:scale-[0.97] feedback
- **Feature Cards**: Stacked grid on mobile, premium shadows
- **Pricing Section**: Mobile-responsive cards with touch-friendly buttons
- **Footer**: 2-column mobile grid, readable text sizes

#### Premium CSS Design System (index.css)
- `.glass-card` / `.glass-card-light` - Glassmorphism with backdrop-blur
- `.stat-card-teal/orange/purple` - Gradient stat tiles
- `.shadow-app` / `.shadow-app-lg` - Premium depth shadows
- `.shadow-glow-primary/success` - Glow effects for interactive elements
- `.animate-slide-up` / `.stagger-*` - Entrance animations (motion-safe)
- `.text-display` / `.text-section` - Premium typography
- `.app-gradient-hero` / `.app-gradient-dark` - Hero gradient backgrounds

#### Touch & Accessibility
- All interactive elements ≥44px touch targets (buttons 48px+)
- `active:scale-[0.97]` touch feedback on all buttons
- `motion-safe:` prefixes for all animations (respects user preferences)
- iOS safe-area support (safe-top, safe-bottom classes)

### October 20, 2025 - Mobile UX Optimizations

#### Home Page Mobile Optimization
- **Responsive Typography**: Mobile-first scaling with proper breakpoints
  - Hero title: text-2xl (32px) on mobile → text-6xl on desktop
  - Body text: text-sm (14px) on mobile → text-base/lg on larger screens
  - All icons scaled: h-4 on mobile → h-5/h-8 on larger screens
- **Compact Spacing**: Reduced padding and margins for mobile
  - Section padding: py-12 on mobile → py-20 on desktop
  - Card padding: p-3/p-4 on mobile → p-6/p-8 on desktop
  - Tighter gaps and spacing throughout (gap-4 → gap-8)
- **Touch-Optimized**: All interactive elements meet minimum touch target sizes
  - CTA buttons: 40px height minimum
  - Quiz options: 46px touch targets
  - Proper spacing between interactive elements
- **No Zoom Required**: Page displays properly on 375x667 viewport without horizontal scroll or need for zoom out

#### Quiz Interface Mobile Improvements
- **Auto-scroll to Question**: Implemented automatic scroll to top when navigating between quiz questions (Next/Previous). Uses `window.scrollTo({ top: 0, behavior: 'smooth' })` with 100ms delay to ensure smooth mobile experience.
- **Ultra-Compact Mobile Panel**: Aggressively optimized explanation panel for mobile devices:
  - Icon container: 40px → 32px (w-10 → w-8)
  - Check/X icons: 20px → 16px (h-5 w-5 → h-4 w-4)
  - Result title: text-xl → text-base (24px → 16px)
  - Content text: text-sm → text-xs (14px → 12px)
  - All padding: p-3 → p-2 (12px → 8px)
  - Border width: border-2 → border (2px → 1px)
  - Margins reduced ~40% throughout
  - Maintains larger comfortable sizes on tablet/desktop (sm+ breakpoints)
- **Instant Explanation Display**: Backend now sends `correctIndex` and `explanation` with quiz questions; frontend uses optimistic UI update to display results immediately (<50ms) without waiting for API response.

## System Architecture

### Frontend Architecture
- **React SPA with TypeScript**: Built using Vite for fast development and optimized production builds
- **UI Framework**: Shadcn/ui components with Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design system and CSS variables for theming
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation schemas
- **Internationalization**: Custom i18n system with translation keys and locale support

### Backend Architecture
- **Node.js with Express**: RESTful API server with TypeScript
- **Session Management**: Express sessions with secure HTTP-only cookies
- **Authentication**: BCrypt for password hashing with role-based access control
- **API Structure**: Modular route handlers with middleware for authentication, authorization, and rate limiting
- **File Upload**: Support for ECG image attachments to quiz questions
- **Email Service**: Nodemailer integration for user verification and notifications

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Comprehensive relational design including:
  - Users with role-based permissions (student, reviewer, admin, owner)
  - Subscription plans and user access management
  - Course sections and quiz questions with multi-choice answers
  - Progress tracking and attempt history
  - Certificate generation with public verification
  - Audit logging for administrative actions

### Authentication & Authorization
- **Multi-role System**: Owner, Reviewer, DeveloperAdmin, Support, and Student roles
- **Content Workflow**: Draft → Review → Published workflow for question management
- **Session Security**: HTTP-only cookies with CSRF protection
- **Rate Limiting**: API endpoint protection against abuse

### Payment Integration
- **Stripe Integration**: Card payments, Apple Pay, Google Pay support
- **Subscription Plans**: 1-month (60 PLN), 3-month (100 PLN), and 12-month (169 PLN) access tiers
- **Webhook Processing**: Automated access activation and expiration handling
- **Invoice Generation**: PDF invoice generation and payment history

### Quiz Engine
- **Question Types**: Multiple choice (4 options) with markdown content support
- **Learning Modes**: 
  - Learn mode with immediate feedback
  - Review mode using spaced repetition algorithms
  - Exam mode with time limits and final scoring
- **Progress Tracking**: Completion percentages, success rates, and weak area identification
- **Image Support**: ECG image uploads with lightbox viewing

## External Dependencies

### Core Infrastructure
- **Database**: PostgreSQL via Neon serverless with connection pooling
- **File Storage**: Planned S3-compatible storage for ECG images and certificates
- **CDN**: Content delivery for static assets and images

### Payment Processing
- **Stripe**: Primary payment processor for international cards and digital wallets
- **Local Payment Gateway**: PayU/Przelewy24 integration for Polish market

### Email Services
- **SMTP Provider**: Configurable email service (Gmail SMTP default) for:
  - User registration verification
  - Password reset flows
  - Certificate delivery
  - Administrative notifications

### Development Tools
- **TypeScript**: Full-stack type safety with shared schema definitions
- **Drizzle Kit**: Database migrations and schema management
- **Vite**: Frontend build tool with HMR and optimization
- **ESBuild**: Backend bundling for production deployment

### Security & Compliance
- **GDPR Compliance**: User consent management and data protection
- **WCAG 2.1 AA**: Accessibility standards implementation
- **CSP**: Content Security Policy headers
- **Rate Limiting**: Request throttling and abuse prevention

### Monitoring & Analytics
- **Audit Logging**: User action tracking for administrative oversight
- **Performance Monitoring**: Query optimization and response time tracking
- **User Analytics**: Learning progress and engagement metrics