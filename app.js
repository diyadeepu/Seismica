// 1. API Keys & State Variables
const GEMINI_API_KEY = 'YAQ.Ab8RN6LegiLhTovzd6VxDW_Ztiuj-SWh8DWYV-b40H9Eg_ax7g';
const usgsUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

let allEarthquakes = [];
let minTime = 0;
let maxTime = 0;
let isHeatmapMode = false;

const slider = document.getElementById('timeSlider');
const timeLabel = document.getElementById('timeLabel');
const heatmapBtn = document.getElementById('toggleHeatmap');

// 2. Loading Screen Logic
setTimeout(() => {
    const loader = document.getElementById('loader');
    loader.style.opacity = '0';
    setTimeout(() => { loader.style.display = 'none'; }, 500);
}, 3000);

// 3. Initialize Map & Layer Group
const map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Use a dedicated LayerGroup so we can easily clear old data without deleting base tiles
const dataLayer = L.layerGroup().addTo(map);

// 4. Data Fetching
function fetchEarthquakes() {
    fetch(usgsUrl)
        .then(response => response.json())
        .then(data => {
            allEarthquakes = data.features;

            // Calculate time bounds for the slider
            const times = allEarthquakes.map(f => f.properties.time);
            minTime = Math.min(...times);
            maxTime = Math.max(...times);

            renderMap();
        })
        .catch(error => console.error('Error fetching USGS data:', error));
}

// 5. Dynamic Rendering & Gemini Integration
function renderMap() {
    // Determine cutoff time based on slider percentage
    const sliderValue = slider.value;
    const targetTime = minTime + ((maxTime - minTime) * (sliderValue / 100));

    if (sliderValue == 100) {
        timeLabel.innerText = "Viewing: All activity in the last 24 hours";
    } else {
        timeLabel.innerText = `Viewing activity up to: ${new Date(targetTime).toLocaleString()}`;
    }

    // Safely clear all old markers/heatmaps before drawing new ones
    dataLayer.clearLayers();

    // Filter features based on slider time
    const filteredFeatures = allEarthquakes.filter(f => f.properties.time <= targetTime);

    if (isHeatmapMode) {
        // Extract array of [lat, lng, intensity] for the heat plugin
        const heatPoints = filteredFeatures.map(f => [
            f.geometry.coordinates[1], // Latitude
            f.geometry.coordinates[0], // Longitude
            f.properties.mag           // Intensity scaling
        ]);

        const heatLayer = L.heatLayer(heatPoints, {
            radius: 20,
            blur: 15,
            maxZoom: 10,
            max: 8.0 // Scales color intensity against a theoretical 8.0 max magnitude
        });

        dataLayer.addLayer(heatLayer);
    } else {
        // Standard Circle Markers
        const geoJsonLayer = L.geoJSON(filteredFeatures, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: feature.properties.mag * 2.5,
                    fillColor: "#ba955c",
                    color: "#2e3d58",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.7
                });
            },
            onEachFeature: function (feature, layer) {
                const place = feature.properties.place;
                const mag = feature.properties.mag;
                const time = new Date(feature.properties.time).toLocaleString();
                const popupId = `ai-${feature.id}`;

                layer.bindPopup(`
                    <strong>Magnitude: ${mag}</strong><br>
                    Location: ${place}<br>
                    Time: ${time}<br><br>
                    <div id="${popupId}" style="color: #ba955c; font-style: italic; font-size: 0.9em;">
                        ✨ Click to generate AI impact summary...
                    </div>
                `);

                layer.on('popupopen', async () => {
                    const aiContainer = document.getElementById(popupId);
                    if (feature.properties.aiFetched) return;

                    aiContainer.innerText = "✨ Generating AI impact summary...";

                    const prompt = `Write a single, short, practical sentence summarizing the likely human impact and structural damage of a ${mag} magnitude earthquake near ${place}. Keep it grounded and objective.`;

                    try {
                        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                        });
                        const result = await response.json();
                        aiContainer.innerText = "✨ " + result.candidates[0].content.parts[0].text;
                        feature.properties.aiFetched = true;
                    } catch (error) {
                        aiContainer.innerText = "⚠️ AI summary currently unavailable.";
                    }
                });
            }
        });

        dataLayer.addLayer(geoJsonLayer);
    }
}

// 6. Listeners and Execution
slider.addEventListener('input', renderMap);

heatmapBtn.addEventListener('click', () => {
    isHeatmapMode = !isHeatmapMode;
    heatmapBtn.innerText = isHeatmapMode ? "Disable Heatmap" : "Enable Heatmap";
    renderMap();
});

fetchEarthquakes();
setInterval(fetchEarthquakes, 60000);