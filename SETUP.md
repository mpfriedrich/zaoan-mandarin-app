# Setup — instructions for Claude

This file is written for Claude Code. **The person in front of you is not a developer.**
Walk them through the setup step by step, explain things in plain language, and work
through the sections in order. After each section, check with them that it worked.

## Rules for you

- **Never handle their keys in chat.** Have them paste API keys and passwords into
  `.env.local` themselves. Give them a one-click command such as
  `open -a TextEdit "<full path>/.env.local"`. Read values only into shell variables and
  never print them.
- **Don't create accounts and don't type passwords.** They sign up themselves in the
  browser; you give the steps.
- **Ask before downloads and before changing account or project settings.**
- Answer in whatever language they write to you in.

## What this app is

A PWA (Next.js 16, React 19, TypeScript) for learning Mandarin for everyday life in Taiwan.
Local-first with Dexie/IndexedDB, optional sync through Postgres (Neon), FSRS scheduling
(`ts-fsrs`), Azure Speech for audio and pronunciation assessment, the Anthropic API for
role-plays. Traditional characters lead, Taiwan pronunciation, simplified and zhuyin optional.

Where things live:

| Path | Contents |
|---|---|
| `src/content/*.mjs` | All learning content (scenarios, words, signs) — the source of truth |
| `scripts/build-content.mjs` | Compiles it into `src/content/generated.json` (runs automatically before dev/build) |
| `scripts/build-audio.mjs` | Generates missing audio files through Azure |
| `scripts/check-content.mjs` | Checks characters, syllables and tones against CC-CEDICT |
| `src/lib/server/` | Auth, database, push, role-play prompts |
| `src/app/` | Pages (Today, Scenarios, Role-play, Vocabulary, Progress …) |

## Step 1 — Check the tools

1. Run `node --version`. Node 20 or newer is required. If Node is missing, point them to
   <https://nodejs.org> (LTS version) and let them install it themselves.
2. In the project folder: `npm install` (takes a minute or two).

## Step 2 — Create the local config file

1. Copy the template: `cp .env.example .env.local`
2. Generate these values yourself and write them straight into `.env.local`
   (do not print them in chat):
   - `CRON_SECRET` — 32 random characters.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — key pair for push notifications:
     ```
     node -e "const {generateKeyPairSync}=require('node:crypto');const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const pub=publicKey.export({type:'spki',format:'der'}).subarray(26).toString('base64url');const priv=privateKey.export({format:'jwk'}).d;console.log(pub+'\\n'+priv)"
     ```
3. `APP_ACCESS_CODE` is the code they will use to sign in to their own app. Let them pick
   one themselves (at least 12 characters) and type it into the file — don't invent it for
   them and don't repeat it back in chat.
4. Open the file for them so they can fill in the rest (step 3).

## Step 3 — Accounts and keys

Go through these one at a time. After each: save, then move on.

**a) Anthropic (role-plays, required)**
1. <https://console.anthropic.com> → create an account → Billing → add credit
   ($5–10 lasts a long time).
2. API Keys → Create Key → copy it.
3. Paste it into `.env.local` after `ANTHROPIC_API_KEY=`.
4. Recommend setting a monthly spend limit under Billing.

**b) Neon (database, optional — for progress across devices)**
1. <https://neon.tech> → free account → new project.
2. Copy the connection string (starts with `postgresql://`).
3. Paste it after `DATABASE_URL=`.
4. The app creates its tables on first use; there is nothing else to do.

**c) Azure Speech (pronunciation and new audio, optional)**
1. <https://portal.azure.com> → create a Speech resource, region e.g. `southeastasia`,
   free tier F0.
2. Copy key and region.
3. Paste them after `AZURE_SPEECH_KEY=` and `AZURE_SPEECH_REGION=`.
4. Without Azure the app still plays audio — the files are already in `public/audio`.
   Only pronunciation scoring and audio for newly added content are missing.

**d) Demo access (optional)**
`DEMO_ACCESS_CODE` is a second code they can hand to other people. That account's progress
resets every night and its role-plays run on a cheaper model. Leave it empty if not needed.

## Step 4 — Test locally

1. `npm run dev`
2. Open <http://localhost:3000> and sign in with `APP_ACCESS_CODE`.
3. Quick check: learn a scenario, review a card, start a role-play.
4. Work through any console errors with them before going online.

## Step 5 — Put it online (Vercel)

1. `npx vercel login` — they sign in themselves in the browser.
2. `npx vercel link` — create a new project (any name).
3. Copy every value from `.env.local` into the production environment **without printing
   them**, for example:
   ```
   VAL=$(grep '^ANTHROPIC_API_KEY=' .env.local | cut -d= -f2-)
   printf '%s' "$VAL" | npx vercel env add ANTHROPIC_API_KEY production
   ```
   Repeat for each variable that is set.
4. `npx vercel deploy --prod --yes`
5. Open the address from the output and sign in.
6. If "Deployment Protection" is enabled in the project settings it will block access —
   discuss it with them and turn it off if that's what they want.

## Step 6 — Install on the iPhone

1. Open the address in Safari and sign in.
2. Share → **Add to Home Screen**.
3. For reminders: in the app under Settings → Reminder, turn it on and press
   "Send test notification". On iPhone, push only works from the home screen icon,
   not in a regular Safari tab.
4. Reminders run through the two cron jobs in `vercel.json` (12:00 and 20:00 Taiwan time).
   On Vercel's free plan they can fire up to an hour late.

## Step 7 — Changing content (only if they ask)

- Text and vocabulary live in `src/content/*.mjs`.
- After changes: `npm run content`, then `npm run audio` (needs Azure), then redeploy.
- `npm run check` verifies characters and tones against CC-CEDICT. It needs
  `data/cedict_1_0_ts_utf-8_mdbg.txt` (from <https://www.mdbg.net/chinese/dictionary?page=cc-cedict>)
  and optionally the TOCFL list in `data/`. Neither is included to keep the repo small —
  ask before downloading anything.
- All Chinese content must be correct **for Taiwan**: traditional characters, Taiwan
  pronunciation (e.g. 星期 xīngqí, not xīngqī), Taiwan vocabulary (捷運 not 地鐵,
  計程車 not 出租車).

## When something goes wrong

| Symptom | Cause and fix |
|---|---|
| Sign-in fails | `APP_ACCESS_CODE` missing on the server. Check `.env.local` locally and the Vercel environment variables online. |
| "Not signed in" during sync | No `DATABASE_URL` set, or the access code was changed. Sign in again. |
| Role-play doesn't answer | `ANTHROPIC_API_KEY` missing, or no credit on the account. |
| Pronunciation button gives no score | Azure key missing, or microphone permission denied. |
| Build fails | Run `npm run content` first; the error message names the content file at fault. |
