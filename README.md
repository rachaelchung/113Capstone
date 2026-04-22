# head empty. no thoughts.

*for all those assignments you forget to do...and don't want to do.*

## running it

Open `index.html` for the marketing + sign-in page, or `app.html` for the habitat / timer / tracker. No build step, no dependencies.

For the best experience, use a local server (avoids any browser file:// quirks and matches API CORS):

```bash
# python
python -m http.server 8080

# node (if you have npx)
npx serve .

.venv/bin/flask --app wsgi:app run --host 127.0.0.1 --port 8001
```

Then open [http://localhost:8080](http://localhost:8080) (or VS Code Live Server on port 5500). Point the `api-base` meta on `index.html` and the `tracker-api-base` meta on `app.html` at your Flask URL (see `backend/.env.example` for auth + CORS).

---

## project structure

```
head-empty/
├── index.html          # landing + log in / sign up (calls backend auth)
├── app.html            # main app (habitat, timer, tracker)
├── css/
│   ├── reset.css       # base reset
│   └── style.css       # all styling (tokens, habitat, timer, controls)
├── js/
│   ├── creatures.js    # creature type definitions + SVG factory
│   ├── timer.js        # pomodoro logic (phases, countdown, ring UI)
│   ├── game.js         # spawning, catching, food/coin economy
│   └── main.js         # entry point — wires everything together
└── assets/             # (empty for now — future: creature sprites, sounds)
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