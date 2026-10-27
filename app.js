// 1. Initialize the map (centered globally, zoom level 2)
const map = L.map('map').setView([20, 0], 2);

// 2. Add the OpenStreetMap base tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// 3. Define the USGS API URL (Earthquakes 2.5+ magnitude in the last 24 hours)
const usgsUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

// 4. Function to fetch and render data
function fetchEarthquakes() {
    fetch(usgsUrl)
        .then(response => response.json())
        .then(data => {
            // Clear existing markers before drawing new ones so they don't stack
            map.eachLayer((layer) => {
                // 'layer.feature' ensures we only delete earthquake data points,
                // preventing us from accidentally deleting the base map tiles!
                if (layer.feature) {
                    map.removeLayer(layer);
                }
            });

            // Add the new data
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    let mag = feature.properties.mag;
                    return L.circleMarker(latlng, {
                        radius: mag * 2.5, // Scale radius by magnitude
                        fillColor: "#ba955c", // Mustard
                        color: "#2e3d58", // Navy border
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

// 5. Fetch immediately on load
fetchEarthquakes();

// 6. Fetch again every 60 seconds
setInterval(fetchEarthquakes, 60000);