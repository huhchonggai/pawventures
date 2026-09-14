# Pawventures backend

A small Express API backed by SQLite (via Node's built-in `node:sqlite` —
no native compile step, nothing extra to install for the database itself).

## Setup

```bash
cd backend
npm install
cp .env.example .env
# open .env and set ADMIN_KEY to something only you know
npm run seed    # imports ../frontend/data/parks.json into the database
npm start
```

Server runs on `http://localhost:3001` by default (change via `PORT` in `.env`).

`npm run seed` is safe to re-run — it only inserts locations that aren't
already in the database (matched by `id`), so re-running it after adding
new parks to `parks.json` will only add the new ones.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/locations` | none | List approved locations. Supports `?category=` and `?area=` |
| `POST` | `/api/locations/:id/like` | none | Increment a location's like count |
| `POST` | `/api/contributions` | none | Submit a new location suggestion (goes in as `pending`) |
| `GET` | `/api/admin/contributions?status=pending` | admin key | List contributions by status |
| `POST` | `/api/admin/contributions/:id/approve` | admin key | Mark a contribution approved |
| `POST` | `/api/admin/contributions/:id/reject` | admin key | Mark a contribution rejected |
| `GET` | `/api/health` | none | Returns `{ ok: true }` — useful for checking the server is up |

Admin endpoints expect an `x-admin-key` header matching `ADMIN_KEY` from `.env`.

## Reviewing contributions

Open `http://localhost:3001/admin.html`, enter your admin key, and
approve/reject pending submissions from there.

**Important limitation to know about:** approving a contribution only marks
it reviewed — it does **not** automatically create a live pin on the map,
since the contribution form doesn't collect coordinates. For now, treat
"approve" as your cue to manually look up the location's lat/lng and add
it properly (directly in the database, or via a future admin "create
location" form — not built yet).

## Spam protection

The contribution form includes a honeypot field (`website`) that's hidden
from real users via CSS on the frontend. If it arrives non-empty, the
submission is silently dropped (the API still responds as if it
succeeded, so bots don't learn to look for a different field name).

## Database

SQLite file lives at `backend/data/pawventures.db` — created automatically
on first run. It's gitignored (see root `.gitignore`), so each environment
(your machine, your friend's server) has its own local copy. Back it up by
just copying that file somewhere safe periodically.

## Not built yet

- Wiring the frontend to call this API instead of the static `parks.json`
- The contribution form itself on the frontend (this backend is ready for
  it, just needs the HTML/JS form)
- The "like" button and community-approved star badge on the frontend
- An admin flow for turning an approved contribution into a real location
  without manual database edits
