# Getting started

You don't need to know how to code. Claude Code does the setup for you — you create the
accounts and paste in your own keys when it asks.

## Three steps

1. **Install Claude Code** (if you don't have it): <https://claude.com/download>
2. **Clone this repo and open the folder in Claude Code:**
   ```bash
   git clone <this-repo-url>
   cd zaoan-app
   ```
   (No git? Use the green **Code → Download ZIP** button on GitHub and unzip it.)
3. **Say this to Claude:**

   > Read SETUP.md and set up the app completely for me. I'm not a developer, walk me
   > through everything step by step.

Claude then checks your tools, tells you which accounts to create, has you paste your keys
into a local file, builds the app and puts it online. Expect about 30 minutes, most of it
waiting on account sign-ups.

## Accounts you'll need

| Service | What it's for | Cost |
|---|---|---|
| [Anthropic](https://console.anthropic.com) | AI role-plays | Pay as you go, a few cents per conversation; $5–10 lasts a long time |
| [Vercel](https://vercel.com) | Hosting the app | Free tier |
| [Neon](https://neon.tech) | Database, so progress syncs across devices | Free tier, optional |
| [Azure Speech](https://portal.azure.com) | Pronunciation scoring, audio for new content | Free tier, optional |

Without Neon and Azure the app still works — all audio files are already in the repo.
You'd just lose pronunciation scoring and cross-device sync.

## After setup

- Open the app's address in Safari on your iPhone, sign in with your access code, then
  **Share → Add to Home Screen**. It behaves like a normal app from there and works offline.
- Daily reminders (12:00 and 20:00 Taiwan time) only work once it's installed on the home
  screen. Turn them on under Settings → Reminder.
- Switch the interface language under Settings → Language.

## If something breaks

Tell Claude what you see — it has `SETUP.md` with a troubleshooting table covering the
usual suspects (missing access code, no API credit, Azure key not set, build errors).
