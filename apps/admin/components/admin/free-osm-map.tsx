"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { 
  MapPin, 
  Navigation, 
  Battery, 
  Clock, 
  RefreshCw, 
  Compass, 
  Layers, 
  Globe,
  Crosshair
} from "lucide-react";
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
  height = "460px",
  onRefresh
}: FreeOsmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);
  const prevLogsCountRef = useRef<number>(0);

  const [isLeafletReady, setIsLeafletReady] = useState(false);
  const [mapLayerType, setMapLayerType] = useState<"satellite" | "streets">("satellite");

  // Sanitize and sort chronologically strictly from morning/start (0) to latest ping (last)
  const chronoLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs
      .filter((l) => {
        if (!l) return false;
        const lat = typeof l.lat === "number" ? l.lat : parseFloat(String(l.lat));
        const lng = typeof l.lng === "number" ? l.lng : parseFloat(String(l.lng));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .map((l) => ({
        ...l,
        lat: typeof l.lat === "number" ? l.lat : parseFloat(String(l.lat)),
        lng: typeof l.lng === "number" ? l.lng : parseFloat(String(l.lng))
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
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
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "";
      script.onload = () => setIsLeafletReady(true);
      document.body.appendChild(script);
    } else {
      const existingScript = document.getElementById(leafletScriptId) as HTMLScriptElement;
      existingScript.addEventListener("load", () => setIsLeafletReady(true));
    }
  }, []);

  // Handle Map Tile Layer Switch (Streets vs Satellite)
  useEffect(() => {
    if (!isLeafletReady || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstanceRef.current;

    // Remove old base layer
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    if (mapLayerType === "satellite") {
      // 🛰️ High-Resolution ESRI World Satellite Imagery (100% Free)
      tileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Tiles &copy; Esri"
        }
      ).addTo(map);

      // CartoDB Reference Labels Overlay for Roads & Cities
      labelsLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
          opacity: 0.9
        }
      ).addTo(map);
    } else {
      // 🗺️ Standard OpenStreetMap Streets
      tileLayerRef.current = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors"
        }
      ).addTo(map);
    }
  }, [isLeafletReady, mapLayerType]);

  // Initialize and update Leaflet Map & Trails
  useEffect(() => {
    if (!isLeafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const defaultCenter: [number, number] = chronoLogs.length > 0 
      ? [chronoLogs[chronoLogs.length - 1].lat, chronoLogs[chronoLogs.length - 1].lng]
      : [20.5937, 78.9629]; // Default India center

    // Initialize map instance once
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(defaultCenter, chronoLogs.length > 0 ? 15 : 5);

      // Initial Satellite Layer
      tileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      ).addTo(map);

      labelsLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19, opacity: 0.9 }
      ).addTo(map);

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

    if (chronoLogs.length === 0) {
      map.setView(defaultCenter, 5);
      hasFittedBoundsRef.current = false;
      return;
    }

    // Coordinates path for polyline in exact chronological order
    const latLngs = chronoLogs.map((l) => [l.lat, l.lng]);

    // 1. Draw solid bright glowing travel route path (No confusing dashed lines)
    polylineRef.current = L.polyline(latLngs, {
      color: mapLayerType === "satellite" ? "#38bdf8" : "#2563eb", // Glowing cyan on satellite, deep blue on streets
      weight: 4.5,
      opacity: 0.9,
      smoothFactor: 1
    }).addTo(map);

    // 2. Add intermediate breadcrumb dots & markers
    chronoLogs.forEach((log, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === chronoLogs.length - 1;
      const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "—";

      if (isFirst) {
        // Start Location Marker (Green)
        const startIcon = L.divIcon({
          className: "custom-osm-start-marker",
          html: `<div style="background-color: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">START</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        const startMarker = L.marker([log.lat, log.lng], { icon: startIcon }).addTo(markersGroup);
        startMarker.bindPopup(`<b>🟢 Start Location Point</b><br/>Time: ${timeStr}`);
      } else if (isLast) {
        // Current / Latest Location Marker (Pulsing Cyan/Blue Pin)
        const liveHtml = isLive
          ? `<div style="position: relative; width: 36px; height: 36px;">
              <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: #38bdf8; opacity: 0.6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: absolute; top: 4px; left: 4px; background: #0284c7; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; border: 3px solid white; box-shadow: 0 4px 12px rgba(2,132,199,0.7);">📍</div>
            </div>`
          : `<div style="background-color: #ef4444; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">END</div>`;

        const endIcon = L.divIcon({
          className: "custom-osm-end-marker",
          html: liveHtml,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        const endMarker = L.marker([log.lat, log.lng], { icon: endIcon }).addTo(markersGroup);
        endMarker.bindPopup(`<b>${isLive ? "📍 Live Location of " + employeeName : "🔴 Last Location Ping"}</b><br/>Time: ${timeStr}<br/>Battery: ${log.batteryLevel ?? "—"}%`);
      } else {
        // Intermediate path node dot
        const dotIcon = L.divIcon({
          className: "custom-osm-dot",
          html: `<div style="background-color: ${mapLayerType === "satellite" ? "#38bdf8" : "#2563eb"}; width: 9px; height: 9px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.5);"></div>`,
          iconSize: [9, 9],
          iconAnchor: [4.5, 4.5]
        });
        const dotMarker = L.marker([log.lat, log.lng], { icon: dotIcon }).addTo(markersGroup);
        dotMarker.bindPopup(`<b>Trail Ping #${idx + 1}</b><br/>Time: ${timeStr}<br/>Battery: ${log.batteryLevel ?? "—"}%`);
      }
    });

    // Fit bounds ONLY ON INITIAL LOAD — Do NOT zoom out on new pings!
    if (!hasFittedBoundsRef.current && chronoLogs.length > 0) {
      try {
        if (chronoLogs.length > 1) {
          map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40], maxZoom: 17 });
        } else {
          map.setView([chronoLogs[0].lat, chronoLogs[0].lng], 16);
        }
        hasFittedBoundsRef.current = true;
      } catch {
        map.setView(defaultCenter, 15);
      }
    } else if (isLive && chronoLogs.length > prevLogsCountRef.current) {
      // Smoothly pan to the new live location without resetting zoom level!
      const latest = chronoLogs[chronoLogs.length - 1];
      map.panTo([latest.lat, latest.lng], { animate: true, duration: 0.8 });
    }

    prevLogsCountRef.current = chronoLogs.length;
  }, [isLeafletReady, chronoLogs, isLive, employeeName, mapLayerType]);

  const latestPing = chronoLogs.length > 0 ? chronoLogs[chronoLogs.length - 1] : null;

  const handleCenterLive = () => {
    if (!mapInstanceRef.current || !latestPing) return;
    mapInstanceRef.current.setView([latestPing.lat, latestPing.lng], 17, { animate: true });
  };

  const handleFitAllRoute = () => {
    if (!mapInstanceRef.current || !polylineRef.current || chronoLogs.length === 0) return;
    mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40], maxZoom: 17 });
  };

  return (
    <div className="space-y-3">
      {/* Map Legend / Nishan Label Guide */}
      <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs shadow-md border border-slate-800">
        <div className="flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider text-slate-300">
          <Compass className="h-4 w-4 text-sky-400" />
          <span>Map Guide (Nishan ka Matlab):</span>
        </div>

        <div className="flex items-center gap-3.5 flex-wrap text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white/30 shrink-0"></span>
            <span className="text-slate-200">🟢 <strong>START</strong> (Subah ka pehla point)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full bg-sky-400 shrink-0"></span>
            <span className="text-slate-200">🛣️ <strong>Solid Line</strong> (Safar ka Rasta)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400 ring-1 ring-white/30 shrink-0"></span>
            <span className="text-slate-200">🔵 <strong>PINGS</strong> (Route Points)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white/30 shrink-0"></span>
            <span className="text-slate-200">🔴 <strong>END</strong> (Last recorded point)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sky-500 ring-2 ring-sky-300 animate-ping shrink-0"></span>
            <span className="text-emerald-400 font-bold">📍 <strong>LIVE PIN</strong> (Staff Current)</span>
          </div>
        </div>

        <Badge variant="outline" className="text-sky-300 border-sky-800 bg-sky-950/60 text-[10px] font-bold">
          {chronoLogs.length} Pings Today
        </Badge>
      </div>

      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner group">
        {/* Top Floating Controls */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {isLive ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 px-3 py-1 shadow-md animate-pulse">
                <span className="h-2 w-2 rounded-full bg-white"></span>
                Live GPS Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-900/90 text-white backdrop-blur-md text-[11px] font-bold px-3 py-1 shadow-md">
                GPS History ({chronoLogs.length} Pings)
              </Badge>
            )}

            {latestPing && latestPing.batteryLevel !== undefined && latestPing.batteryLevel !== null && (
              <Badge className="bg-white/90 text-slate-800 backdrop-blur-md border border-slate-200 text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 shadow-sm">
                <Battery className="h-3 w-3 text-emerald-600" />
                {latestPing.batteryLevel}% Battery
              </Badge>
            )}
          </div>

          {/* Top Right: Satellite / Street Layer Switcher, Center Live & Refresh */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {latestPing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCenterLive}
                className="h-8 px-2.5 rounded-xl bg-slate-900/80 text-sky-300 hover:text-white hover:bg-slate-800 backdrop-blur-md border border-white/20 shadow-md text-xs font-bold gap-1"
                title="Focus on Live Staff Location"
              >
                <Crosshair className="h-3.5 w-3.5 text-sky-400" />
                Live Pin
              </Button>
            )}

            <div className="bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-md flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMapLayerType("satellite")}
                className={`h-7 px-2.5 rounded-lg text-xs font-black transition-all ${
                  mapLayerType === "satellite"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Globe className="h-3 w-3 mr-1" />
                🛰️ Satellite
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMapLayerType("streets")}
                className={`h-7 px-2.5 rounded-lg text-xs font-black transition-all ${
                  mapLayerType === "streets"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Layers className="h-3 w-3 mr-1" />
                🗺️ Streets
              </Button>
            </div>

            {onRefresh && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRefresh}
                className="h-8 px-2.5 rounded-xl bg-white/90 text-slate-700 hover:bg-white backdrop-blur-md border border-slate-200 shadow-sm text-xs font-bold gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Leaflet Map Div */}
        <div 
          ref={mapContainerRef} 
          style={{ height, width: "100%", zIndex: 1 }}
          className="w-full bg-slate-900"
        />

        {chronoLogs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm z-[999] p-6 text-center text-white">
            <div className="h-12 w-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-3 shadow-inner">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-200">No GPS Location Logs for this Date</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              GPS trail will appear here automatically when employee checks in or turns on location.
            </p>
          </div>
        )}

        {/* Bottom Ping Status Bar (Shows Latest Ping) */}
        {latestPing && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-slate-900/95 text-white backdrop-blur-md p-2.5 rounded-xl border border-slate-700/80 shadow-md flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              <span>Latest Live Ping: <strong className="text-sky-300 font-bold">{latestPing.timestamp ? new Date(latestPing.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "—"}</strong></span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono font-bold">
              {Number(latestPing.lat).toFixed(5)}, {Number(latestPing.lng).toFixed(5)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
