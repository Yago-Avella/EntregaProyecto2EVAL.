const { app, BrowserWindow, ipcMain } = require('electron');
const axios = require('axios');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        fullscreen: true, // Abrir en pantalla completa
        frame: true, // Mantener la barra de título y los botones de la ventana
        autoHideMenuBar: true, // Ocultar la barra de menú (pero mantener los botones de la ventana)
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Función para obtener coordenadas usando Nominatim
async function getCoordinates(location) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
    try {
        const response = await axios.get(nominatimUrl);
        if (response.data.length > 0) {
            const { lat, lon } = response.data[0];
            return { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            throw new Error('Ubicación no encontrada.');
        }
    } catch (error) {
        console.error('Error en Nominatim:', error);
        throw new Error('No se pudo obtener las coordenadas.');
    }
}

// Función para consultar la API de Overpass según el filtro seleccionado
async function searchOverpass(lat, lon, filter) {
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const radius = 7000; // 7 km en metros

    // Definir las consultas según el filtro seleccionado
    const queries = {
        sport: `
            [out:json];
            (
                node["leisure"="pitch"](around:${radius},${lat},${lon});
                node["leisure"="sports_centre"](around:${radius},${lat},${lon});
                node["sport"="tennis"](around:${radius},${lat},${lon});
                node["sport"="soccer"](around:${radius},${lat},${lon});
                node["sport"="basketball"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `,
        food: `
            [out:json];
            (
                node["amenity"="restaurant"](around:${radius},${lat},${lon});
                node["amenity"="cafe"](around:${radius},${lat},${lon});
                node["amenity"="bar"](around:${radius},${lat},${lon});
                node["amenity"="fast_food"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `,
        leisure: `
            [out:json];
            (
                node["amenity"="cinema"](around:${radius},${lat},${lon});
                node["leisure"="park"](around:${radius},${lat},${lon});
                node["leisure"="beach"](around:${radius},${lat},${lon});
                node["tourism"="zoo"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `,
        supermarket: `
            [out:json];
            (
                node["shop"="supermarket"](around:${radius},${lat},${lon});
                node["shop"="convenience"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `,
        tourism: `
            [out:json];
            (
                node["tourism"="museum"](around:${radius},${lat},${lon});
                node["tourism"="attraction"](around:${radius},${lat},${lon});
                node["tourism"="viewpoint"](around:${radius},${lat},${lon});
                node["historic"="monument"](around:${radius},${lat},${lon});
            );
            out body;
            >;
            out skel qt;
        `,
    };

    const query = queries[filter] || queries.sport; // Por defecto, busca deportes si el filtro no es válido

    try {
        const response = await axios.post(overpassUrl, query, {
            headers: { 'Content-Type': 'text/plain' },
        });

        // Filtrar elementos con coordenadas
        const elementsWithCoords = response.data.elements.filter(element => element.lat && element.lon);
        return elementsWithCoords;
    } catch (error) {
        console.error('Error en la consulta a Overpass:', error);
        return { error: 'No se pudo obtener datos de Overpass.' };
    }
}

// Escucha el evento de búsqueda
ipcMain.on('search-location', async (event, { location, filter }) => {
    console.log('Buscando:', location, 'con filtro:', filter);

    try {
        const coordinates = await getCoordinates(location);
        const result = await searchOverpass(coordinates.lat, coordinates.lon, filter);

        // Añadir location al objeto de respuesta
        event.reply('search-result', { 
            coordinates, 
            results: result,
            location: location  // <- Línea añadida
        });
    } catch (error) {
        console.error('Error en la búsqueda:', error);
        event.reply('search-result', { 
            error: error.message,
            location: location  // <- Línea añadida
        });
    }
});