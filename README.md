# head empty. no thoughts.

*for all those assignments you forget to do...and don't want to do.*

## running it

Open the page on GitHub Pages: https://rachaelchung.github.io/113Capstone/
Download the chrome extension from here: 

Open `index.html` for the marketing + sign-in page, or `app.html` for the habitat / timer / tracker. No build step, no dependencies.

For the best experience, use a local server (avoids any browser file:// quirks and matches API CORS):

```bash
# python
python -m http.server 8080

# node (if you have npx)
npx serve .

.venv/bin/flask --app wsgi:app run --host 127.0.0.1 --port 8001
```

Then open [http://localhost:8080](http://localhost:8080) (or VS Code Live Server on port 5500). When the site is served over **http** from localhost, the app **probes** `http://127.0.0.1:8001/health` (and `:8001` on `localhost`) and uses your local Flask if it responds; otherwise it uses the URL in [`js/apiBaseConfig.js`](js/apiBaseConfig.js) (`window.HENN_REMOTE_API_BASE`). Set that variable to your **production API** (for example Render) before deploying the static site to GitHub Pages. HTTPS pages (such as `https://*.github.io`) cannot call `http://localhost`, so they always use the production URL from that file.

### GitHub Pages + Render + extension

1. Deploy the API to Render (or similar) and set `CORS_ORIGINS` and `FRONTEND_ORIGIN` in the backend env to your GitHub Pages origin (see [`backend/.env.example`](backend/.env.example)).
2. In Google Cloud Console, set the OAuth redirect URI to `{your Render API URL}/api/auth/google/callback`.
3. Set the same production API URL (no trailing slash) in **`js/apiBaseConfig.js`** and **`extension/background.js`** (`HENN_REMOTE_API_BASE`).
4. Reload the unpacked extension after editing the manifest if you use a **custom domain** (add your origin next to `https://*.github.io/*` under `content_scripts` → `content-app-auth.js`).

---

## project structure

```
113Capstone/
├── index.html              # landing + log in / sign up (calls backend auth)
├── app.html                # main app (habitat, timer, tracker)
├── tracker.html            # standalone assignment tracker entry
├── favicon.ico
│
├── css/
│   ├── reset.css           # base reset
│   ├── style.css           # tokens, habitat, timer, home/auth styling
│   └── tracker.css         # assignment tracker styling
│
├── js/                     # frontend modules (plain ES modules, no build)
│   ├── main.js             # app.html entry — wires timer + habitat + tracker
│   ├── home.js             # index.html entry — marketing + auth flow
│   ├── apiBaseConfig.js    # HENN_REMOTE_API_BASE (production API URL)
│   ├── apiResolve.js       # probes localhost:8001, falls back to remote
│   ├── userAppState.js     # load/save per-user state through backend
│   ├── store.js            # coins / food / collection persistence
│   ├── timer.js            # pomodoro phases, countdown, ring UI
│   ├── game.js             # spawning, catching, food/coin economy
│   ├── creatures.js        # creature type definitions + SVG factory
│   ├── creatureBond.js     # bond levels + per-creature progress
│   ├── backgrounds.js      # habitat background picker
│   ├── focusBg.js          # focus-phase background effects
│   ├── decorations.js      # habitat decoration placement
│   ├── trackerMain.js      # tracker page controller
│   ├── trackerStore.js     # assignment state (local + synced)
│   └── trackerApi.js       # fetch wrappers for /api/tracker
│
├── data/                   # static JSON consumed by the frontend
│   ├── creatures.json
│   ├── backgrounds.json
│   └── decoration.json
│
├── backend/                # Flask API (SQLite + SQLAlchemy)
│   ├── wsgi.py             # entry for `flask --app wsgi:app run`
│   ├── requirements.txt
│   ├── .env.example
│   ├── instance/
│   │   └── tracker.db      # local SQLite DB (gitignored in prod)
│   ├── scripts/
│   │   └── print_pdf_text.py
│   └── app/
│       ├── __init__.py         # create_app() + CORS + blueprints
│       ├── main.py             # health + misc routes
│       ├── config.py           # env config (CORS_ORIGINS, OAuth, etc.)
│       ├── extensions.py       # db, migrate, login_manager
│       ├── models.py           # SQLAlchemy models (User, Assignment, …)
│       ├── schemas.py          # request/response shapes
│       ├── db_migrate.py       # lightweight schema migrations
│       ├── auth_routes.py      # /api/auth/* (email + Google OAuth)
│       ├── auth_service.py     # password hashing, sessions, OAuth glue
│       ├── app_state_service.py# load/save per-user app state
│       ├── tracker_service.py  # assignment CRUD + syllabus parsing
│       ├── grade_calculation.py# weighted grade math
│       ├── pdf_text.py         # extract text from syllabus PDFs
│       └── openai_json.py      # structured LLM calls for syllabus parse
│
└── extension/              # Chrome extension (Manifest V3)
    ├── manifest.json
    ├── background.js           # service worker: auth bridge, messaging
    ├── popup.html / popup.js   # toolbar popup (timer + quick habitat)
    ├── options.html / options.js
    ├── content.js              # runs on forbidden sites → overlay injection
    ├── content-app-auth.js     # bridges auth cookies from the web app
    ├── overlay.html / overlay.js / overlay.css  # full habitat overlay
    ├── overlay-timer.html / overlay-timer.js    # floating timer
    ├── overlay-lane.html / overlay-lane.js      # creature lane overlay
    ├── timer.html              # standalone timer page
    ├── lane.html               # standalone lane page
    ├── css/
    │   ├── timer-embed.css
    │   └── lane-embed.css
    ├── lib/                    # shared logic reused from js/
    │   ├── timer.js
    │   ├── creatures.js
    │   ├── extGame.js
    │   ├── timer-embed.js
    │   └── lane-embed.js
    ├── data/
    │   └── creatures.json
    └── icons/
        └── icon-512.png
```

---

## how it works

### timer phases

Full 4-session pomodoro cycle defined in `timer.js`:
`focus (25m) → break (5m) → focus → break → focus → break → focus → long break (15m)`

### creature spawning

- Creatures only appear during active **focus** phases
- Spawn interval: random 8–20 seconds
- Click a creature to catch it before it walks offscreen
- Forbidden mode pauses spawning and clears all active creatures

### economy


| Currency | How earned                         | Planned use                              |
| -------- | ---------------------------------- | ---------------------------------------- |
| Food     | 1 per 10 focus-seconds             | Keep creatures happy, attract rare types |
| Coins    | On assignment completion (phase 2) | Habitat decorations, shop items          |


### rarity weights


| Rarity   | Chance | Current creatures      |
| -------- | ------ | ---------------------- |
| Common   | 60%    | blobby, squish, bouncy |
| Uncommon | 30%    | sparky                 |
| Rare     | 10%    | raro                   |


---

## phase 2 — assignment tracker integration

Things to hook up:

- `Game.awardCoins(n)` — call this when the user marks an assignment complete
- `Timer.isFocus()` / `Timer.isRunning()` — expose to the assignment panel
- Persist `collection`, `food`, `coins` to `localStorage` or a backend

## phase 3 — chrome extension

- Move `app.html` → `popup.html` (or a slim entry)  
- Add `manifest.json` (Manifest V3)
- `content_script.js` detects forbidden domains → sends message to `game.js`
- Overlay `iframe` injects the habitat + floating timer into any page

---

## adding new creatures

Open `js/creatures.js` and add an entry to `CREATURE_TYPES`:

```js
{
  id: 'wobble',
  label: 'wobble',
  color: '#42a5f5',
  eyeWhite: '#ffffff',
  pupil: '#0d47a1',
  shape: 'round',       // 'round' | 'wide' | 'tall'
  rarity: 'uncommon',   // 'common' | 'uncommon' | 'rare'
}
```

That's it — spawning and collection pick it up automatically.