# Pawventures

A map of dog friendly places in Singapore, built by an owner of two very
cute and quirky puppies.

## Why this exists

Ever since I got my two puppies, I found it genuinely difficult to figure
out where to actually bring them — information was scattered across
random blogs, forum threads, etc and some of the writings may even be outdated. I am also a visual kind of person, so
scrolling through walls of text never stuck with me the way a map does.

Pawventures is my attempt to compile what I have learned into one place: a
map first way to browse dog friendly spots in Singapore, starting with dog
parks and growing from there — built as a side project to explore frontend
and backend development while solving a problem I actually have.

TLDR, I hope this project is functional and useful while at the same time, using this chance to document my learnings etc.

## Current features

- Interactive map of Singapore (OneMap GreyLite basemap) centered on dog
  parks
- Custom paw shaped markers with clustering when parks are close together
- Click a pin for a popup with address, opening hours, tags (fenced,
  off-leash, water points, etc.), a short note, and a "Get directions" link
  that opens Google Maps
- Filter by area (eg, Bishan, Jurong, Toa Payoh)

## Roadmap (although things might change as this project progresses)

Roughly in the order I am planning to tackle them:

- [ ] Move from a static JSON file to a real backend (Postgres + PostGIS)
- [ ] Additional categories: pet friendly cafes/restaurants, malls, vets
- [ ] Google sign in for leaving notes/tips on a location
- [ ] User submitted contributions (drop a pin, fill a form, pending
      review) with a "community approved" badge once verified
- [ ] Dockerized local dev environment + Terraform/OpenTofu for
      infrastructure
- [ ] Deployment (AWS, likely ECS or a single EC2 box behind a
      reverse proxy to start or even through a private infra setup.)

## Project structure

```
pawventures/
├── frontend/              # the map web app — plain HTML/CSS/JS, no build step
│   ├── index.html         # page shell, header, favicon, script/style tags
│   ├── styles.css         # colors, fonts, layout, marker + popup styling
│   ├── app.js             # map setup, marker rendering, filtering, popups
│   └── data/
│       └── parks.json      # the actual location data — see below
├── backend/                # (planned) API + database layer
├── infra/                  # (planned) Docker, Terraform/OpenTofu
├── .gitignore
└── README.md               # you are here
```

## Where to make common changes

| I want to... | Edit this |
|---|---|
| Add, edit, or remove a park | `frontend/data/parks.json` — see field guide below |
| Change the page title (browser tab text) | `<title>` tag in `frontend/index.html` |
| Change the "Pawmap SG" header text | `.wordmark` block in `frontend/index.html` |
| Change the favicon | `<link rel="icon" ...>` tag in `frontend/index.html` `<head>` |
| Change marker size or color | `.paw-pin` rule in `frontend/styles.css`, and `iconSize` in `frontend/app.js` |
| Change the color palette / fonts | `:root` CSS variables at the top of `frontend/styles.css` |
| Add a new area to the filter dropdown | Nothing to edit manually — it's generated automatically from whatever `area` values exist in `parks.json` |
| Turn the map's basemap style/tint | `.leaflet-tile-pane` filter rule in `frontend/styles.css`, or the OneMap tile URL in `frontend/app.js` |

### `parks.json` field guide

| Field | What it controls |
|---|---|
| `id` | Internal unique identifier only — never shown to users. Must be unique across the whole file. Not tied to `area`. |
| `name` | Shown in the sidebar list, marker hover tooltip, and popup title |
| `area` | Powers the area filter dropdown — new values appear there automatically |
| `lat` / `lng` | Pin position on the map, and the destination used for "Get directions" |
| `address` | Shown in the popup |
| `hours` | Shown in the popup |
| `tags` | Small pill badges in the popup — any number, free text |
| `note` | The italic tip line in the popup |

Coordinates currently in the file are approximate placeholders and should
be double-checked (e.g. via OneMap's search, or Google Maps) before this
goes live for real users.

## Running it locally

This is a static site — no build step, no npm install. It needs to be
served (not opened directly as a file) because it fetches `parks.json`,
and browsers block that over a plain `file://` path.

```bash
cd frontend
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Stop the server with
`Ctrl+C` when done.

## Testing

There's no automated test suite yet — the project is small enough that a
quick manual pass covers it for now:

- [ ] Map loads and is centered on Singapore
- [ ] All expected pins appear, correctly clustered when zoomed out
- [ ] Clicking a pin opens its popup with correct details
- [ ] Clicking a sidebar row pans to and opens the matching pin
- [ ] Area filter narrows both the pin list and the sidebar correctly
- [ ] "Get directions" opens Google Maps at the right coordinates
- [ ] Browser console is free of errors (right-click → Inspect → Console)

Automated tests will likely get added once there's real logic worth
testing (e.g. once the backend/contribution flow exists).

## Tech stack

- **Frontend:** plain HTML/CSS/JS, [Leaflet.js](https://leafletjs.com/)
  for the map, [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
  for clustering
- **Basemap:** [OneMap](https://www.onemap.gov.sg/) (Singapore Land
  Authority) — free, no API key required for the basemap tiles
- **Backend / infra:** not built yet — planned Postgres + PostGIS, Docker,
  Terraform/OpenTofu (see Roadmap above)

## Contributing

Not open for external contributions yet — this is very early and still
solo. The plan is to open it up once the contribution/review flow (see
Roadmap) exists, so submissions can go through moderation before going
live.
