# JKMT CRM — WhatsApp Sales CRM

React + Vite frontend for Jai Kunjal Mata Textile. Backend = Supabase (Postgres, Storage, Edge Functions).

## Run locally
```
cp .env.example .env   # add VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Deploy on Hostinger (Web App from GitHub)
- Framework: Vite / static
- Build command: `npm run build`
- Output directory: `dist`
- Node: 18+
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Supabase
- Tables: contacts, leads, messages, products, photos, follow_ups, quick_replies, ai_settings, profiles
- Edge functions: `wa-webhook` (Meta → DB), `wa-send` (app → Meta)
- Storage bucket: `product-photos`
