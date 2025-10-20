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

### October 20, 2025 - Mobile Quiz UX Improvements
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