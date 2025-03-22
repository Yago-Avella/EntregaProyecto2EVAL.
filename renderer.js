const { ipcRenderer } = require('electron');
const L = require('leaflet');

let map = null;
let markers = [];
let isSearching = false;

document.getElementById('botones-mapas').style.display = 'none';

document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSearching) return;

    const location = document.getElementById('location').value.trim();
    if (!location) return;

    isSearching = true;
    document.getElementById('loader').style.display = 'block';
    document.getElementById('initial-content').style.display = 'none';
    document.getElementById('container').style.display = 'flex';
    document.getElementById('resultados').innerHTML = '';

    try {
        ipcRenderer.send('search-location', {
            location,
            filter: document.getElementById('filter').value
        });
    } catch (error) {
        console.error(error);
        isSearching = false;
        document.getElementById('loader').style.display = 'none';
    }
});

ipcRenderer.on('search-result', (event, { coordinates, results, error, location }) => {
    isSearching = false;
    document.getElementById('loader').style.display = 'none';

    if (error) {
        document.getElementById('resultados').innerHTML = `<p>Error: ${error}</p>`;
        return;
    }

    if (coordinates && coordinates.lat && coordinates.lon) {
        initMap(coordinates.lat, coordinates.lon);
    }

    if (results && results.length > 0) {
        document.getElementById('clearButton').style.display = 'block';
        document.getElementById('botones-mapas').style.display = 'none';
    } else {
        document.getElementById('botones-mapas').style.display = 'none';
    }

    const resultadosHTML = `
        <div class="resultados-header">
            <h2>Resultados para: ${location}</h2>
            <p>Encontrados: ${results.length} lugares</p>
        </div>
        <div class="lista-resultados" style="max-width: 100%;">
            ${results.map(item => {
                const gMapsUrl = `https://www.google.com/maps?q=${item.lat},${item.lon}`;
                const osmUrl = `https://www.openstreetmap.org/#map=16/${item.lat}/${item.lon}`;
                return `
                    <div class="resultado">
                        <h3>${item.tags?.name || 'Ubicación sin nombre'}</h3>
                        <p class="tipo">${getCategory(item.tags)}</p>
                        ${item.tags?.['addr:street'] ? `<p class="direccion">📍 ${item.tags['addr:street']}</p>` : ''}
                        <div class="popup-buttons">
                            <button onclick="window.open('${gMapsUrl}', '_blank')">
                                <img src="https://img.icons8.com/color/24/google-maps-new.png"> Google Maps
                            </button>
                            <button onclick="window.open('${osmUrl}', '_blank')">
                                <img src="https://img.icons8.com/color/24/openstreetmap.png"> OSM
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    document.getElementById('resultados').innerHTML = resultadosHTML;

    results.forEach(item => {
        if (item.lat && item.lon) {
            const gMapsUrl = `https://www.google.com/maps?q=${item.lat},${item.lon}`;
            const osmUrl = `https://www.openstreetmap.org/#map=16/${item.lat}/${item.lon}`;
            
            const marker = L.marker([item.lat, item.lon])
                .addTo(map)
                .bindPopup(`
                    <div class="popup-mapa">
                        <h4>${item.tags?.name || 'Ubicación'}</h4>
                        <p>${item.tags?.['addr:street'] || ''}</p>
                        <div class="popup-buttons">
                            <button onclick="window.open('${gMapsUrl}', '_blank')">
                                <img src="https://img.icons8.com/color/24/google-maps-new.png"> Google Maps
                            </button>
                            <button onclick="window.open('${osmUrl}', '_blank')">
                                <img src="https://img.icons8.com/color/24/openstreetmap.png"> OSM
                            </button>
                        </div>
                    </div>
                `);
            markers.push(marker);
        }
    });

    if (markers.length > 0) {
        const bounds = L.latLngBounds(markers.map(m => m.getLatLng()));
        map.fitBounds(bounds.pad(0.1));
    }
});

function initMap(lat, lon) {
    if (map) {
        map.remove();
        markers = [];
    }
    
    map = L.map('map', {
        center: [lat, lon],
        zoom: 13,
        layers: [
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            })
        ]
    });

    setTimeout(() => {
        map.invalidateSize();
        L.control.zoom({ position: 'topright' }).addTo(map);
    }, 300);
}

document.getElementById('clearButton').addEventListener('click', () => {
    document.getElementById('initial-content').style.display = 'block';
    document.getElementById('container').style.display = 'none';
    document.getElementById('resultados').innerHTML = '';
    document.getElementById('botones-mapas').style.display = 'none';
    
    if (map) {
        map.remove();
        map = null;
    }
    markers = [];
});

function getCategory(tags) {
    const categories = {
        sport: 'Deporte',
        food: 'Comida',
        leisure: 'Ocio',
        supermarket: 'Supermercado',
        tourism: 'Turismo'
    };
    return Object.keys(tags).find(key => categories[key]) || 'General';
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loader').style.display = 'none';
});
