const LEAF_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/><path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/></svg>';
const BAG_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(12,12)"><rect x="-7" y="-4" width="14" height="13" rx="1"/><path d="M-3-4a3 5 0 016 0"/></g></svg>';
const FORK_KNIFE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>';

const singaporeBounds = L.latLngBounds(
  L.latLng(1.15, 103.55), // This is the southwest corner, with a small buffer around the mainland
  L.latLng(1.50, 104.10), // This is the northeast corner
);

const map = L.map('map', {
  zoomControl: false, // Added manually below, grouped with the locate button
  attributionControl: false, // OneMap credit lives in the static footer bar instead, see #mapAttribution
  minZoom: 13,
  maxBounds: singaporeBounds,
  maxBoundsViscosity: 1.0, // A value of 1.0 creates a hard stop at the boundary
}).setView([1.3521, 103.8198], 12);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Icon for the locate button
const LOCATE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>';
// Icon for the "you are here" pin
const PERSON_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(12,12)"><circle cx="0" cy="-5" r="3"/><path d="M-6 8c0-4 3-7 6-7s6 3 6 7"/></g></svg>';

// Same pin shape as the park and mall markers
const userLocationIcon = L.divIcon({
  className: '',
  html: `<div class="paw-pin you-are-here">${PERSON_SVG}</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 30],
  popupAnchor: [0, -30],
});

// Refetches the user's position fresh on every click, rather than tracking it live
let userLocationMarker = null;
let userLocation = null; // { lat, lng }, set once located, used for distance display and sorting
const NEARBY_LABEL_RADIUS_KM = 30; // Only pins within this range get a permanent distance label on the map

// Straight line distance in km between two lat/lng points, learnt about haversine formula, interesting
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Creates or moves the "you are here" pin. Used by the locate button, drag correction and address search
function setUserLocation(lat, lng, { pan = true, tooltip = 'Walkies start here!' } = {}) {
  if (userLocationMarker) {
    userLocationMarker.setLatLng([lat, lng]);
    userLocationMarker.setTooltipContent(tooltip);
  } else {
    userLocationMarker = L.marker([lat, lng], {
      icon: userLocationIcon,
      draggable: true,
      autoPan: true, // Pans the map automatically when the marker is dragged near the edge or border of screen
      autoPanSpeed: 12, // Higher is faster
    }).addTo(map);
    userLocationMarker.bindTooltip(tooltip, {
      permanent: true,
      direction: 'top',
      offset: [0, -28],
      className: 'you-are-here-label',
    });
    // Let someone correct GPS drift by dragging the pin to where they actually are
    userLocationMarker.on('dragend', () => {
      const { lat: dLat, lng: dLng } = userLocationMarker.getLatLng();
      userLocation = { lat: dLat, lng: dLng };
      // Once pin is dragged to a specific location, treat it as a search result
      userLocationMarker.setTooltipContent('Sniff spot found!');
      applyFilter(); // No map.setView here. Recentering would fight the drag the user just made
    });
  }

  userLocation = { lat, lng };
  applyFilter();
  openNearbySheet();
  if (pan) map.setView([lat, lng], 15);

  // Clears the search bar and closes the results dropdown after setting a location
  searchInput.value = '';
  clearSearchResults();
}

const LocateControl = L.Control.extend({
  options: { position: 'bottomright' },
  onAdd: function () {
    // Reuses Leaflet's own control classes, so this matches zoom's size and shadow exactly
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-btn');
    const link = L.DomUtil.create('a', '', container);
    link.href = '#';
    link.title = 'Show my location';
    link.setAttribute('aria-label', 'Show my location');
    link.innerHTML = LOCATE_SVG;

    L.DomEvent.disableClickPropagation(container); // Stops the click from also reaching the map underneath

    L.DomEvent.on(link, 'click', (e) => {
      L.DomEvent.preventDefault(e);
      if (link.classList.contains('leaflet-disabled')) return;

      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        return;
      }

      link.classList.add('leaflet-disabled');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation(latitude, longitude);
          link.classList.remove('leaflet-disabled');
        },
        (err) => {
          console.error('Could not get location:', err.message);
          link.classList.remove('leaflet-disabled');
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });

    return container;
  },
});

map.addControl(new LocateControl());

// OneMap offers several basemap styles (Default, Original, Grey, GreyLite and Night)
L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png', {
  detectRetina: true,
  maxZoom: 19,
  minZoom: 13, // This matches the map's own minZoom above, so this number never actually takes effect
}).addTo(map);

// One icon per category, the color itself comes from CSS (.paw-pin vs .paw-pin.mall vs .paw-pin.eat)
const pawIconsByCategory = {
  park: L.divIcon({
    className: '',
    html: `<div class="paw-pin">${LEAF_SVG}</div>`,
    iconSize: [44, 44],
    iconAnchor: [17, 30],
    popupAnchor: [0, -30],
  }),
  mall: L.divIcon({
    className: '',
    html: `<div class="paw-pin mall">${BAG_SVG}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -30],
  }),
  eat: L.divIcon({
    className: '',
    html: `<div class="paw-pin eat">${FORK_KNIFE_SVG}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -30],
  }),
};

const clusterGroup = L.markerClusterGroup({
  iconCreateFunction: (cluster) => L.divIcon({
    html: `<div class="marker-cluster-custom" style="width:40px;height:40px">${cluster.getChildCount()}</div>`,
    className: '',
    iconSize: [40, 40],
  }),
  maxClusterRadius: 50,
});

const listEl = document.getElementById('parkList');
const areaSelect = document.getElementById('areaSelect');
const searchBar = document.getElementById('searchBar');
const nearbySheetBackdrop = document.getElementById('nearbySheetBackdrop');
const nearbySheet = document.getElementById('nearbySheet');
const nearbySheetTitle = document.getElementById('nearbySheetTitle');
const nearbySheetHandle = document.getElementById('nearbySheetHandle');
const nearbySheetList = document.getElementById('nearbySheetList');
const NEARBY_SHEET_RADIUS_KM = 3;
const markersById = {};
let parks = []; // Holds every fetched location, of any category. Name is a holdover from when only parks existed
let selectedId = null;

// Maps each pill's data filter value to the category string the backend actually uses
const CATEGORY_MAP = { parks: 'park', malls: 'mall', eats: 'eat', vets: 'vet' };
const selectedCategories = new Set(['park']); // Starts with only Parks shown, matching the pill that's active by default

// Toggles a category in or out of the current selection when its pill is clicked
const categoryPills = document.querySelectorAll('.pill[data-filter]');
categoryPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    if (pill.disabled) return;
    const category = CATEGORY_MAP[pill.dataset.filter];
    if (selectedCategories.has(category)) {
      selectedCategories.delete(category);
      pill.classList.remove('active');
    } else {
      selectedCategories.add(category);
      pill.classList.add('active');
    }
    applyFilter();
  });
});

// Categories are now always visible and tabs are evenly spaced. No overflow scroll needed
function directionsUrl(park) {
  return `https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lng}`;
}

// Tracks which locations this browser has liked, so the like button greys out. Stored per browser only
function getLikedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('pawventures_liked') || '[]'));
  } catch {
    return new Set();
  }
}

function saveLikedSet(set) {
  localStorage.setItem('pawventures_liked', JSON.stringify([...set]));
}

// This escapes HTML special characters in submitted text, such as names and notes
// It stops malicious markup from running when that text is shown in a popup
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// This builds the popup's inner HTML, reusing the same CSS classes as the earlier design
function detailHTML(park) {
  const tags = park.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const star = park.like_count >= 10 ? '<span class="approved-star" title="Community approved">★</span>' : '';
  const liked = getLikedSet().has(park.id);
  const size = park.size ? `<p class="detail-size">${escapeHtml(park.size)}</p>` : '';
  return `
    <p class="detail-area">${escapeHtml(park.area)}</p>
    <h2 class="detail-name">${escapeHtml(park.name)}${star}</h2>
    <p class="detail-address">${escapeHtml(park.address)}</p>
    ${size}
    <div class="detail-tags">${tags}</div>
    <p class="detail-hours">${escapeHtml(park.hours)}</p>
    <p class="detail-note">"${escapeHtml(park.note)}"</p>
    <div class="detail-actions">
      <button class="like-btn" onclick="likePark('${park.id}')" ${liked ? 'disabled' : ''}>
        🐾 <span>${park.like_count}</span>
      </button>
      <a class="detail-directions" href="${directionsUrl(park)}" target="_blank" rel="noopener">Get directions</a>
    </div>
  `;
}

// This is attached to window so the inline onclick in detailHTML() can actually call it
window.likePark = async function (id) {
  const liked = getLikedSet();
  if (liked.has(id)) return;

  try {
    const res = await fetch(`/api/locations/${encodeURIComponent(id)}/like`, { method: 'POST' });
    if (!res.ok) return;
    const result = await res.json();

    liked.add(id);
    saveLikedSet(liked);

    const park = parks.find((p) => p.id === id);
    if (park) {
      park.like_count = result.like_count;
      const marker = markersById[id];
      if (marker) marker.setPopupContent(detailHTML(park)); // This updates the open popup live, without reopening it
    }
  } catch (err) {
    console.error(err);
  }
};

function renderList(items) {
  listEl.innerHTML = '';
  items.forEach((park) => {
    const li = document.createElement('li');
    li.className = 'park-row' + (park.id === selectedId ? ' selected' : '');
    li.dataset.id = park.id;
    const distance = userLocation
      ? `<p class="park-row-distance">${distanceKm(userLocation.lat, userLocation.lng, park.lat, park.lng).toFixed(1)} km</p>`
      : '';
    li.innerHTML = `
      <p class="park-row-name">${park.name}</p>
      <p class="park-row-area">${park.area}</p>
      ${distance}
    `;
    li.addEventListener('click', () => selectPark(park.id, true));
    listEl.appendChild(li);
  });
}

function renderMarkers(items) {
  clusterGroup.clearLayers();
  items.forEach((park) => {
    const icon = pawIconsByCategory[park.category] || pawIconsByCategory.park;
    const marker = L.marker([park.lat, park.lng], { icon });

    // Only pins close by get a permanent label
    let tooltipText = park.name;
    let permanent = false;
    if (userLocation) {
      const dist = distanceKm(userLocation.lat, userLocation.lng, park.lat, park.lng);
      if (dist <= NEARBY_LABEL_RADIUS_KM) {
        tooltipText = `${park.name} — ${dist.toFixed(1)} km away`;
        permanent = true;
      }
    }
    marker.bindTooltip(tooltipText, { permanent, direction: 'top', offset: [0, -28], className: 'park-tooltip' });

    marker.bindPopup(detailHTML(park), { className: 'park-popup', maxWidth: 260 });
    marker.on('click', () => {
      selectedId = park.id;
      renderList(currentFilteredList());
    });
    markersById[park.id] = marker;
    clusterGroup.addLayer(marker);
  });
  map.addLayer(clusterGroup);
}

// This runs when a sidebar row is clicked, panning to the pin and opening it's popup
function selectPark(id, panMap) {
  selectedId = id;
  const park = parks.find((p) => p.id === id);
  if (!park) return;
  renderList(currentFilteredList());
  const marker = markersById[id];
  if (marker) {
    if (panMap) {
      map.panTo([park.lat, park.lng]);
      map.once('moveend', () => marker.openPopup()); // Opening mid-pan can render the popup in the wrong spot
    } else {
      marker.openPopup();
    }
  }
}

function currentFilteredList() {
  const area = areaSelect.value;
  let filtered = parks.filter((p) => selectedCategories.has(p.category));
  if (area) filtered = filtered.filter((p) => p.area === area);

  // Once located, nearest locations are shown first, otherwise the original order is kept
  if (userLocation) {
    filtered = [...filtered].sort((a, b) => {
      const distA = distanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distB = distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    });
  }

  return filtered;
}

function applyFilter() {
  const filtered = currentFilteredList();
  renderList(filtered);
  renderMarkers(filtered);
  // Keeps the sheet's content fresh even while collapsed, so it is up to date whenever reopened
  if (userLocation) updateNearbySheet();
}

// Rebuilds the sheet's list, everything within NEARBY_SHEET_RADIUS_KM, or if there are genuinely nothing that close, show what are the next best options
function updateNearbySheet() {
  const filtered = currentFilteredList(); // Already sorted nearest first once userLocation is set
  const withinRadius = filtered.filter(
    (p) => distanceKm(userLocation.lat, userLocation.lng, p.lat, p.lng) <= NEARBY_SHEET_RADIUS_KM,
  );

  let items;
  if (withinRadius.length > 0) {
    items = withinRadius;
    nearbySheetTitle.textContent = `Within ${NEARBY_SHEET_RADIUS_KM} km`;
  } else if (filtered.length > 0) {
    items = filtered.slice(0, 8);
    nearbySheetTitle.textContent = `Nothing within ${NEARBY_SHEET_RADIUS_KM} km — here's what's closest`;
  } else {
    items = [];
    nearbySheetTitle.textContent = 'Nothing matches the current filter';
  }

  nearbySheetList.innerHTML = '';
  items.forEach((park) => {
    const li = document.createElement('li');
    li.className = 'nearby-sheet-row';
    const dist = distanceKm(userLocation.lat, userLocation.lng, park.lat, park.lng).toFixed(1);
    li.innerHTML = `
      <div>
        <p class="nearby-sheet-row-name">${escapeHtml(park.name)}</p>
        <p class="nearby-sheet-row-area">${escapeHtml(park.area)}</p>
      </div>
      <span class="nearby-sheet-row-distance">${dist} km</span>
    `;
    li.addEventListener('click', () => {
      collapseNearbySheet();
      selectPark(park.id, true);
    });
    nearbySheetList.appendChild(li);
  });
}

// Fully expands the sheet. Used on every locate button press
function openNearbySheet() {
  updateNearbySheet();
  nearbySheet.classList.remove('peek');
  nearbySheet.classList.add('open');
  nearbySheetBackdrop.classList.add('open');
}

// Collapses to a small visible strip instead of hiding completely, so the sheet stays reachable without needing to press locate button again
function collapseNearbySheet() {
  nearbySheet.classList.remove('open');
  nearbySheet.classList.add('peek');
  nearbySheetBackdrop.classList.remove('open');
}

nearbySheetBackdrop.addEventListener('click', collapseNearbySheet);
// The handle toggles both ways, tap to expand while peeking, tap to collapse while open
nearbySheetHandle.addEventListener('click', () => {
  if (nearbySheet.classList.contains('peek')) {
    openNearbySheet();
  } else if (nearbySheet.classList.contains('open')) {
    collapseNearbySheet();
  }
});

areaSelect.addEventListener('change', applyFilter);

// Address / postal code search (OneMap). Strips "Blk"/"Block" first, their index omits it
// Picking a result moves the same "you are here" pin the locate button uses
const searchInput = document.getElementById('searchInput');
let searchResultsEl = null;
let searchDebounceTimer = null;

function ensureSearchResultsEl() {
  if (searchResultsEl) return searchResultsEl;
  searchResultsEl = document.createElement('ul');
  searchResultsEl.className = 'search-results';
  searchBar.appendChild(searchResultsEl);
  return searchResultsEl;
}

// Removes the dropdown entirely, an empty <ul> would still show as a blank box
function clearSearchResults() {
  if (!searchResultsEl) return;
  searchResultsEl.remove();
  searchResultsEl = null;
}

function renderSearchResults(results) {
  clearSearchResults();
  const resultsEl = ensureSearchResultsEl();

  if (results.length === 0) {
    const li = document.createElement('li');
    li.className = 'search-result-empty';
    li.textContent = 'No matches found';
    resultsEl.appendChild(li);
    return;
  }

  results.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'search-result';
    li.textContent = r.SEARCHVAL || r.ADDRESS;
    li.addEventListener('click', () => {
      const lat = parseFloat(r.LATITUDE);
      const lng = parseFloat(r.LONGITUDE);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      setUserLocation(lat, lng, { tooltip: 'Sniff spot found!' });
    });
    resultsEl.appendChild(li);
  });
}

async function runAddressSearch(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    clearSearchResults();
    return;
  }

  const cleaned = trimmed.replace(/^(blk|block)\.?\s+/i, '');
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(cleaned)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderSearchResults((data.results || []).slice(0, 6));
  } catch (err) {
    console.error(err);
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  const value = searchInput.value;
  searchDebounceTimer = setTimeout(() => runAddressSearch(value), 300);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-bar')) {
    clearSearchResults();
  }
});

// This used to read data/parks.json directly. However, it now fetches live from the backend API
// This is a relative path, so it works both locally and once deployed.
fetch('/api/locations')
  .then((res) => res.json())
  .then((data) => {
    parks = data;

    const areas = [...new Set(parks.map((p) => p.area))].sort();
    areas.forEach((area) => {
      const opt = document.createElement('option');
      opt.value = area;
      opt.textContent = area;
      areaSelect.appendChild(opt);
    });

    applyFilter();
  })
  .catch((err) => {
    listEl.innerHTML = '<li style="padding:14px;color:var(--ink-muted);font-size:13px">Could not load locations — is the backend server running? (npm start in the backend folder)</li>';
    console.error(err);
  });

// --- Contribute form ---
const fab = document.getElementById('contributeFab');
const overlay = document.getElementById('contributeOverlay');
const closeBtn = document.getElementById('contributeClose');
const form = document.getElementById('contributeForm');
const statusEl = document.getElementById('contributeStatus');

fab.addEventListener('click', () => { overlay.hidden = false; });
closeBtn.addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = '';
  statusEl.className = '';

  const body = {
    submitter_name: document.getElementById('cName').value.trim() || undefined,
    park_name: document.getElementById('cParkName').value.trim(),
    address: document.getElementById('cAddress').value.trim(),
    details: document.getElementById('cDetails').value.trim(),
    nearest_carpark: document.getElementById('cCarpark').value.trim() || undefined,
    website: document.getElementById('cWebsite').value, // This is the honeypot field; real users never fill it in.
  };

  try {
    const res = await fetch('/api/contributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (res.ok) {
      statusEl.textContent = 'Thanks! Your suggestion has been sent for review.';
      statusEl.className = 'ok';
      form.reset();
      setTimeout(() => { overlay.hidden = true; statusEl.textContent = ''; }, 1800);
    } else {
      statusEl.textContent = result.error || 'Something went wrong — please try again.';
      statusEl.className = 'err';
    }
  } catch (err) {
    statusEl.textContent = 'Could not reach the server — please try again.';
    statusEl.className = 'err';
  }
});