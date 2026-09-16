const PAW_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="6.5" cy="8" r="2.1"/><circle cx="12" cy="5.6" r="2.3"/><circle cx="17.5" cy="8" r="2.1"/><path d="M12 10.5c-3.2 0-6.2 2.6-6.2 5.4 0 1.7 1.4 2.6 3 2.2 1.1-.3 2-1 3.2-1s2.1.7 3.2 1c1.6.4 3-.5 3-2.2 0-2.8-3-5.4-6.2-5.4z"/></svg>';

const singaporeBounds = L.latLngBounds(
  L.latLng(1.15, 103.55), // This is the southwest corner, with a small buffer around the mainland
  L.latLng(1.50, 104.10), // This is the northeast corner
);

const map = L.map('map', {
  zoomControl: false, // Added manually below, moved to bottom left so it doesn't sit under the floating topbar on mobile.
  attributionControl: false, // Also added manually below. Grouped with zoom and without Leaflet's own default credit.
  minZoom: 13,
  maxBounds: singaporeBounds,
  maxBoundsViscosity: 1.0, // A value of 1.0 creates a hard stop at the boundary, with no rubber banding past it
}).setView([1.3521, 103.8198], 12);

L.control.zoom({ position: 'bottomleft' }).addTo(map);

// Removes Leaflet's own credit, but keeps OneMap's
L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

// OneMap offers several basemap styles (Default, Original, Grey, GreyLite and Night)
L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png', {
  detectRetina: true,
  maxZoom: 19,
  minZoom: 13, // This matches the map's own minZoom above, so this number never actually takes effect
  attribution: '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo_round@2x.png" style="height:14px;vertical-align:middle;margin-right:4px"> OneMap | Map data &copy; contributors, Singapore Land Authority',
}).addTo(map);

const pawIcon = L.divIcon({
  className: '',
  html: `<div class="paw-pin">${PAW_SVG}</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 30],
  popupAnchor: [0, -30],
});

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
const areaFilterDot = document.getElementById('areaFilterDot');
const filtersNav = document.getElementById('filtersNav');
const filtersScrollArrow = document.getElementById('filtersScrollArrow');
const markersById = {};
let parks = [];
let selectedId = null;

// Shows the arrow only when categories overflow the visible width
// Stays hidden today and is only activated once more are added
function updateFiltersArrow() {
  if (!filtersNav || !filtersScrollArrow) return;
  const hasOverflow = filtersNav.scrollWidth > filtersNav.clientWidth + 4;
  const nearEnd = filtersNav.scrollLeft + filtersNav.clientWidth >= filtersNav.scrollWidth - 4;
  filtersScrollArrow.hidden = !hasOverflow || nearEnd;
}

if (filtersNav && filtersScrollArrow) {
  filtersScrollArrow.addEventListener('click', () => {
    filtersNav.scrollBy({ left: 100, behavior: 'smooth' });
  });
  filtersNav.addEventListener('scroll', updateFiltersArrow);
  window.addEventListener('resize', updateFiltersArrow);
  updateFiltersArrow();
}

function directionsUrl(park) {
  return `https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lng}`;
}

// This tracks which locations this browser has liked, so the button greys out after clicking
// Only affects the browser, since clearing localStorage would reset it
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
  return `
    <p class="detail-area">${escapeHtml(park.area)}</p>
    <h2 class="detail-name">${escapeHtml(park.name)}${star}</h2>
    <p class="detail-address">${escapeHtml(park.address)}</p>
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
    const res = await fetch(`/api/locations/${id}/like`, { method: 'POST' });
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
    li.innerHTML = `
      <p class="park-row-name">${park.name}</p>
      <p class="park-row-area">${park.area}</p>
    `;
    li.addEventListener('click', () => selectPark(park.id, true));
    listEl.appendChild(li);
  });
}

function renderMarkers(items) {
  clusterGroup.clearLayers();
  items.forEach((park) => {
    const marker = L.marker([park.lat, park.lng], { icon: pawIcon });
    marker.bindTooltip(park.name, { direction: 'top', offset: [0, -28], className: 'park-tooltip' });
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
    if (panMap) map.panTo([park.lat, park.lng]);
    marker.openPopup();
  }
}

function currentFilteredList() {
  const area = areaSelect.value;
  return area ? parks.filter((p) => p.area === area) : parks;
}

function applyFilter() {
  const filtered = currentFilteredList();
  renderList(filtered);
  renderMarkers(filtered);
  // Shows a dot on the mobile filter icon when a specific area is active
  // Area name itself is not visible once it is collapsed to just an icon
  if (areaFilterDot) areaFilterDot.hidden = !areaSelect.value;
}

areaSelect.addEventListener('change', applyFilter);

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