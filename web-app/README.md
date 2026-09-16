# Machinery web dashboard

Online-only web client for the same NestJS API the Flutter app uses. It does **not**
queue writes, keep a local mirror, or register a service worker. The mobile app owns
offline; this app reads and writes straight through `/api/bff/*`.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui · TanStack Query ·
next-intl (Arabic default, RTL from day one).

## Setup

```bash
cd web-app
cp .env.example .env.local
npm install
npm run i18n:sync
npm run api:types
npm run dev          # http://localhost:3001  (API stays on :3000)
```

`API_BASE_URL` is server-only. The browser never sees NestJS, never sees a refresh token.

## Quality gate

```bash
npm run lint && npm run typecheck && npm run api:types && git diff --exit-code
npm run i18n:check && npm run tokens:check && npm run test && npm run build
```

Plan: `machinery-web-plan/`. Tokens come from `mobile-app/lib/core/theme/styles/`.
Types come from `backend/api/openapi.json`.
