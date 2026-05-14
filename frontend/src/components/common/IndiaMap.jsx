import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import FilterDropdown from './FilterDropdown';

export default function IndiaMap() {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef(null);
    const [clients, setClients] = useState([]);
    const [filters, setFilters] = useState({ service_type: '', state: '' });
    const [loading, setLoading] = useState(true);

    // Get unique values for filters
    const serviceTypes = [...new Set(clients.map(c => c.service_type).filter(Boolean))];
    const states = [...new Set(clients.map(c => c.state).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    useEffect(() => {
        loadClients();
    }, [filters.service_type, filters.state]);

    async function loadClients() {
        setLoading(true);
        try {
            const params = {};
            if (filters.service_type) params.service_type = filters.service_type;
            if (filters.state) params.state = filters.state;
            const data = await api.getClientMapData(params);
            setClients(data);
        } catch {
            setClients([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!mapRef.current) return;

        function loadScripts(callback) {
            // Avoid duplicate script/link injection
            if (window.L && window.L.markerClusterGroup) {
                callback();
                return;
            }
            if (!document.querySelector('link[href*="leaflet@1.9.4"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);

                const mc1 = document.createElement('link');
                mc1.rel = 'stylesheet';
                mc1.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
                document.head.appendChild(mc1);

                const mc2 = document.createElement('link');
                mc2.rel = 'stylesheet';
                mc2.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
                document.head.appendChild(mc2);
            }

            if (!document.querySelector('script[src*="leaflet@1.9.4"]')) {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = () => {
                    if (!document.querySelector('script[src*="leaflet.markercluster"]')) {
                        const clusterScript = document.createElement('script');
                        clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
                        clusterScript.onload = () => callback();
                        document.head.appendChild(clusterScript);
                    } else {
                        const check = setInterval(() => {
                            if (window.L && window.L.markerClusterGroup) { clearInterval(check); callback(); }
                        }, 50);
                    }
                };
                document.head.appendChild(script);
            } else {
                // Scripts exist but may still be loading
                const check = setInterval(() => {
                    if (window.L && window.L.markerClusterGroup) { clearInterval(check); callback(); }
                }, 50);
            }
        }

        loadScripts(() => initMap());

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    function initMap() {
        if (mapInstance.current) return;
        const L = window.L;

        // India bounds - restrict view to India only
        const indiaBounds = L.latLngBounds(
            L.latLng(6.5, 68.0),   // SW corner
            L.latLng(37.5, 97.5)   // NE corner
        );

        const map = L.map(mapRef.current, {
            center: [22.5, 82],
            zoom: 5,
            minZoom: 4,
            maxZoom: 12,
            maxBounds: indiaBounds,
            maxBoundsViscosity: 1.0,
        });

        // Use CartoDB Voyager for a cleaner, modern look
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 12,
        }).addTo(map);

        mapInstance.current = map;
        markersRef.current = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
        });
        map.addLayer(markersRef.current);
        updateMarkers();

        // Force Leaflet to recalculate size (fixes tiles not loading when below fold)
        setTimeout(() => { map.invalidateSize(); }, 200);
    }

    useEffect(() => {
        if (mapInstance.current && markersRef.current) {
            updateMarkers();
        }
    }, [clients]);

    function updateMarkers() {
        if (!mapInstance.current || !markersRef.current || !window.L) return;
        const L = window.L;
        markersRef.current.clearLayers();

        // Custom marker icon
        const customIcon = L.divIcon({
            className: 'india-map-marker',
            html: '<div style="width:12px;height:12px;background:#3c2415;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
        });

        clients.forEach(c => {
            if (c.latitude && c.longitude) {
                const marker = L.marker([c.latitude, c.longitude], { icon: customIcon });
                marker.bindTooltip(
                    `<strong>${c.name}</strong><br/>${c.service_type ? `Service: ${c.service_type}<br/>` : ''}${c.city ? c.city + ', ' : ''}${c.state || ''}`,
                    { direction: 'top', className: 'india-map-tooltip' }
                );
                markersRef.current.addLayer(marker);
            }
        });
    }

    return (
        <div className="dashboard__section dashboard__map-section">
            <div className="dashboard__section-header">
                <h3>Client Distribution — India</h3>
                <div className="dashboard__map-filters">
                    <FilterDropdown
                        label="All Services"
                        options={serviceTypes}
                        value={filters.service_type}
                        onChange={(val) => setFilters(f => ({ ...f, service_type: val }))}
                    />
                    <FilterDropdown
                        label="All States"
                        options={states}
                        value={filters.state}
                        onChange={(val) => setFilters(f => ({ ...f, state: val }))}
                    />
                </div>
            </div>
            <div className="dashboard__map-container">
                {loading && (
                    <div className="dashboard__map-loading">Loading map...</div>
                )}
                <div ref={mapRef} className="dashboard__map-canvas" />
            </div>
            <div className="dashboard__map-footer">
                <span className="dashboard__map-dot" />
                {clients.length} client{clients.length !== 1 ? 's' : ''} mapped
            </div>
        </div>
    );
}
