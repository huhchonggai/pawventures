# Pawmap SG — map prototype

Static HTML/CSS/JS prototype of the map screen: OneMap GreyLite basemap,
custom paw markers, clustering, area filter, and a click-through detail
card with a "get directions" link out to Google Maps.

## Run it

Because it loads `data/parks.json` via `fetch`, open it through a local
server rather than double-clicking the file (browsers block `fetch` on
`file://` URLs):

```bash
cd dog-map-app
python3 -m http.server 8000
# then open http://localhost:8000
```

## Notes

- **Coordinates in `data/parks.json` are approximate placeholders**,
  good enough to demo the map but not accurate enough to ship — verify
  each park's real coordinates (e.g. via OneMap's search/geocode API)
  before this goes live.
- OneMap's Terms of Use require their logo + attribution to stay
  visible on the map — already wired into the tile layer's
  `attribution` option, don't remove it.
- No backend yet — this is pure frontend against the static JSON file,
  matching where we are in the project (map-first, before auth/DB).
- Filtering is by area only for now; the Cafes/Vets pills are inert
  placeholders for phase 2.
