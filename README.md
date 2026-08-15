# FlexFit Studio

Class booking and membership management for a single gym site. Members book classes, buy memberships and spend class credits. Staff run the front desk, manage trainers and pull reports. Companies buy credit pools their employees book against.

## Requirements

Node 20 or newer, and pnpm. If you don't have pnpm:

```bash
npm install -g pnpm
```

The database is SQLite and lives in a file. There's no server to install and no account to create.

## Getting set up

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

That gets you a populated studio at http://localhost:3000 with a couple of weeks of classes either side of today.

`db:push` creates `flexfit.db` and applies the schema. `db:seed` fills it with sample members, plans, classes and bookings.

## Signing in

| Role    | Email                  | Password   |
| ------- | ---------------------- | ---------- |
| Admin   | admin@flexfit.test     | admin123   |
| Trainer | arjun@flexfit.test     | trainer123 |
| Member  | rahul.k@example.com    | member123  |

Every seeded member uses `member123`. The other member emails are in `src/db/seed.ts`.

## Commands

| Command         | What it does                                      |
| --------------- | ------------------------------------------------- |
| `pnpm dev`      | Development server on port 3000                    |
| `pnpm build`    | Production build                                   |
| `pnpm db:push`  | Apply the schema in `src/db/schema.ts`             |
| `pnpm db:seed`  | Wipe the data and reseed                           |
| `pnpm db:reset` | Delete the database file, then push and seed again |

`db:reset` is the one you want when the data gets into a state you don't like. It's destructive and it's meant to be.

## Two things that will waste your time

Don't run `pnpm build` while `pnpm dev` is running. The build writes over the directory the dev server is using and the app starts throwing `MODULE_NOT_FOUND`. Nothing is actually broken. Stop the dev server, delete `.next`, start it again. If you want to typecheck while the server is up, use `npx tsc --noEmit` instead.

If you're changing anything in `src/db/schema.ts`, run `pnpm db:push` afterwards or the app and the database will disagree with each other in confusing ways.

## Layout

```
src/
  app/          routes and pages
  components/   shared components
  db/           schema, client, seed data

  lib/          helpers
  server/       tRPC routers
documents/      empty, for your own notes

```
---
# Architectural Refactoring & Service Extraction

This update refactors the application architecture by **decoupling business logic from tRPC router declarations**, eliminating redundant calculations, and breaking down monolithic page components into reusable UI features.

The goal is to create a cleaner separation between routing, domain logic, shared utilities, and presentation while fixing broken user flows such as **Reschedule**, **Book**, and **Schedule**.

---

## 🚀 Summary of Changes

| Category              | Component / Path                                       | Description                                                                                                                                   |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared Utilities**  | `src/lib/utils/date.ts`                                | Centralized `hoursUntil()` calculations, ISO date formatting, and global constants such as `FREE_CANCELLATION_HOURS` and `UNLIMITED_CREDITS`. |
| **Domain Services**   | `src/server/services/membership.service.ts`            | Unified active membership lookup queries and credit-refund calculations across different user contexts.                                       |
| **Domain Services**   | `src/server/services/waitlist.service.ts`              | Isolated automatic waitlist-promotion logic when class spots become available.                                                                |
| **Domain Services**   | `src/server/services/booking.service.ts`               | Centralized cancellation rules, refund eligibility windows, and booking/cancellation execution workflows.                                     |
| **Thin Routers**      | `src/server/routers/bookings.ts`                       | Refactored booking mutations to delegate business workflows directly to `BookingService`.                                                     |
| **Thin Routers**      | `src/server/routers/reschedules.ts`                    | Removed inline timing and membership checks and replaced them with service-layer calls.                                                       |
| **Thin Routers**      | `src/server/routers/corporate-bookings.ts`             | Standardized cancellation-threshold logic using centralized date helpers.                                                                     |
| **Root Router**       | `src/server/routers/_app.ts`                           | Updated the root tRPC router to mount the refactored domain routers without embedded business logic.                                          |
| **Modular UI**        | `src/components/features/admin/`                       | Decomposed the monolithic corporate admin page into reusable components.                                                                      |
| **Modular UI**        | `src/components/features/bookings/RescheduleModal.tsx` | Extracted rescheduling slot selection and state management into a dedicated component.                                                        |
| **Bug Fixes**         | Booking / Scheduling flows                             | Fixed broken options and workflows including **Reschedule**, **Book**, **Schedule**, and related actions.                                     |
| **Testing & Tooling** | `src/**/__tests__/*`                                   | Added unit test coverage for date helpers and domain service-layer behavior.                                                                  |
| **Testing & Tooling** | `scripts/verify-refactor.sh`                           | Added automated verification for directory structure, TypeScript types, and unit tests.                                                       |
| **Database Tooling**  | `scripts/migrate.sh`                                   | Added a shell wrapper for Drizzle Kit schema migrations.                                                                                      |

---

# 🏗️ Architectural Refactoring

Previously, several tRPC routers contained both:

1. API declaration logic
2. Business/domain logic

This made workflows harder to maintain and encouraged duplicate calculations across different routes.

The refactoring introduces a dedicated service layer.

### Before

```text
tRPC Router
    |
    +-- Validation
    +-- Membership Lookup
    +-- Date Calculation
    +-- Cancellation Rules
    +-- Credit Refund
    +-- Booking Mutation
    +-- Waitlist Logic
```

### After

```text
tRPC Router
    |
    +-- Input Validation
    +-- Service Call
            |
            v
      Domain Service
            |
     +------+------+
     |      |      |
     v      v      v
  Membership  Booking  Waitlist
    Service    Service   Service
     |
     v
   Database
```

This makes routers **thin**, while business rules remain centralized and reusable.

---

# 📁 Updated Project Structure

```text
src/
├── components/
│   └── features/
│       ├── admin/
│       │   ├── CompanyHeader.tsx
│       │   ├── CompanyCreditPool.tsx
│       │   └── CompanyMembersTable.tsx
│       │
│       └── bookings/
│           └── RescheduleModal.tsx
│
├── lib/
│   └── utils/
│       └── date.ts
│
├── server/
│   ├── services/
│   │   ├── membership.service.ts
│   │   ├── waitlist.service.ts
│   │   └── booking.service.ts
│   │
│   └── routers/
│       ├── _app.ts
│       ├── bookings.ts
│       ├── reschedules.ts
│       └── corporate-bookings.ts
│
└── __tests__/
    └── ...
    
scripts/
├── verify-refactor.sh
└── migrate.sh
```

---

# 🧰 Shared Date Utilities

## `src/lib/utils/date.ts`

Date and cancellation calculations were centralized into a shared utility module.

This eliminates duplicated implementations of time-window calculations throughout the application.

### Centralized functionality

* `hoursUntil()`
* ISO date formatting
* Cancellation-window calculations
* Shared scheduling constants
* Membership/credit constants

### Global Constants

```ts
FREE_CANCELLATION_HOURS
UNLIMITED_CREDITS
```

The goal is to ensure that every part of the application uses the same business definitions.

### Example

```ts
const hours = hoursUntil(classStart);

if (hours >= FREE_CANCELLATION_HOURS) {
  // Eligible for free cancellation
}
```

Instead of duplicating date arithmetic inside individual routers, components, and services.

---

# 🧩 Domain Service Layer

## Membership Service

### `src/server/services/membership.service.ts`

The membership service provides a single location for membership-related business logic.

### Responsibilities

* Find active memberships
* Resolve memberships for different user contexts
* Calculate available credits
* Calculate credit refunds
* Handle unlimited-credit memberships consistently

This prevents booking and cancellation routers from implementing their own membership queries.

---

## Waitlist Service

### `src/server/services/waitlist.service.ts`

Waitlist behavior has been isolated into a dedicated domain service.

### Responsibilities

* Detect newly available class spots
* Identify eligible waitlisted members
* Automatically promote members
* Maintain consistent promotion behavior
* Coordinate promotion with booking availability

### Workflow

```text
Class Spot Becomes Available
            |
            v
     WaitlistService
            |
            v
   Find Eligible Member
            |
            v
       Auto-Promotion
            |
            v
       Booking Created
```

This keeps waitlist behavior independent from individual router implementations.

---

# 📅 Booking Service

### `src/server/services/booking.service.ts`

The booking service is responsible for core booking lifecycle operations.

### Responsibilities

* Create bookings
* Validate cancellation eligibility
* Calculate cancellation windows
* Determine refund eligibility
* Execute cancellation workflows
* Refund credits when applicable
* Trigger related waitlist behavior

### Centralized Cancellation Logic

```text
Cancellation Request
        |
        v
BookingService
        |
        +--> Check Booking
        |
        +--> Check Cancellation Window
        |
        +--> Check Membership
        |
        +--> Determine Refund
        |
        +--> Execute Cancellation
        |
        +--> Promote Waitlist
        |
        v
     Result
```

This ensures that cancellation behavior is consistent regardless of where the request originated.

---

# 🪶 Thin tRPC Routers

The routers now focus primarily on:

* Input validation
* Authentication/context
* Calling the appropriate service
* Returning service results

They no longer contain large blocks of duplicated domain logic.

---

## `src/server/routers/bookings.ts`

Booking mutations now delegate directly to `BookingService`.

### Previous Pattern

```text
Router
 ├── Query membership
 ├── Calculate time window
 ├── Validate cancellation
 ├── Calculate refund
 ├── Update booking
 └── Handle waitlist
```

### Refactored Pattern

```text
Router
    |
    v
BookingService
    |
    +--> MembershipService
    +--> WaitlistService
    +--> Database
```

This makes booking endpoints easier to read and maintain.

---

# 🔄 Rescheduling

## `src/server/routers/reschedules.ts`

Rescheduling previously contained inline logic for:

* Timing calculations
* Membership validation
* Availability checks
* Booking eligibility

These checks have been moved into the appropriate service/helper layers.

The router now coordinates the request rather than implementing the entire workflow itself.

---

## `src/components/features/bookings/RescheduleModal.tsx`

Rescheduling UI was extracted into a dedicated component.

### Responsibilities

* Display available class slots
* Handle slot selection
* Manage loading state
* Manage selection state
* Submit the reschedule operation
* Handle success/error states

### Reschedule Flow

```text
User selects "Reschedule"
          |
          v
 RescheduleModal
          |
          v
Select New Slot
          |
          v
Submit Reschedule
          |
          v
 tRPC Router
          |
          v
Domain Service
          |
          v
Updated Booking
```

This prevents the parent page from becoming responsible for every aspect of the rescheduling workflow.

---

# 🏢 Corporate Bookings

## `src/server/routers/corporate-bookings.ts`

Corporate booking cancellation logic was standardized against the shared date utilities.

Instead of maintaining separate cancellation-window calculations, the router now uses the centralized date helpers.

This prevents subtle differences between:

* Individual bookings
* Corporate bookings
* Rescheduled bookings
* Cancellation workflows

---

# 🧭 Root tRPC Router

## `src/server/routers/_app.ts`

The root router was updated to mount the refactored domain routers.

```text
_app.ts
   |
   +-- bookings
   +-- reschedules
   +-- corporateBookings
   +-- ...
```

The root router acts as a composition layer rather than a location for business rules.

---

# 🧱 Modular UI Architecture

The corporate administration interface was previously implemented as a large monolithic page.

It has now been divided into reusable feature components.

## Admin Components

### `CompanyHeader`

Responsible for:

* Company information
* Header actions
* Contextual company controls

### `CompanyCreditPool`

Responsible for:

* Credit balance
* Credit pool information
* Credit-related actions

### `CompanyMembersTable`

Responsible for:

* Member listing
* Member information
* Member-level actions
* Table state

### Result

```text
Corporate Admin Page
        |
        +-- CompanyHeader
        |
        +-- CompanyCreditPool
        |
        +-- CompanyMembersTable
```

This makes each UI section independently maintainable and reusable.

---

# 🐛 Fixed Booking & Scheduling Options

This refactor also addressed broken or inconsistent user actions across booking-related workflows.

The following options were reviewed and fixed:

* **Book**
* **Schedule**
* **Reschedule**
* **Cancel**
* **Select available slot**
* **Confirm booking**
* **Return to schedule**
* **Related booking actions**

The objective was not only to move code into services but also to ensure that the extracted architecture continued to support the complete user workflow.

---

# 🔄 Booking Workflow

The updated architecture follows a consistent flow:

```text
User Action
    |
    v
UI Component
    |
    v
tRPC Mutation
    |
    v
Domain Service
    |
    +--> Shared Date Utilities
    |
    +--> Membership Service
    |
    +--> Waitlist Service
    |
    v
Database
    |
    v
Updated UI
```

This provides a clear separation of responsibilities.

---

# 🧪 Testing

Unit test coverage was added under:

```text
src/**/__tests__/*
```

Tests focus on:

* Date helper calculations
* Cancellation timing
* Domain service behavior
* Membership logic
* Booking workflows
* Refactoring invariants

The intent is to ensure that extracting logic from routers does not change expected business behavior.

---

# 🔍 Automated Refactor Verification

## `scripts/verify-refactor.sh`

A dedicated verification script was added to validate the refactor.

It checks:

* Expected directory structure
* Required service files
* Required UI components
* TypeScript compilation/type correctness
* Unit test execution
* Refactoring requirements

Example:

```bash
./scripts/verify-refactor.sh
```

A successful execution indicates that the expected architectural structure and automated checks are passing.

---

# 🗄️ Database Migration Helper

## `scripts/migrate.sh`

A shell wrapper was added around Drizzle Kit migrations.

This provides a consistent project-level entry point for schema migrations.

Example:

```bash
./scripts/migrate.sh
```

The exact migration command can remain encapsulated inside the script so developers do not need to remember the underlying Drizzle Kit invocation.

---

# 🎯 Architectural Goals

This refactor is designed around several core principles.

### 1. Single Responsibility

Routers handle API concerns.

Services handle domain concerns.

Components handle presentation.

Utilities handle reusable calculations.

---

### 2. Don't Repeat Business Logic

Common operations such as:

```text
hoursUntil()
cancellation eligibility
membership lookup
credit refunds
waitlist promotion
```

should have a single source of truth.

---

### 3. Thin Routers

A router should answer:

> "Which operation should execute?"

rather than:

> "How does the entire business workflow work?"

---

### 4. Reusable UI

Large pages should compose smaller feature components rather than implementing every interaction themselves.

---

### 5. Testable Domain Logic

Business rules should be executable independently from HTTP/tRPC router declarations.

This makes unit testing simpler and reduces coupling.

---

# 📊 Before vs. After

| Area                   | Before                | After                        |
| ---------------------- | --------------------- | ---------------------------- |
| Date calculations      | Duplicated            | Centralized                  |
| Cancellation rules     | Router-specific       | `BookingService`             |
| Membership lookup      | Repeated queries      | `MembershipService`          |
| Waitlist promotion     | Embedded in workflows | `WaitlistService`            |
| Booking mutations      | Router-heavy          | Service-driven               |
| Rescheduling           | Inline logic          | Service + `RescheduleModal`  |
| Corporate cancellation | Separate timing logic | Shared date utilities        |
| Admin UI               | Monolithic page       | Modular components           |
| Testing                | Limited coverage      | Service/helper tests         |
| Migrations             | Manual command usage  | `scripts/migrate.sh`         |
| Refactor validation    | Manual                | `scripts/verify-refactor.sh` |

---

# ✅ Expected Result

After this refactor, the application has a clearer separation of concerns:

```text
┌──────────────────────────────┐
│           UI Layer           │
│                              │
│ Admin / Booking Components   │
│ RescheduleModal              │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│          API Layer           │
│                              │
│ Thin tRPC Routers            │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│        Domain Layer          │
│                              │
│ BookingService               │
│ MembershipService            │
│ WaitlistService              │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│       Shared Utilities       │
│                              │
│ Date / Time / Constants      │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│          Database            │
│                              │
│ Drizzle ORM / SQL            │
└──────────────────────────────┘
```

The result is a more maintainable architecture with **centralized business rules, thinner API routers, reusable UI components, fewer redundant calculations, stronger testability, and more reliable booking/rescheduling/scheduling workflows**.

