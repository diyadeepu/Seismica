// Dark Mode Logic (Shared State)
const darkModeToggle = document.getElementById('darkModeToggle');
let isDark = localStorage.getItem('darkMode') === 'true';
let analyticsMap; // Declared at top to prevent Temporal Dead Zone errors

const lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CARTO' });

function applyTheme() {
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (analyticsMap) { analyticsMap.removeLayer(lightTiles); darkTiles.addTo(analyticsMap); }
    } else {
        document.body.classList.remove('dark-mode');
        if (analyticsMap) { analyticsMap.removeLayer(darkTiles); lightTiles.addTo(analyticsMap); }
    }
}

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        isDark = !isDark;
        localStorage.setItem('darkMode', isDark);
        applyTheme();

        // Safely update Chart.js themes by iterating over the Object keys
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = isDark ? '#eeeae2' : '#2e3d58';
            for (let id in Chart.instances) {
                Chart.instances[id].update();
            }
        }
    });
}

// Chart.js Theme Defaults
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = isDark ? '#eeeae2' : '#2e3d58';
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
}

// Fetch 30-Day Data
const usgsMonthUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson';
let monthData = [];

// Time-lapse Map Setup
analyticsMap = L.map('analyticsMap').setView([20, 0], 1);
applyTheme();
const timelapseLayerGroup = L.layerGroup().addTo(analyticsMap);

const playBtn = document.getElementById('playBtn');
const timelapseSlider = document.getElementById('timelapseSlider');
const timelapseLabel = document.getElementById('timelapseLabel');
let minTimeMonth, maxTimeMonth;
let isPlaying = false;
let playInterval;

fetch(usgsMonthUrl)
    .then(res => res.json())
    .then(data => {
        monthData = data.features;

        // Stack-safe calculation for thousands of data points
        const times = monthData.map(f => f.properties.time);
        minTimeMonth = times.reduce((a, b) => Math.min(a, b), Infinity);
        maxTimeMonth = times.reduce((a, b) => Math.max(a, b), -Infinity);

        initLeaderboard();
        initGutenbergRichter();
        initTimelineChart();
        renderTimelapse();
    })
    .catch(err => console.error("Error loading analytics data:", err));

function initLeaderboard() {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';

    const topQuakes = [...monthData].sort((a, b) => b.properties.mag - a.properties.mag).slice(0, 5);

    topQuakes.forEach(quake => {
        const li = document.createElement('li');
        const place = quake.properties.place;
        const mag = quake.properties.mag.toFixed(1);
        const date = new Date(quake.properties.time).toLocaleDateString();

        li.innerHTML = `<span><strong>M ${mag}</strong> - ${place}</span> <span>${date}</span>`;
        list.appendChild(li);
    });
}

function initGutenbergRichter() {
    if (!document.getElementById('histogramChart')) return;
    const ctx = document.getElementById('histogramChart').getContext('2d');

    const bins = { '2.5-3.5': 0, '3.5-4.5': 0, '4.5-5.5': 0, '5.5-6.5': 0, '6.5+': 0 };

    monthData.forEach(q => {
        const m = q.properties.mag;
        if (m < 3.5) bins['2.5-3.5']++;
        else if (m < 4.5) bins['3.5-4.5']++;
        else if (m < 5.5) bins['4.5-5.5']++;
        else if (m < 6.5) bins['5.5-6.5']++;
        else bins['6.5+']++;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(bins),
            datasets: [{
                label: 'Number of Earthquakes (Log Scale)',
                data: Object.values(bins),
                backgroundColor: '#ba955c',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { type: 'logarithmic', title: { display: true, text: 'Frequency (Log)' } },
                x: { title: { display: true, text: 'Magnitude Range' } }
            }
        }
    });
}

function initTimelineChart() {
    if (!document.getElementById('timelineChart')) return;
    const ctx = document.getElementById('timelineChart').getContext('2d');

    const dailyCounts = {};
    monthData.forEach(q => {
        const dateString = new Date(q.properties.time).toLocaleDateString();
        dailyCounts[dateString] = (dailyCounts[dateString] || 0) + 1;
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(dailyCounts),
            datasets: [{
                label: 'Earthquakes per Day',
                data: Object.values(dailyCounts),
                borderColor: '#8d8c72',
                backgroundColor: 'rgba(141, 140, 114, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { ticks: { maxTicksLimit: 10 } },
                y: { beginAtZero: true }
            }
        }
    });
}

function renderTimelapse() {
    const sliderValue = timelapseSlider.value;
    const targetTime = minTimeMonth + ((maxTimeMonth - minTimeMonth) * (sliderValue / 100));

    timelapseLabel.innerText = new Date(targetTime).toLocaleDateString();
    timelapseLayerGroup.clearLayers();

    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const filtered = monthData.filter(f => f.properties.time <= targetTime && f.properties.time >= (targetTime - twoDaysMs));

    L.geoJSON(filtered, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: feature.properties.mag * 1.5,
                fillColor: "#ba955c",
                color: "#2e3d58",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });
        }
    }).addTo(timelapseLayerGroup);
}

timelapseSlider.addEventListener('input', renderTimelapse);

playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playBtn.innerText = isPlaying ? "Pause" : "Play";

    if (isPlaying) {
        if (timelapseSlider.value == 100) timelapseSlider.value = 0;
        playInterval = setInterval(() => {
            let val = parseInt(timelapseSlider.value);
            if (val >= 100) {
                clearInterval(playInterval);
                isPlaying = false;
                playBtn.innerText = "Play";
            } else {
                timelapseSlider.value = val + 1;
                renderTimelapse();
            }
        }, 100);
    } else {
        clearInterval(playInterval);
    }
});