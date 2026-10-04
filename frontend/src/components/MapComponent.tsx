import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Pharmacy } from "../services/api";

interface MapComponentProps {
  pharmacies: Pharmacy[];
  userLocation?: [number, number];
  center?: [number, number];
  zoom?: number;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  pharmacies,
  userLocation,
  center = [9.9252, 78.1198], // Default to Madurai center
  zoom = 13,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create map instance
    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(center, zoom);

    // Add Google Maps Street TileLayer (Direct tile integration)
    L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      attribution: '&copy; Google Maps',
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(mapRef.current);

    // Create LayerGroup for markers
    markersGroupRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Markers when pharmacies or userLocation change
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current) return;
    const markersGroup = markersGroupRef.current;
    const map = mapRef.current;

    // Clear previous markers
    markersGroup.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    // 1. Add User Location Marker
    if (userLocation) {
      bounds.push(userLocation);
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            <div class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-indigo-400 opacity-75"></div>
            <div class="relative rounded-full h-4.5 w-4.5 bg-indigo-600 border-2 border-white shadow-lg"></div>
          </div>
        `,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker(userLocation, { icon: userIcon })
        .bindPopup("<div class='font-bold text-xs text-slate-800'>Your Current Location</div>")
        .addTo(markersGroup);
    }

    // 2. Add Pharmacy Markers
    pharmacies.forEach((pharm) => {
      const latLng: L.LatLngTuple = [pharm.latitude, pharm.longitude];
      bounds.push(latLng);

      const isAvail = pharm.availability === "Available" || pharm.stock_quantity > 0;
      const colorClass = isAvail ? "bg-primary-500" : "bg-rose-500";
      const pingClass = isAvail ? "bg-primary-400" : "bg-rose-400";

      const pharmIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center group">
            <div class="absolute inline-flex h-6 w-6 rounded-full ${pingClass} opacity-30 animate-pulse"></div>
            <div class="relative rounded-full h-5.5 w-5.5 ${colorClass} border-2 border-white shadow-md flex items-center justify-center text-[10px] text-white font-extrabold transition-all duration-200 hover:scale-110">
              ${pharm.rank || ""}
            </div>
          </div>
        `,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const popupContent = `
        <div class="p-1 min-w-[150px]">
          <div class="font-bold text-sm text-slate-800 mb-0.5">${pharm.pharmacy_name}</div>
          <div class="text-slate-500 text-[10px] mb-1.5">${pharm.address || ""}</div>
          <div class="flex justify-between items-center text-xs mb-1">
            <span class="text-slate-600">${pharm.distance} km</span>
            <span class="font-bold text-primary-600 text-sm">₹${pharm.price}</span>
          </div>
          <div class="flex items-center justify-between gap-2 mt-1 border-b border-slate-100 pb-2">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${
              isAvail
                ? "bg-teal-50 text-teal-700 border border-teal-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }">
              ${pharm.availability}
            </span>
            ${pharm.stock_quantity !== undefined ? `<span class="text-[9px] text-slate-400">Qty: ${pharm.stock_quantity}</span>` : ""}
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&origin=${userLocation ? `${userLocation[0]},${userLocation[1]}` : ''}&destination=${pharm.latitude},${pharm.longitude}" target="_blank" rel="noopener noreferrer" class="mt-2 block text-center bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-[10px] py-1.5 rounded-lg transition-colors shadow-sm decoration-none">
            Get Directions (Google Maps)
          </a>
        </div>
      `;

      L.marker(latLng, { icon: pharmIcon })
        .bindPopup(popupContent)
        .addTo(markersGroup);
    });

    // 3. Fit bounds if we have points
    if (bounds.length > 0) {
      // If only one point (e.g. only user), set map center directly
      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 15,
        });
      }
    }
  }, [pharmacies, userLocation]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="w-full h-full min-h-[350px] z-10" />
    </div>
  );
};
export default MapComponent;
