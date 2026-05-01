import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

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
        if (!mapRef.current || typeof globalThis.window === 'undefined') return;

        // Dynamically load Leaflet
        if (!window.L) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);

            const markerClusterCss = document.createElement('link');
            markerClusterCss.rel = 'stylesheet';
            markerClusterCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
            document.head.appendChild(markerClusterCss);

            const markerClusterDefaultCss = document.createElement('link');
            markerClusterDefaultCss.rel = 'stylesheet';
            markerClusterDefaultCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
            document.head.appendChild(markerClusterDefaultCss);

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => {
                const clusterScript = document.createElement('script');
                clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
                clusterScript.onload = () => initMap();
                document.head.appendChild(clusterScript);
            };
            document.head.appendChild(script);
        } else {
            initMap();
        }

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
        const map = L.map(mapRef.current).setView([22.5, 82], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(map);
        mapInstance.current = map;
        markersRef.current = L.markerClusterGroup();
        map.addLayer(markersRef.current);
        updateMarkers();
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

        clients.forEach(c => {
            if (c.latitude && c.longitude) {
                const marker = L.marker([c.latitude, c.longitude]);
                marker.bindTooltip(
                    `<strong>${c.name}</strong><br/>${c.service_type ? `Service: ${c.service_type}<br/>` : ''}${c.city ? c.city + ', ' : ''}${c.state || ''}`,
                    { direction: 'top' }
                );
                markersRef.current.addLayer(marker);
            }
        });
    }

    return (
        <div className="dashboard__section">
            <div className="dashboard__section-header">
                <h3>Client Distribution Map</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                        style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', background: 'var(--card-bg)' }}
                        value={filters.service_type}
                        onChange={(e) => setFilters(f => ({ ...f, service_type: e.target.value }))}
                    >
                        <option value="">All Services</option>
                        {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select
                        style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', background: 'var(--card-bg)' }}
                        value={filters.state}
                        onChange={(e) => setFilters(f => ({ ...f, state: e.target.value }))}
                    >
                        <option value="">All States</option>
                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
            <div style={{ position: 'relative', height: '420px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                {loading && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, background: 'rgba(255,255,255,0.8)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                        Loading...
                    </div>
                )}
                <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {clients.length} client{clients.length !== 1 ? 's' : ''} with coordinates
            </div>
        </div>
    );
}
