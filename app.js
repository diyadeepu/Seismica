// 1. Loading Screen Logic
setTimeout(() => {
    const loader = document.getElementById('loader');
    loader.style.opacity = '0';

    setTimeout(() => {
        loader.style.display = 'none';
    }, 500);
}, 3000);

// 2. Initialize the map
const map = L.map('map').setView([20, 0], 2);

// 3. Add base tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// 4. Define API and Data Fetch Logic
const usgsUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

function fetchEarthquakes() {
    fetch(usgsUrl)
        .then(response => response.json())
        .then(data => {
            // Clear old markers before drawing new ones
            map.eachLayer((layer) => {
                if (layer.feature) {
                    map.removeLayer(layer);
                }
            });

            // Plot new markers
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    let mag = feature.properties.mag;
                    return L.circleMarker(latlng, {
                        radius: mag * 2.5, // Scale radius by magnitude
                        fillColor: "#ba955c", // Mustard
                        color: "#2e3d58", // Navy
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.7
                    });
                },
                onEachFeature: function (feature, layer) {
                    const place = feature.properties.place;
                    const mag = feature.properties.mag;
                    const time = new Date(feature.properties.time).toLocaleString();

                    layer.bindPopup(`
                        <strong>Magnitude: ${mag}</strong><br>
                        Location: ${place}<br>
                        Time: ${time}
                    `);
                }
            }).addTo(map);
        })
        .catch(error => console.error('Error fetching USGS data:', error));
}

// 5. Execute Data Fetch Loop
fetchEarthquakes();
setInterval(fetchEarthquakes, 60000);