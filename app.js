// Interactive Canvas Loading Screen
const loader = document.getElementById('loader');
if (loader) {
    const canvas = document.getElementById('seismic-canvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let mouseX = -1000;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    loader.addEventListener('mousemove', (e) => { mouseX = e.clientX; });
    loader.addEventListener('mouseleave', () => { mouseX = -1000; });

    let time = 0;
    let animationId;

    function drawWave() {
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        for (let x = 0; x <= width; x += 2) {
            let y = height / 2 + Math.sin(x * 0.01 + time) * 15;
            let dist = Math.abs(x - mouseX);
            if (dist < 200) {
                let intensity = (200 - dist) / 200;
                y += (Math.random() - 0.5) * 120 * intensity;
            }
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#ba955c';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        time += 0.1;
        animationId = requestAnimationFrame(drawWave);
    }
    drawWave();

    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            cancelAnimationFrame(animationId);
        }, 500);
    }, 4500);
}

// Global UI Logic (Dark Mode)
const darkModeToggle = document.getElementById('darkModeToggle');
let isDark = localStorage.getItem('darkMode') === 'true';

const lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CARTO' });

function applyTheme() {
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (map) { map.removeLayer(lightTiles); darkTiles.addTo(map); }
    } else {
        document.body.classList.remove('dark-mode');
        if (map) { map.removeLayer(darkTiles); lightTiles.addTo(map); }
    }
}

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        isDark = !isDark;
        localStorage.setItem('darkMode', isDark);
        applyTheme();
    });
}

// API Keys & State Variables
const GEMINI_API_KEY = 'YAQ.Ab8RN6LegiLhTovzd6VxDW_Ztiuj-SWh8DWYV-b40H9Eg_ax7g';
const usgsUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

let allEarthquakes = [];
let minTime = 0;
let maxTime = 0;
let isHeatmapMode = false;
const knownQuakeIds = new Set();

const slider = document.getElementById('timeSlider');
const timeLabel = document.getElementById('timeLabel');
const heatmapBtn = document.getElementById('toggleHeatmap');

// Initialize Map
const map = L.map('map').setView([20, 0], 2);
applyTheme();
const dataLayer = L.layerGroup().addTo(map);

// Data Fetching
function fetchEarthquakes() {
    fetch(usgsUrl)
        .then(response => response.json())
        .then(data => {
            allEarthquakes = data.features;
            let isInitialLoad = knownQuakeIds.size === 0;

            allEarthquakes.forEach(f => {
                if (!isInitialLoad && !knownQuakeIds.has(f.id)) {
                    f.properties.isNew = true;
                    setTimeout(() => { f.properties.isNew = false; renderMap(); }, 15000);
                }
                knownQuakeIds.add(f.id);
            });

            const times = allEarthquakes.map(f => f.properties.time);
            minTime = Math.min(...times);
            maxTime = Math.max(...times);
            renderMap();
        })
        .catch(error => console.error('Error fetching USGS data:', error));
}

// Dynamic Rendering & Gemini Integration
function renderMap() {
    const sliderValue = slider.value;
    const targetTime = minTime + ((maxTime - minTime) * (sliderValue / 100));

    if (sliderValue == 100) {
        timeLabel.innerText = "Viewing: All activity in the last 24 hours";
    } else {
        timeLabel.innerText = `Viewing activity up to: ${new Date(targetTime).toLocaleString()}`;
    }

    dataLayer.clearLayers();
    const filteredFeatures = allEarthquakes.filter(f => f.properties.time <= targetTime);

    if (isHeatmapMode) {
        const heatPoints = filteredFeatures.map(f => [
            f.geometry.coordinates[1], f.geometry.coordinates[0], f.properties.mag
        ]);
        const heatLayer = L.heatLayer(heatPoints, { radius: 20, blur: 15, maxZoom: 10, max: 8.0 });
        dataLayer.addLayer(heatLayer);
    } else {
        const geoJsonLayer = L.geoJSON(filteredFeatures, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: feature.properties.mag * 2.5,
                    fillColor: feature.properties.isNew ? "#2d4a3e" : "#ba955c",
                    color: feature.properties.isNew ? "#eeeae2" : "#2e3d58",
                    weight: 1, opacity: 1, fillOpacity: 0.7,
                    className: feature.properties.isNew ? 'pulse-new' : ''
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
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
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

slider.addEventListener('input', renderMap);
heatmapBtn.addEventListener('click', () => {
    isHeatmapMode = !isHeatmapMode;
    heatmapBtn.innerText = isHeatmapMode ? "Disable Heatmap" : "Enable Heatmap";
    renderMap();
});

fetchEarthquakes();
setInterval(fetchEarthquakes, 60000);