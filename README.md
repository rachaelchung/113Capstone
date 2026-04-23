# ☺︎ head empty. no thoughts.

*for all those assignments you forget to do…and don't want to do.*

head empty is a gamified, all-in-one assignment tracker for students who would rather do literally anything else. Upload your syllabi at the start of the semester and an LLM fills in your courses, assignments, and grade weighting for you. Then use the pomodoro timer to actually get through the work — if your focused long enough, little creatures wander across your screen, and you click to catch them. Finish assignments to earn coins. Decorate your habitat. Repeat until you somehow graduate.

There's a [web app](https://rachaelchung.github.io/113Capstone/) (landing page + tracker + habitat) and a companion [Chrome extension](./extension.md) that overlays the timer and habitat on top of every tab — and replaces distracting sites with your habitat during focus sessions.

---

## what's in the box

- **pomodoro timer** — 25 / 5 / 25 / 5 / 25 / 5 / 25 / 15 (long break) cycle with a ring UI, phase auto-advance, and creature spawns during focus only
- **creature habitat** — creatures cross the screen at random intervals while you focus; click to catch, feed, and bond with them
- **assignment tracker** — courses, assignments, a drag-and-drop weekly plan, a month calendar, and an undated to-do list
- **syllabus AI** — drop a `.pdf`, `.txt`, `.md`, or `.html` syllabus and OpenAI pulls out your assignments, categories, and weighting
- **grade calculation** — weighted by category, renormalizes when some categories have no data yet
- **accounts + sync** — email + password or Google sign-in; state (creatures, coins, assignments, plan) syncs to the backend
- **chrome extension** — floating timer + creature lane on every tab, full-page overlay on sites you've marked off-limits (see [`extension.md`](./extension.md))
- **no build step** — plain ES modules on the frontend, Flask + SQLAlchemy on the backend

---

## running it

The static frontend is deployed on **GitHub Pages**: https://rachaelchung.github.io/113Capstone/
The API is deployed on **Render**: https://one13capstone.onrender.com
The Chrome extension lives in [`extension/`](./extension/) and installs unpacked — see [`extension.md`](./extension.md).

---

## running it *locally*

If you just want to poke around the frontend, you can open `index.html` (landing page + sign-in) or `app.html` (habitat / timer / tracker) directly.

```bash
# from the repo root, pick one:
python -m http.server 8080
npx serve .
# VS Code Live Server also works (usually on :5500)
```

Then open [http://localhost:8080](http://localhost:8080).

### backend (optional, for auth + tracker sync + syllabus parsing)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in SECRET_KEY, OPENAI_API_KEY, and Google OAuth creds
flask --app wsgi:app run --host 127.0.0.1 --port 8001
```

### deploying your own copy (GitHub Pages + Render + extension)

1. Deploy the backend to Render (or similar). In the backend env, set `CORS_ORIGINS` and `FRONTEND_ORIGIN` to your GitHub Pages origin — see [`backend/.env.example`](backend/.env.example).
2. In Google Cloud Console, set the OAuth redirect URI to `{your Render API URL}/api/auth/google/callback`.
3. Set the same production API URL (no trailing slash) in **`js/apiBaseConfig.js`** and **`extension/background.js`** (`HENN_REMOTE_API_BASE`).
4. If you use a custom domain, add your origin next to `https://*.github.io/*` under `content_scripts` → `content-app-auth.js` in `extension/manifest.json`, then reload the unpacked extension.
5. **OPTIONAL** Render dies after a couple minutes of inactivity and thus, the SQLite database is reset. To avoid this, you can create a simple Cloudflare agent as I did to poke at your Render site every couple of minutes. 

```bash
export default {
  async fetch(request, env, ctx) {
    return new Response("Worker online");
  },

  async scheduled(event, env, ctx) {
    const urls = [
      "https://one13capstone.onrender.com",
    ];

    for (const url of urls) {
      try {
        await fetch(url, { method: "GET" });
        console.log("Ping OK:", url);
      } catch (err) {
        console.error("Ping Failed:", url, err);
      }
    }
  }
};
```

---

## project structure

```
113Capstone/
├── index.html              # landing + log in / sign up (calls backend auth)
├── app.html                # main app (habitat, timer, tracker)
├── tracker.html            # legacy entry — redirects to app.html
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

Full 4-session pomodoro cycle, defined in [`js/timer.js`](js/timer.js):

`focus (25m) → break (5m) → focus → break → focus → break → focus → long break (15m)`

Phases auto-advance. The ring UI shows progress, the label shows the current phase, and the timer exposes `isFocus()` / `isRunning()` so the habitat and tracker can react.

### creature spawning

- Creatures only appear during active **focus** phases
- Spawn interval: random 2–5 minutes (rewards sustained focus)
- Click a creature to catch it before it walks offscreen
- Navigating to a forbidden site (via the extension) pauses spawning and clears active creatures

### economy

| Currency | How earned                                       | Used for                                 |
| -------- | ------------------------------------------------ | ---------------------------------------- |
| Food     | 1 per 10 focus-seconds                           | Keep creatures happy, attract rare types |
| Coins    | Awarded when you mark an assignment complete     | Habitat backgrounds + decorations        |

### rarity weights

| Rarity   | Chance | Current creatures      |
| -------- | ------ | ---------------------- |
| Common   | 60%    | blobby, squish, bouncy |
| Uncommon | 30%    | sparky                 |
| Rare     | 10%    | raro                   |

### assignment tracker

The tracker lives inside `app.html` (the standalone `tracker.html` just redirects there, it was used for testing). It gives you four views:

- **courses** — add courses for the semester, upload a syllabus, pick a color, edit categories / weighting
- **calendar** — monthly view of all *dated* assignments, grouped by course color
- **to-do** — undated tasks that live in their own list until you drag them into a day
- **weekly plan** — drag assignments and to-dos onto specific days without changing their master due date

Syllabus upload sends the file (PDF) or extracted text (HTML / TXT / MD) to `POST /api/parse-syllabus`, which calls OpenAI via the Python backend (so the key never ships to the browser). The LLM returns structured assignments + grade categories, which get merged into the course.

Grades are calculated per category using the weighting from the syllabus (or whatever you override manually), and renormalize when some categories haven't been graded yet so you get a sensible in-progress number.

### auth + sync

- Sign up / sign in with **email + password**, or sign in with **Google**
- Sessions are Flask sessions for the web app; the Chrome extension uses a JWT bridged from the web app's session cookie (see [`extension.md`](./extension.md))
- On login, the frontend loads per-user state (collection, coins, food, tracker data) from `/api/app-state` and writes changes back as you interact
- If you're offline or signed out, the tracker keeps working against `localStorage`

---

## adding new creatures

Open [`js/creatures.js`](js/creatures.js) and add an entry to `CREATURE_TYPES`:

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

That's it — spawning, the collection grid, and the bond system pick it up automatically. If you want the creature to show up in the extension too, mirror the entry into [`extension/data/creatures.json`](extension/data/creatures.json).

---

## related

- **live site:** https://rachaelchung.github.io/113Capstone/
- **chrome extension doc and download:** https://github.com/rachaelchung/headempty-chromeextension [`extension.md`](./extension.md)
- **full spec:** [`SPEC.md`](./SPEC.md)
- **tracker acceptance audit:** [`TRACKERCRITERIA.md`](./TRACKERCRITERIA.md)
- **prompt log:** ['PROMPT_LOG.md'](./PROMPT_LOG.md)
- **final project reflection:** ['REFLECTION.md'](./REFLECTION.md)
