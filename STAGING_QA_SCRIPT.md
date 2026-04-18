# Staging QA Script

## Setup

1. Use a staging Firebase project and staging backend env with valid `JWT_SECRET` and `JWT_REFRESH_SECRET`.
2. Seed or prepare these accounts: `admin`, `academy`, `clinic`, `player`, `parent`, `agent`.
3. Confirm push tokens are enabled on at least one iOS or Android test device per role you plan to verify.
4. Clear any leftover test bookings, transactions, payouts, notifications, and check-ins before the run.

## Global Smoke

1. Launch the app cold on iOS and Android.
2. Sign in and sign out once with each role.
3. Kill and reopen the app to confirm session persistence and correct role routing.
4. Verify no screen gets stuck in an infinite loader, blank state, or crash loop.

## Admin

1. Open admin users list, user detail, bookings list, bookings detail, check-ins, money, and reports.
2. Suspend a non-admin user and verify they are blocked on next app refresh.
3. Reactivate that user and verify sign-in works again.
4. Send an admin message to a user and verify in-app notification delivery.
5. Verify money dashboard loads, transactions appear, and no other-role data is missing unexpectedly.

## Academy

1. Sign in as academy and verify academy profile, bookings, services, messages, and media screens load.
2. Create an academy booking from a player or parent account.
3. Confirm the academy sees the booking and can update its status.
4. Scan a valid customer QR or booking QR and verify one check-in is recorded.
5. Attempt an immediate duplicate scan and confirm it is blocked.

## Clinic

1. Sign in as clinic and verify clinic profile, bookings, services, timetable, messages, and media screens load.
2. Create a clinic booking from a player or parent account.
3. Confirm the clinic sees the booking and can update its status.
4. Scan a valid customer QR or booking QR and verify one check-in is recorded.
5. Attempt an immediate duplicate scan and confirm it is blocked.

## Player

1. Sign in as player and verify feed, bookings, profile, messages, and QR screens load.
2. Open My QR Code and confirm a stable check-in code is generated once and reused.
3. Create a private training booking and an academy or clinic booking.
4. Confirm each booking exists in Firestore and has a matching transaction record.
5. Open booking QR for a confirmed booking and confirm the QR appears only after confirmation.

## Parent

1. Sign in as parent and verify feed, bookings, profile, messages, and QR flows load.
2. Create an academy booking and a clinic booking.
3. Confirm each booking exists in Firestore and has a matching transaction record.
4. Open booking QR for a confirmed booking and confirm the QR appears only after confirmation.
5. Verify parent-owned check-ins and notifications can be viewed without permission errors.

## Agent

1. Sign in as agent and verify search, players, messages, feed, and profile screens load.
2. Confirm agent cannot access admin-only screens or actions.
3. Confirm agent cannot create check-ins or read other providers' finance data.

## Notifications

1. Create a booking and verify provider and admin notifications are created.
2. Mark a notification as read and verify it updates without permission errors.
3. Confirm non-admin users cannot generate fake `system` notifications.
4. Verify push delivery on at least one real device for booking and check-in notifications.

## Firestore Integrity

1. For each new booking, verify exactly one booking document and one matching transaction document exist.
2. For each successful booking-linked check-in, verify the booking is marked completed and not re-usable.
3. Confirm academy and clinic users only see their own transactions and payouts.
4. Confirm players and parents only see their own notifications and check-ins.
5. Confirm check-in code documents are readable by direct lookup but not enumerable by non-admin users.

## Backend

1. Start the backend with staging env vars and verify it boots cleanly.
2. Remove `JWT_SECRET` or `JWT_REFRESH_SECRET` and confirm startup fails fast.
3. Exercise `/api/auth`, `/api/bookings`, `/api/admin`, and `/api/media` on staging.
4. Verify admin routes reject non-admin JWTs.
5. Verify media endpoints reject missing or invalid Firebase ID tokens.

## Exit Criteria

1. No crashes on core flows.
2. No permission-denied errors on expected user actions.
3. No duplicate booking transactions.
4. No duplicate booking-linked check-ins.
5. No cross-provider finance data exposure.