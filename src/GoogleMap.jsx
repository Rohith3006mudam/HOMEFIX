import React, { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 };
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let mapsLoadPromise;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve();
  if (!MAPS_API_KEY) {
    return Promise.reject(new Error('Add VITE_GOOGLE_MAPS_API_KEY to .env and reload.'));
  }
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps could not be loaded. Check VITE_GOOGLE_MAPS_API_KEY.'));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
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
        await loadGoogleMaps();
        const { Map } = await window.google.maps.importLibrary('maps');
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
    if (!mapRef.current || !window.google?.maps) return;
    const p = center || pickup;
    if (p) mapRef.current.panTo(p);
  }, [center, pickup]);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      if (!mapRef.current || !pickup || !destination || !window.google?.maps) return;
      try {
        const { Route } = await window.google.maps.importLibrary('routes');
        const result = await Route.computeRoutes({
          origin: pickup,
          destination,
          travelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });
        if (cancelled || !result?.routes?.[0]) return;
        const route = result.routes[0];
        if (routeRef.current) routeRef.current.setMap(null);
        const { Polyline } = await window.google.maps.importLibrary('maps');
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
    if (!mapRef.current || !window.google?.maps) return;
    const update = async () => {
      const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');
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
    update();
  }, [pickup, destination, driver]);

  if (error) {
    return <div className="map-error"><strong>Google Maps setup needed</strong><span>{error}</span></div>;
  }
  return <div ref={ref} className="google-map" aria-label="Google map" />;
}
