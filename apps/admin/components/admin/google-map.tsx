"use client";

import { useEffect, useRef } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import type { LocationLog } from "@/lib/types";

type LatLng = {
  lat: number;
  lng: number;
};

function MapCanvas({
  center,
  path,
  markerPosition,
  clickable,
  onMapClick
}: {
  center: LatLng;
  path: LatLng[];
  markerPosition?: LatLng;
  clickable?: boolean;
  onMapClick?: (position: LatLng) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const googleMaps = (window as Window & { google?: any }).google;

    if (!ref.current || !googleMaps) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new googleMaps.maps.Map(ref.current, {
        center,
        zoom: 13,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false
      });
    }

    mapRef.current.setCenter(center);

    if (!polylineRef.current) {
      polylineRef.current = new googleMaps.maps.Polyline({
        map: mapRef.current,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 3
      });
    }

    polylineRef.current.setPath(path);

    if (markerPosition) {
      if (!markerRef.current) {
        markerRef.current = new googleMaps.maps.Marker({
          map: mapRef.current,
          icon: {
            path: googleMaps.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2
          }
        });
      }

      markerRef.current.setPosition(markerPosition);
    }

    if (clickable && onMapClick) {
      const listener = mapRef.current.addListener("click", (event: any) => {
        const lat = event.latLng?.lat?.();
        const lng = event.latLng?.lng?.();

        if (typeof lat === "number" && typeof lng === "number") {
          onMapClick({ lat, lng });
        }
      });

      return () => {
        googleMaps.maps.event.removeListener(listener);
      };
    }
  }, [center, clickable, markerPosition, onMapClick, path]);

  return <div ref={ref} className="h-full w-full" />;
}

export function LocationMap({
  logs,
  height = 360
}: {
  logs: LocationLog[];
  height?: number;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  const points = logs.map((item) => ({ lat: item.lat, lng: item.lng }));
  const center = points.at(-1) ?? { lat: 20.5937, lng: 78.9629 };

  if (!apiKey) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed bg-slate-50 text-sm text-slate-500"
        style={{ height }}
      >
        Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` or `GOOGLE_MAPS_API_KEY` to render the live map.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border" style={{ height }}>
      <Wrapper apiKey={apiKey} render={(status) => <div className="p-4 text-sm text-slate-500">{status}</div>}>
        <MapCanvas center={center} path={points} markerPosition={points.at(-1)} />
      </Wrapper>
    </div>
  );
}

export function ClickableLocationMap({
  selected,
  onSelect
}: {
  selected?: LatLng;
  onSelect: (value: LatLng) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  const center = selected ?? { lat: 20.5937, lng: 78.9629 };

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-slate-500">
        Google Maps is optional here. Provide the API key to enable click-to-pin, or submit without coordinates.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border" style={{ height: 280 }}>
      <Wrapper apiKey={apiKey} render={(status) => <div className="p-4 text-sm text-slate-500">{status}</div>}>
        <MapCanvas center={center} path={selected ? [selected] : []} markerPosition={selected} clickable onMapClick={onSelect} />
      </Wrapper>
    </div>
  );
}
