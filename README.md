# 早安 — Mandarin for everyday life in Taiwan

A learning app built for one specific job: getting by in Taiwan. Traditional characters,
Taiwan pronunciation, Taiwan vocabulary (捷運, not 地鐵).

**You can have your own copy running in about 30 minutes, without writing code.**
Claude Code does the setup — see [GETTING-STARTED.md](GETTING-STARTED.md).

## What's inside

- **22 everyday scenarios** — 7-Eleven, MRT, ordering food, bank, post office, hairdresser,
  laundry, doctor, deliveries and more, 208 phrases with audio
- **860 words** — basics, scenario vocabulary, and the official Taiwan word list
  (TOCFL Novice 1 + 2), learned 5 at a time
- **Spaced repetition** (FSRS) — cards come back right before you'd forget them
- **Tone training** with pitch curves, and pronunciation scoring through the microphone
- **Writing practice** with stroke order, plus reading real signs and menus
- **AI role-plays** — talk to a shopkeeper, waiter or taxi driver, with corrections
- German or English interface, traditional + simplified in parallel, pinyin or zhuyin
- Works offline, installs to the home screen, optional sync across devices

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev
```

Then open <http://localhost:3000>. The full walkthrough, including accounts and deployment,
is in [SETUP.md](SETUP.md) — written for Claude Code to follow step by step.

## Tech

Next.js 16 · React 19 · TypeScript · Dexie (IndexedDB, local-first) · Postgres (Neon) for sync ·
Azure Speech for TTS and pronunciation assessment · Anthropic API for role-plays ·
`ts-fsrs` for scheduling · Hanzi Writer for stroke order · deployed on Vercel.

## Content and licences

Learning content lives in `src/content/*.mjs` and is compiled to `generated.json` by
`npm run content`. Pronunciation is checked against [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)
(CC BY-SA 4.0); word levels come from the official TOCFL list. Stroke data is from
[Hanzi Writer](https://hanziwriter.org) / Make Me a Hanzi (Arphic Public License, see
`public/strokes/ARPHICPL.TXT`). Audio is generated with Azure Speech under the account of
whoever builds it.

This is a personal project shared with friends — no warranty, and you run it on your own
API accounts.
