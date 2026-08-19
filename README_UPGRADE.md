# HOMEFIX Advanced Upgrade

## Install
npm install lucide-react

## Google Maps
Create `.env` from `.env.example` and set:
VITE_GOOGLE_MAPS_API_KEY=...

Enable Maps JavaScript API, Places API (New), and Routes API in Google Cloud.

## App files
Replace `src/App.jsx` and `src/index.css`, and add `src/GoogleMap.jsx`.
Keep your existing `src/supabase.js`.

## AI
The browser uses `/api/ai` as an optional AI endpoint. For production, route this to a Supabase Edge Function. The included `AI_EDGE_FUNCTION.ts` shows the server-side pattern. Store the OpenAI key as a server secret, never in the browser.

## Production ride-hailing requirements
For real Uber/Rapido-style operation you still need a driver/partner app, driver GPS streaming, ride matching, backend status transitions, push notifications, payments, KYC, safety features, cancellation rules, and server-side fare calculation. The UI included here is a foundation for those flows; it does not fabricate real drivers or live availability.
