"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Navigation, Battery, Clock, Wifi, RefreshCw, Compass, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface LocationPing {
  lat: number;
  lng: number;
  accuracy?: number;
  batteryLevel?: number | null;
  timestamp: string | Date;
}

interface FreeOsmMapProps {
  logs: LocationPing[];
  isLive?: boolean;
  employeeName?: string;
  height?: string;
  onRefresh?: () => void;
}

export function FreeOsmMap({
  logs = [],
  isLive = false,
  employeeName = "Staff Member",
  height = "440px",
  onRefresh
}: FreeOsmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  const [isLeafletReady, setIsLeafletReady] = useState(false);

  // Sanitize and filter valid numeric lat/lng logs only
  const validLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs.filter((l) => {
      if (!l) return false;
      const lat = typeof l.lat === "number" ? l.lat : parseFloat(String(l.lat));
      const lng = typeof l.lng === "number" ? l.lng : parseFloat(String(l.lng));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    }).map((l) => ({
      ...l,
      lat: typeof l.lat === "number" ? l.lat : parseFloat(String(l.lat)),
      lng: typeof l.lng === "number" ? l.lng : parseFloat(String(l.lng))
    }));
  }, [logs]);

  // Load Leaflet CSS and JS dynamically from CDN if not already loaded
  useEffect(() => {
    if (typeof window === "undefined") return;

    const leafletCssId = "leaflet-css-cdn";
    if (!document.getElementById(leafletCssId)) {
      const link = document.createElement("link");
      link.id = leafletCssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    if ((window as any).L) {
      setIsLeafletReady(true);
      return;
    }

    const leafletScriptId = "leaflet-js-cdn";
    if (!document.getElementById(leafletScriptId)) {
      const script = document.createElement("script");
      script.id = leafletScriptId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.crossOrigin = "";
      script.onload = () => setIsLeafletReady(true);
      document.body.appendChild(script);
    } else {
      const existingScript = document.getElementById(leafletScriptId) as HTMLScriptElement;
      existingScript.addEventListener("load", () => setIsLeafletReady(true));
    }
  }, []);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!isLeafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const defaultCenter: [number, number] = validLogs.length > 0 
      ? [validLogs[validLogs.length - 1].lat, validLogs[validLogs.length - 1].lng]
      : [20.5937, 78.9629]; // Default India center

    // Initialize map instance once
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(defaultCenter, validLogs.length > 0 ? 15 : 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      markersGroupRef.current = L.featureGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (validLogs.length === 0) {
      map.setView(defaultCenter, 5);
      return;
    }

    // Coordinates path for polyline
    const latLngs = validLogs.map((l) => [l.lat, l.lng]);

    // 1. Draw smooth breadcrumb trail
    polylineRef.current = L.polyline(latLngs, {
      color: "#2563eb",
      weight: 4,
      opacity: 0.85,
      dashArray: "6, 6",
      smoothFactor: 1
    }).addTo(map);

    // 2. Add intermediate breadcrumb dots & markers
    validLogs.forEach((log, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === validLogs.length - 1;
      const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

      if (isFirst) {
        // Start Location Marker (Green)
        const startIcon = L.divIcon({
          className: "custom-osm-start-marker",
          html: `<div style="background-color: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">START</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        const startMarker = L.marker([log.lat, log.lng], { icon: startIcon }).addTo(markersGroup);
        startMarker.bindPopup(`<b>🟢 Start Location Point</b><br/>Time: ${timeStr}`);
      } else if (isLast) {
        // Current / Latest Location Marker (Pulsing Blue if live or Red if historic end)
        const liveHtml = isLive
          ? `<div style="position: relative; width: 34px; height: 34px;">
              <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: #3b82f6; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: absolute; top: 4px; left: 4px; background: #2563eb; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; border: 3px solid white; box-shadow: 0 4px 10px rgba(37,99,235,0.5);">📍</div>
            </div>`
          : `<div style="background-color: #ef4444; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">END</div>`;

        const endIcon = L.divIcon({
          className: "custom-osm-end-marker",
          html: liveHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        const endMarker = L.marker([log.lat, log.lng], { icon: endIcon }).addTo(markersGroup);
        endMarker.bindPopup(`<b>${isLive ? "📍 Live Location of " + employeeName : "🔴 Last Location Ping"}</b><br/>Time: ${timeStr}<br/>Battery: ${log.batteryLevel ?? "—"}%`);
      } else {
        // Intermediate path node dot
        const dotIcon = L.divIcon({
          className: "custom-osm-dot",
          html: `<div style="background-color: #3b82f6; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });
        const dotMarker = L.marker([log.lat, log.lng], { icon: dotIcon }).addTo(markersGroup);
        dotMarker.bindPopup(`<b>Trail Ping #${idx + 1}</b><br/>Time: ${timeStr}<br/>Battery: ${log.batteryLevel ?? "—"}%`);
      }
    });

    // Auto-fit bounds
    try {
      if (validLogs.length > 1) {
        map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40], maxZoom: 17 });
      } else if (validLogs.length === 1) {
        map.setView([validLogs[0].lat, validLogs[0].lng], 16);
      }
    } catch {
      map.setView(defaultCenter, 15);
    }
  }, [isLeafletReady, validLogs, isLive, employeeName]);

  const latestPing = validLogs.length > 0 ? validLogs[validLogs.length - 1] : null;

  return (
    <div className="space-y-3">
      {/* Map Legend / Nishan Label Guide */}
      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs shadow-md border border-slate-800">
        <div className="flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider text-slate-300">
          <Compass className="h-4 w-4 text-blue-400" />
          <span>Map Guide (Nishan ka Matlab):</span>
        </div>

        <div className="flex items-center gap-3.5 flex-wrap text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white/30 shrink-0"></span>
            <span className="text-slate-200">🟢 <strong>START</strong> (Din ka pehla point)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-1 ring-white/30 shrink-0"></span>
            <span className="text-slate-200">🔵 <strong>PINGS</strong> (Travel Route)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white/30 shrink-0"></span>
            <span className="text-slate-200">🔴 <strong>END</strong> (Last point)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-blue-600 ring-2 ring-blue-300 animate-ping shrink-0"></span>
            <span className="text-emerald-400 font-bold">📍 <strong>LIVE PIN</strong> (Staff Current)</span>
          </div>
        </div>

        <Badge variant="outline" className="text-blue-300 border-blue-800 bg-blue-950/60 text-[10px] font-bold">
          {validLogs.length} Pings Today
        </Badge>
      </div>

      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner group">
        {/* Top Floating Controls */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {isLive ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 px-3 py-1 shadow-md animate-pulse">
                <span className="h-2 w-2 rounded-full bg-white"></span>
                Live GPS Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-900/80 text-white backdrop-blur-md text-[11px] font-bold px-3 py-1 shadow-md">
                GPS History ({validLogs.length} Pings)
              </Badge>
            )}

            {latestPing && latestPing.batteryLevel !== undefined && latestPing.batteryLevel !== null && (
              <Badge className="bg-white/90 text-slate-800 backdrop-blur-md border border-slate-200 text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 shadow-sm">
                <Battery className="h-3 w-3 text-emerald-600" />
                {latestPing.batteryLevel}% Battery
              </Badge>
            )}
          </div>

          {onRefresh && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefresh}
              className="pointer-events-auto h-8 px-2.5 rounded-xl bg-white/90 text-slate-700 hover:bg-white backdrop-blur-md border border-slate-200 shadow-sm text-xs font-bold gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              Refresh Map
            </Button>
          )}
        </div>

        {/* Leaflet Map Div */}
        <div 
          ref={mapContainerRef} 
          style={{ height, width: "100%", zIndex: 1 }}
          className="w-full bg-slate-100"
        />

        {validLogs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-sm z-[999] p-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No GPS Location Logs for this Date</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              GPS trail will appear here automatically when employee checks in or turns on location.
            </p>
          </div>
        )}

        {/* Bottom Ping Status Bar */}
        {latestPing && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200/80 shadow-md flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>Last Ping Time: <strong className="text-slate-900">{latestPing.timestamp ? new Date(latestPing.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "—"}</strong></span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono font-bold">
              {Number(latestPing.lat).toFixed(5)}, {Number(latestPing.lng).toFixed(5)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
