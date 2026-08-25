# JKMT CRM — WhatsApp Sales CRM

Lead and chat management for JKMT Fabrics (Jai Kunjal Mata Textile). Customers write on
WhatsApp; this app shows every conversation as an inbox, keeps a lead record behind each chat,
and replies — by hand or through an AI auto-reply.

This is a separate thing from the stock software (`~/Development/Software`). That repo stays
local because its `api.php` carries live credentials; **this one is on GitHub**
(`github.com/vijaypareek13/jkmt-crm`, branch `main`) precisely because it carries none — every
key comes from `.env`, and `.env` is gitignored. Keep it that way: nothing secret goes in the
code, ever. The anon key and project URL are the only things the browser holds, and both are
public by design.

## The two halves

**This repo is only the frontend** — React + Vite, no backend code here. The backend is
Supabase project `nrccjnfggpsqbsvcoclo`: Postgres, Realtime, Storage, and two Edge Functions.

| File | What it is |
|---|---|
| `src/App.jsx` | Session gate — Login or Inbox |
| `src/components/Inbox.jsx` | Thread list, search, status filters |
| `src/components/Chat.jsx` | One conversation — messages, composer, photo send |
| `src/components/LeadPanel.jsx` | The lead drawer — contact details, status, follow-up, AI toggle |
| `src/components/PhotoPicker.jsx` | Product photo library — upload once, send with one tap |
| `src/components/Login.jsx` | Supabase email/password sign-in |
| `src/lib/supabase.js` | Client, `sendWhatsApp()`, `STATUS`, `fmtTime()` |

**The Edge Functions' source is not in this repo.** `wa-webhook` and `wa-send` (both at v5)
live only in the Supabase deployment. Read them through the Supabase MCP before touching
anything about sending or receiving — and committing their source here one day would be worth it.

## How a message moves

- **Inbound**: Meta calls `wa-webhook` (deployed with `verify_jwt` off — Meta cannot sign a
  Supabase JWT). It writes into `messages`, and the app's Realtime subscription re-pulls the
  `inbox` view. The app never talks to Meta directly.
- **Outbound**: everything goes through `sendWhatsApp()` → `wa-send` (JWT required). The Meta
  access token lives in the Edge Function's secrets, so the browser never holds it — the same
  rule as the stock software's OpenAI key, for the same reason.
- Delivery ticks (`queued → sent → delivered → read` / `failed`) come back through the webhook
  as status updates on the message row.

## The database

Tables (all with RLS): `contacts`, `leads`, `messages`, `products`, `photos`, `follow_ups`,
`lead_status_history`, `quick_replies`, `ai_settings`, `profiles`. One view, **`inbox`** — a
thread per contact with last message, unread count and lead status joined in. The thread list
reads only this view; if a new per-thread figure is needed, it goes into the view, not into a
second query in the browser.

A contact is the person; a lead is the deal. `LeadPanel` creates the lead on first save if the
chat arrived without one (`source: 'manual'`). Lead statuses are fixed in `STATUS`
(`src/lib/supabase.js`): `new`, `follow_up`, `pending`, `closed_won`, `closed_lost` — the DB
and the UI both depend on these exact keys.

Two flags per lead drive the inbox: `ai_enabled` (auto-reply on/off for that chat) and
`needs_human` (the AI asked for a person — shows as the red dot and the "Needs me" filter).

Storage bucket `product-photos` is **public on purpose**: its URLs are handed to Meta to
deliver as WhatsApp images, so they must be fetchable without auth. Only product photos go in
it — nothing about customers.

## Running and deploying

```
cp .env.example .env   # fill VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Deployed on Hostinger as a Web App connected to this GitHub repo: build `npm run build`,
output `dist`, Node 18+, env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in the
Hostinger panel. **A push to `main` is a deploy** — so `main` stays working, and anything
half-done goes on a branch.

## Editing rules

- Realtime handlers re-`load()` the whole list rather than patching state. Cheap at this size;
  if it ever gets slow, fix it in the view, not with client-side bookkeeping.
- `Chat` is keyed by `contact_id`, so switching threads remounts it — effects can assume one
  conversation per mount.
- Messages render with `white-space: pre-wrap` and React escaping; nothing is ever put through
  `dangerouslySetInnerHTML`. Chat text is customer input — treat it as hostile.
- The UI speaks English, like the stock software. Comments may explain why in plain words.

## A message that reached the phone and never reached the screen (fixed 2026-08-25)

Replies sent from the CRM were delivered on WhatsApp but never appeared in the chat.
`messages.sent_by` carries a foreign key to `profiles`, and `profiles` was empty — nothing had
ever written a row there. So every send from a logged-in browser (where `wa-send` reads the
user id out of the JWT) was refused by the FK, while curl tests without a login token slipped
through with `sent_by` null. And `wa-send` discarded the insert error and answered `ok`, so
the screen had no way to say anything.

Three fixes, all live: `profiles` is backfilled and a trigger on `auth.users` writes the row
for every new sign-up; `wa-send` (v6) reports `db_error` instead of swallowing it; and `Chat`
shows "Sent to WhatsApp, but not saved in the CRM" when that happens — without inviting a
resend, because the customer did get the message.

The lesson is the stock software's own: **a refused write must be said plainly**. Any new
write path in an Edge Function checks the insert error, always. Two test replies from
2026-08-25 ~07:16 UTC are gone for good — they were delivered but never recorded.

## Still open

- Edge Function source is not committed anywhere.
- `products`, `follow_ups`, `quick_replies`, `lead_status_history` tables exist but no screen
  reads them yet.
- The DB holds a few test rows (one contact, four messages) from development.
