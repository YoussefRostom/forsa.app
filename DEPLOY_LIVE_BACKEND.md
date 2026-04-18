# Live Backend Deployment

This app is not Firebase-only in production. The following features need the Node backend in [backend](backend):

- Booking creation
- Booking-linked QR check-in
- OTP send and verify
- Notification fanout
- Signed media actions

## Recommended host

Use Render with the blueprint file in [render.yaml](render.yaml). The backend already builds cleanly with `npm run build`.

## What to deploy

- Service type: Node web service
- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Health check: `/health`

## Required backend environment variables

Copy values from [backend/.env.example](backend/.env.example) and set these in Render:

- `NODE_ENV=production`
- `API_URL=https://your-backend-domain.onrender.com`
- `JWT_SECRET=<long-random-secret>`
- `JWT_REFRESH_SECRET=<long-random-secret>`
- `FIREBASE_SERVICE_ACCOUNT_KEY=<single-line Firebase service account JSON>`

## Required for production features

- OTP:
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
- Media signed actions:
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## App wiring after backend deploy

After Render gives you the live backend URL:

1. Set `EXPO_PUBLIC_BACKEND_URL` to that URL for the app production environment.
2. Build a new production app with EAS.
3. Submit that build to TestFlight.

## EAS commands

Set the production backend URL in Expo/EAS:

```bash
eas env:create --environment production --name EXPO_PUBLIC_BACKEND_URL --value https://your-backend-domain.onrender.com
```

Then create a new iOS build:

```bash
eas build -p ios --profile production
```

Then submit the latest build:

```bash
npx eas submit -p ios --latest
```

## Minimum live checklist

Before calling the app live, verify these URLs respond successfully:

- `GET /health`
- `POST /api/bookings`
- `POST /api/bookings/:id/check-in`
- `POST /api/notifications/dispatch`
- `POST /api/media/signed-url`

## Important note

If you do not deploy the backend and set `EXPO_PUBLIC_BACKEND_URL`, bookings and booking-linked check-ins will not work in production by design.