# PyreChat

Snapchat-class camera messenger: **orange** instead of yellow, a **white skull outline** instead of the ghost.

**Humans only.** No ranking algorithm, no For You page, no AI. Feeds are chronological. The only takedown is **illegal content** (court orders, CSAM, and the like) — not speech.

Live site: **https://chat.pyrearms.dev**  
Android APK: **https://chat.pyrearms.dev/api/download/android**  
The APK WebView loads the live site, so UI changes roll out without a new install. A new APK is only needed for native/plugin changes.  
Source: **https://github.com/MaximusPyre/pyrechat**


Native apps: Android (`android/`) and iOS (`ios/`) via Capacitor. Same product as the website, with a labeled Inbox / Capture / Feed / You layout.

## Feature map (Snapchat → PyreChat)

| Snapchat | PyreChat | Notes |
|---|---|---|
| Camera-first home | Camera tab | Photo tap, hold for video |
| Snaps | Pyres | 1–10s view, one replay, then gone |
| Filters / Lenses | Ember, Flame, Ash, Night, Ice + overlay stickers | Our camera. Snap Camera Kit is **not** used — Snap forbids that SDK in visual messengers. |
| Stickers / text / draw | Editor | Orange pen, emoji stickers, captions |
| Chat | Chat | Disappearing text; tap a bubble to save |
| Voice notes | Mic in thread | 4s clip |
| Stories (24h) | Stories | Friends + public Discover |
| Spotlight | Spotlight | Goes live immediately — no review |
| Snap Map / Ghost Mode | Pyre Map / **Skull Mode** | Hide or share with friends |
| Memories | Memories | Cloud save of Pyres |
| Snapstreaks | Pyrestreaks | 24h window, both must send |
| Snap Score | Pyre Score | +1 send/open, +2 Spotlight |
| Bitmoji | Skullmoji | Color, eyes, jaw, hat |
| Snapcode | Skullcode | Dot pattern + `chat.pyrearms.dev/add/user` |
| Quick Add | Quick Add | Mutuals |
| Friendship profile / Charms | Friendship + charms | Streak, signs, score, since |
| Groups | Group chats | |
| Voice / video calls | Calls | Device camera/mic + hub signaling |
| Screenshot notice | Capture notice | PrintScreen / documented capture |
| My AI / ads / For You ranking | **Omitted** | Chronological only. No AI. |

The only removal path is **illegal material** (Settings → Illegal content notice). No scanners, no speech filters, no engagement ranking. Users can still **block** people.

## Dev

```bash
nvm use 22
cp .dev.vars.example .dev.vars
npm install
npx wrangler types
npm run db:migrate:local
npm run dev
```

Open `http://localhost:5173`. Camera needs a secure context (localhost is fine).

## Deploy (chat.pyrearms.dev)

D1 (`pyrechat`) and R2 (`pyrechat-media`) are already created. From this repo:

```bash
npx wrangler login          # if the API token expired
npx wrangler secret put SESSION_SECRET
npm run deploy
```

`wrangler.jsonc` already binds custom domain **chat.pyrearms.dev**. After the first successful deploy, set DNS if Cloudflare does not auto-attach the hostname.

## Native apps

```bash
npm run build
npx cap add android   # first time
npx cap add ios       # first time, needs a Mac to compile
npx cap sync
npx cap open android  # Android Studio
npx cap open ios      # Xcode
```

App ID: `dev.pyrearms.chat`. Grant camera, microphone, and location on first launch.

The Android APK bundles the UI. API/WebSocket traffic goes to **https://chat.pyrearms.dev** (override with `VITE_API_ORIGIN` before `npm run build`).

iOS `Info.plist` privacy strings (Capacitor merges these from config): camera, microphone, location.

### AR / Camera Kit

Snap’s Camera Kit terms **do not allow** the SDK in “apps designed for direct visual communication with friends” without written permission from Snap. PyreChat is that kind of app, so we **do not ship Camera Kit**. Capture uses the device camera and Pyre color grades. Staging Camera Kit code may still exist in `android/` for experiments; it is not the product path.

If Snap later grants an exception, production review still needs a privacy policy URL, a demo video, and a Snap ToS click-through before any Kit camera.

## Stack

- Website + API: Cloudflare Workers + Vite + React (same pattern as PyreArms)
- Data: D1 (graph + messages), R2 (media), Durable Objects (live chat + inbox)
- Apps: Capacitor 7. Device camera + Pyre filters (not Snap Camera Kit).
