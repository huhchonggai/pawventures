const PAW_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="6.5" cy="8" r="2.1"/><circle cx="12" cy="5.6" r="2.3"/><circle cx="17.5" cy="8" r="2.1"/><path d="M12 10.5c-3.2 0-6.2 2.6-6.2 5.4 0 1.7 1.4 2.6 3 2.2 1.1-.3 2-1 3.2-1s2.1.7 3.2 1c1.6.4 3-.5 3-2.2 0-2.8-3-5.4-6.2-5.4z"/></svg>';

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
}).setView([1.3521, 103.8198], 12);

// OneMap GreyLite basemap — free, no API key, attribution required by their Terms of Use.
L.tileLayer('https://www.onemap.gov.sg/maps/tiles/GreyLite/{z}/{x}/{y}.png', {
  detectRetina: true,
  maxZoom: 19,
  minZoom: 11,
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
const markersById = {};
let parks = [];
let selectedId = null;

function directionsUrl(park) {
  return `https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lng}`;
}

// Builds the popup's inner HTML — reuses the same CSS classes the old
// fixed-position detail card used, so it looks the same, it's just
// rendered inside a Leaflet popup now instead of a fixed div.
function detailHTML(park) {
  const tags = park.tags.map((t) => `<span class="tag">${t}</span>`).join('');
  return `
    <p class="detail-area">${park.area}</p>
    <h2 class="detail-name">${park.name}</h2>
    <p class="detail-address">${park.address}</p>
    <div class="detail-tags">${tags}</div>
    <p class="detail-hours">${park.hours}</p>
    <p class="detail-note">"${park.note}"</p>
    <a class="detail-directions" href="${directionsUrl(park)}" target="_blank" rel="noopener">Get directions</a>
  `;
}

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

// Called when a sidebar row is clicked — pans to the pin and opens its
// popup, same as clicking the pin directly would.
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
}

areaSelect.addEventListener('change', applyFilter);

fetch('data/parks.json')
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
    listEl.innerHTML = '<li style="padding:14px;color:var(--ink-muted);font-size:13px">Could not load park data — check that parks.json is served alongside index.html.</li>';
    console.error(err);
  });
