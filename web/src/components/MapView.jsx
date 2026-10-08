import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function makeIcon(color, size = 15, isUserLocation = false) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #ffffff;box-shadow:${isUserLocation ? '0 0 0 5px rgba(37,99,235,.2), ' : ''}0 2px 10px rgba(0,0,0,0.35);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Thin React wrapper around Leaflet. Markers are fully managed; onBoundsChange
 * emits the visible bounding box (debounced) so feeds can stay map-synced.
 */
export default function MapView({
  markers = [],
  center,
  zoom = 13,
  onBoundsChange,
  onMapClick,
  fitToMarkers = false,
  followCenter = false,
  className = '',
  scrollWheelZoom = true,
}) {
  const centerLat = center?.[0];
  const centerLng = center?.[1];
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const boundsCbRef = useRef(onBoundsChange);
  const clickCbRef = useRef(onMapClick);

  useEffect(() => {
    boundsCbRef.current = onBoundsChange;
    clickCbRef.current = onMapClick;
  }, [onBoundsChange, onMapClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom,
    });
    map.setView(center || [20.5937, 78.9629], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on('click', (e) => clickCbRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));

    let timer;
    map.on('moveend', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const b = map.getBounds();
        boundsCbRef.current?.({
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        });
      }, 350);
    });

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!layerRef.current) return;
    const layer = layerRef.current;
    layer.clearLayers();
    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: makeIcon(m.color, m.size, m.isUserLocation) });
      if (m.title) marker.bindTooltip(m.title, { direction: 'top', offset: [0, -8] });
      if (m.onClick) marker.on('click', () => m.onClick(m));
      marker.addTo(layer);
    });
  }, [markers]);

  useEffect(() => {
    if (!mapRef.current || !fitToMarkers || markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToMarkers, markers.length]);

  useEffect(() => {
    if (mapRef.current && followCenter && centerLat != null && centerLng != null) {
      mapRef.current.setView([centerLat, centerLng], Math.max(mapRef.current.getZoom(), 15), { animate: true });
    }
  }, [centerLat, centerLng, followCenter]);

  return <div ref={containerRef} className={className} />;
}
