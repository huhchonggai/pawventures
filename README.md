# Pawventures

A map of dog friendly places in Singapore, built by an owner of two very
cute and quirky puppies.

## Why this exists

Ever since I got my two puppies, I found it genuinely difficult to figure
out where to actually bring them. Information was scattered across
random blogs, forum threads, etc and some of the writings may even be outdated. I am also a visual kind of person, so
scrolling through walls of text never stuck with me the way a map does.

Pawventures is my attempt to compile what I have learned into one place: a
map first way to browse dog friendly spots in Singapore, starting with dog
parks and growing from there — built as a side project to explore frontend
and backend development while solving a problem I actually have.

TLDR, I hope this project is functional and useful while at the same time, using this chance to document my learnings etc.

## Current features

- Interactive map of Singapore (OneMap Grey basemap), covering dog parks
  and dog friendly malls, each with their own marker shape and colour
- Custom shaped markers with clustering when locations are close together
- Click a pin for a popup with address, opening hours, tags (fenced,
  off-leash, water points, etc.), a short note, a like button and a
  "Get directions" link that opens up Google Maps
- A "community approved" star badge appears on a location's popup once it
  passes 10 likes
- Filter by category (Parks, Malls while Cafes and Vets are still coming) and
  by area (eg, Bishan, Jurong, Toa Payoh)
- A "locate me" button on the map finds the user's current position via the
  browser's geolocation API and drops a pin there. The pin is draggable, so
  GPS drift can be corrected by hand. The map auto pans if it is dragged
  near the edge of the screen. Nearby pins pick up their own label showing
  name and distance, with no click or hover needed to see it. A bottom
  sheet also slides up listing what is nearby across whatever categories are
  active and can be collapsed to a small "peeking strip" rather than closed, 
  so it stays within reach. Location is computed entirely in the
  browser (straight line distance via the haversine formula, interesting stuff). It is never
  sent to the backend
- A floating "Contribute" button opens a form for suggesting a new
  location. It can be anonymous or with a name, no login required
- A small backend API (Node + Express + SQLite) backs the map, the like
  button and the contribution form
- An admin page for reviewing pending contributions (approve/reject) and
  for adding new locations directly
- Rate limiting on the contribution and like endpoints, plus a honeypot
  field on the contribution form, to cut down on spam
- User submitted text is escaped before being shown on the map, to
  prevent malicious content in a note or name from running as code (XSS)

## Roadmap (although things might change as this project progresses)

Roughly in the order I am planning to tackle them,

- [ ] Additional categories: pet friendly cafes/restaurants, vets
      (filter pills for these already exist in the UI, marked "coming soon")
- [ ] A way to promote an approved contribution straight into a live
      location, instead of manually re-entering it through the admin form
- [ ] Automated tests (currently just a manual checklist — see Testing)
- [ ] Scheduled backups of the SQLite database once it is running on real
      infrastructure
- [ ] Finish the deployment pipeline and go live (the actual deploy step
      to OpenShift is still unresolved)

## Project structure
```
pawventures/
├── frontend/                  # the map web app — plain HTML/CSS/JS, no build step
│   ├── index.html             # page shell, header, favicon, script/style tags
│   ├── styles.css             # colors, fonts, layout, marker + popup + modal styling
│   ├── app.js                 # map setup, marker rendering, filtering, popups, contribute form
│   └── logo/
│       └── miaava.png         # header logo
├── backend/
│   ├── server.js              # Express app — serves the API and the frontend
│   ├── db.js                  # SQLite connection + schema
│   ├── seed.js                # imports seed-data/*.json into the database
│   ├── seed-data/
│   │   ├── parks.json         # bulk park data — see field guide below
│   │   └── malls.json         # bulk mall data — same field guide applies
│   ├── data/                  # the live SQLite database (gitignored)
│   ├── routes/
│   │   ├── locations.js       # GET /api/locations, POST /:id/like
│   │   ├── contributions.js   # POST /api/contributions
│   │   └── admin.js           # GET/POST /api/admin/... (contributions review, add location)
│   ├── ratelimiters/
│   │   └── ratelimiters.js    # rate limits for contributions and likes
│   ├── public/
│   │   └── admin.html         # admin review page
│   ├── package.json
│   └── .env.example           # template for backend/.env (PORT, ADMIN_KEY)
├── Dockerfile                 # builds the container image the pipeline deploys
├── .dockerignore
├── .gitignore
└── README.md                  # you are here
```
## Where to make common changes

| I want to... | Edit this |
|---|---|
| Add several locations at once | `backend/seed-data/parks.json` or `malls.json`, then run `npm run seed` — see below |
| Add or edit a single location | The admin page (`/admin.html`) — "Add a location" form |
| Change the page title (browser tab text) | `<title>` tag in `frontend/index.html` |
| Change the header logo or text | `.wordmark` block in `frontend/index.html`, image in `frontend/logo/` |
| Change the favicon | `<link rel="icon" ...>` tag in `frontend/index.html` `<head>` |
| Change marker size or color | `.paw-pin` rule in `frontend/styles.css` and `iconSize` in `frontend/app.js` |
| Change the color palette / fonts | `:root` CSS variables at the top of `frontend/styles.css` |
| Add a new area to the filter dropdown | Nothing to edit manually — it's generated automatically from whatever `area` values exist in the database |
| Change the map's basemap style | The OneMap tile URL in `frontend/app.js` (options: Default, Original, Grey, GreyLite, Night) |
| Change how far the permanent "nearby" distance labels reach | `NEARBY_LABEL_RADIUS_KM` in `frontend/app.js` |
| Change how far the nearby sheet's list searches before falling back to "closest anyway" | `NEARBY_SHEET_RADIUS_KM` in `frontend/app.js` |
| Change how far the "you are here" pin auto-pans while dragged | `autoPanSpeed` / `autoPanPadding` on the marker in `frontend/app.js` |
| Change how much of the nearby sheet peeks out when collapsed | `--peek-height` in `frontend/styles.css` (also keeps the zoom/locate controls and Contribute button clear of it automatically) |
| Change rate limits for contributions/likes | `backend/ratelimiters/ratelimiters.js` |
| Change the admin password | `ADMIN_KEY` in `backend/.env` (never commit the real value) |

### `seed-data/*.json` field guide

Both `parks.json` and `malls.json` are only read once each, by `seed.js`,
to bulk-import locations into the database. It's safe to re-run
`npm run seed` any time — matching entries (by `id`) get their fields
synced to whatever's currently in the JSON, so edits there do carry
through on re-seed, not just new additions.

| Field | What it controls |
|---|---|
| `id` | Internal unique identifier only — never shown to users. Must be unique across the whole file. Not tied to `area`. |
| `name` | Shown in the marker hover tooltip and popup title |
| `area` | Powers the area filter dropdown — new values appear there automatically |
| `lat` / `lng` | Pin position on the map and the destination used for "Get directions" |
| `address` | Shown in the popup |
| `hours` | Shown in the popup |
| `tags` | Small pill badges in the popup — any number, free text |
| `note` | The italic tip line in the popup |

## Running it locally

Unlike the very first version of this project, the frontend is now served
*by* the backend — there is no separate static file server anymore.

```bash
cd backend
npm install
copy .env.example .env    # then edit .env and set your own ADMIN_KEY
npm run seed              # imports seed-data/*.json into the database
npm start
```

Then open `http://localhost:3001` in your browser. The admin review page
is at `http://localhost:3001/admin.html`. Stop the server with `Ctrl+C`.

Requires **Node 22.5+**, since the database layer uses Node's built-in
`node:sqlite` module.

## Testing

There's no automated test suite yet — the project is small enough that a
quick manual pass covers it for now,

- [ ] Map loads, centered on Singapore, with no blank space at any zoom level
- [ ] All expected pins appear, correctly clustered when zoomed out
- [ ] Clicking a pin opens its popup with correct details
- [ ] Category and area filters narrow the pins shown correctly, together
- [ ] The like button increments the count and shows the star badge past 10 likes
- [ ] "Get directions" opens Google Maps at the right coordinates, with the correct button color
- [ ] The locate button drops a "you are here" pin, nearby pins pick up a
      distance label and the nearby sheet slides up (requires allowing
      location access when prompted)
- [ ] Dragging the "you are here" pin updates distances/sorting, and
      auto-pans the map when dragged near the screen edge
- [ ] The nearby sheet can be collapsed to a peek strip and re-expanded by
      tapping its handle, without needing to press locate again
- [ ] The contribute form submits successfully and the entry shows up in the admin page
- [ ] The admin page correctly rejects a wrong admin key
- [ ] Browser console is free of errors (right-click → Inspect → Console)

Automated tests will likely get added once there's a stable deployment
target to run them against.

## Security notes

A few things worth knowing about, given this app accepts public input,

- All user submitted text (names, notes, tags) is HTML escaped before
  being shown on the map, to prevent a submission from injecting a script
  that runs in other visitors' browsers
- The contribution form has a honeypot field, invisible to real users,
  to catch basic spam bots
- Contribution submissions and likes are both rate-limited per IP
- Admin routes are protected by a single shared secret (`ADMIN_KEY`),
  which is enough for a solo admin but is not a real user account system
- The locate me feature requires HTTPS once deployed — browsers block the
  Geolocation API over plain HTTP, with `localhost` as the one exception
  for local testing — worth confirming pawlah.sg is actually served over
  `https://` before relying on this in production

## Tech stack

- **Frontend:** plain HTML/CSS/JS, [Leaflet.js](https://leafletjs.com/)
  for the map, [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
  for clustering
- **Basemap:** [OneMap](https://www.onemap.gov.sg/) (Singapore Land
  Authority) — free, no API key required
- **Backend:** Node.js + Express, using Node's built-in `node:sqlite`
  module for the database (no separate database server, no ORM)
- **Infra:** Docker (image built via a GitLab CI pipeline living in a
  separate GitLab project), deploying to self-hosted infrastructure
  (OpenShift) behind Cloudflare. The deploy step itself is still being
  worked out — see Roadmap

## Contributing

The submission mechanism itself is live — anyone can suggest a location
through the "Contribute" button, no account needed and it goes into a
review queue. That said, the site isn't deployed publicly yet, so this is
really only testable locally for now. Once it's live at pawlah.sg, this
section will cover what a good submission looks like.