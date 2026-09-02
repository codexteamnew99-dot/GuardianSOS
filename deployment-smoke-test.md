# Deployment smoke-test findings

Date: 2026-09-02

The Expo web export completed successfully with `npm run build:web`, and the static bundle loaded in Chromium without browser console output. When tested without environment variables, the app intentionally rendered its configuration screen stating that Supabase is not configured. This is expected for a build without `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; Vercel must define both variables before deployment so the authenticated app can start.

A direct `/home` route also loaded through the static server and showed the branded setup notice rather than a 404. The browser console remained empty, indicating no JavaScript runtime error in the exported bundle during this unauthenticated configuration-state test.
