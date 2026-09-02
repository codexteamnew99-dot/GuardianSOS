# GuardianSOS

GuardianSOS is an Expo Router app for sending an emergency alert, sharing a live location, and contacting a trusted safety circle. The same project can run on iOS, Android, and the web.

## Vercel deployment

The repository includes a `vercel.json` configured for Expo’s static web export. In Vercel, import the repository and keep the detected framework settings overridden by the repository configuration. The build should use `npm ci`, run `npm run build:web`, and serve the generated `dist` directory.

Before the first deployment, add these **Production** environment variables in Vercel Project Settings → Environment Variables:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The Supabase URL and publishable/anonymous key are public client variables by design. Never add a Supabase service-role key to this project or to Vercel. `GOOGLE_MAPS_API_KEY` is optional for native Android map tiles and is not required by the web fallback.

After adding or changing environment variables, redeploy the project because Expo inlines `EXPO_PUBLIC_*` values during the web build. The web app uses a client-side fallback route, so direct links such as `/home`, `/contacts`, and `/sos/<id>` continue to load correctly.

## Local verification

```bash
npm ci
npm run typecheck
npm run build:web
```

The generated `dist` directory is intentionally ignored by Git. Do not commit `.env` or `.env.local` files.

## Native development

```bash
npm run start
npm run web
npm run android
npm run ios
```

On the web, SMS and calling use browser-safe composer/dialer links. Native Android direct SMS and calling require the configured development build and runtime permissions.
