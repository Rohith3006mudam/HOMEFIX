import React, { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 };
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

if (MAPS_API_KEY) setOptions({ key: MAPS_API_KEY, v: 'weekly' });

async function loadLibrary(name) {
  if (!MAPS_API_KEY) throw new Error('Maps configuration required. Add VITE_GOOGLE_MAPS_API_KEY and reload.');
  return importLibrary(name);
}

export default function GoogleMap({
  center,
  pickup,
  destination,
  driver,
  travelMode = 'DRIVING',
  onMapReady,
}) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { Map } = await loadLibrary('maps');
        if (cancelled || !ref.current) return;
        mapRef.current = new Map(ref.current, {
          center: center || pickup || DEFAULT_CENTER,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: true,
        });
        onMapReady?.(mapRef.current);
      } catch (e) {
        setError(e.message || 'Unable to load Google Maps.');
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const p = center || pickup;
    if (p) mapRef.current.panTo(p);
  }, [center, pickup]);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      if (!mapRef.current || !pickup || !destination) return;
      try {
        const { Route } = await loadLibrary('routes');
        const result = await Route.computeRoutes({
          origin: pickup,
          destination,
          travelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });
        if (cancelled || !result?.routes?.[0]) return;
        const route = result.routes[0];
        if (routeRef.current) routeRef.current.setMap(null);
        const { Polyline } = await loadLibrary('maps');
        routeRef.current = new Polyline({
          path: route.path,
          strokeColor: '#111827',
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map: mapRef.current,
        });
        if (route.viewport) mapRef.current.fitBounds(route.viewport, 70);
      } catch (e) {
        console.warn('Route calculation failed:', e);
      }
    };
    draw();
    return () => { cancelled = true; };
  }, [pickup, destination, travelMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    const update = async () => {
      const { AdvancedMarkerElement } = await loadLibrary('marker');
      const entries = [
        ['pickup', pickup, 'P'],
        ['destination', destination, 'D'],
        ['driver', driver, '●'],
      ];
      for (const [key, position, label] of entries) {
        if (!position) {
          if (markersRef.current[key]) markersRef.current[key].map = null;
          continue;
        }
        let marker = markersRef.current[key];
        if (!marker) {
          const pin = document.createElement('div');
          pin.style.width = key === 'driver' ? '38px' : '34px';
          pin.style.height = key === 'driver' ? '38px' : '34px';
          pin.style.borderRadius = '50%';
          pin.style.display = 'grid';
          pin.style.placeItems = 'center';
          pin.style.background = key === 'destination' ? '#111827' : '#ffffff';
          pin.style.border = '3px solid #111827';
          pin.style.boxShadow = '0 5px 18px rgba(0,0,0,.22)';
          pin.style.fontWeight = '800';
          pin.textContent = label;
          marker = new AdvancedMarkerElement({ map: mapRef.current, content: pin, position });
          markersRef.current[key] = marker;
        } else {
          marker.position = position;
          marker.map = mapRef.current;
        }
      }
    };
    update().catch((e) => setError(e.message || 'Map temporarily unavailable. Please try again.'));
  }, [pickup, destination, driver]);

  if (error) {
    return <div className="map-error"><strong>Map temporarily unavailable</strong><span>{error}</span></div>;
  }
  return <div ref={ref} className="google-map" aria-label="Google map" />;
}
