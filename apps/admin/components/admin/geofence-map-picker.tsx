"use client";

import { useEffect, useRef, useState } from "react";
import { Wrapper } from "@googlemaps/react-wrapper";
import { MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type LatLng = {
  lat: number;
  lng: number;
};

interface GeoFenceMapPickerProps {
  lat: string;
  lng: string;
  radius: string;
  onUpdate: (lat: number, lng: number, radius: number) => void;
}

function MapCanvas({
  center,
  radius,
  onUpdate,
  searchText,
  setSearchText
}: {
  center: LatLng;
  radius: number;
  onUpdate: (lat: number, lng: number, radius: number) => void;
  searchText: string;
  setSearchText: (text: string) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  const [localLat, setLocalLat] = useState(center.lat);
  const [localLng, setLocalLng] = useState(center.lng);

  // Sync internal position state if parent center changes significantly
  useEffect(() => {
    if (Math.abs(center.lat - localLat) > 0.0001 || Math.abs(center.lng - localLng) > 0.0001) {
      setLocalLat(center.lat);
      setLocalLng(center.lng);
      if (mapRef.current) {
        mapRef.current.setCenter(center);
      }
      if (markerRef.current) {
        markerRef.current.setPosition(center);
      }
      if (circleRef.current) {
        circleRef.current.setCenter(center);
      }
    }
  }, [center]);

  // Update circle radius dynamically
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  // Setup Google Maps, Autocomplete, Marker, and Circle
  useEffect(() => {
    const google = (window as any).google;
    if (!mapDivRef.current || !google) return;

    const initialPos = { lat: localLat, lng: localLng };

    // 1. Initialize Map
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapDivRef.current, {
        center: initialPos,
        zoom: 14,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: false,
        zoomControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT
        }
      });
    }

    const map = mapRef.current;

    // 2. Initialize Marker
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position: initialPos,
        map: map,
        draggable: true,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: "#2563eb", // Website Theme Blue
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 1.8,
          anchor: new google.maps.Point(12, 22)
        }
      });
    }

    const marker = markerRef.current;

    // 3. Initialize Circle (Geofence Overlay)
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map: map,
        center: initialPos,
        radius: radius,
        fillColor: "#3b82f6", // Light Blue fill
        fillOpacity: 0.15,
        strokeColor: "#2563eb", // Blue border
        strokeOpacity: 0.8,
        strokeWeight: 2
      });
    }

    const circle = circleRef.current;

    // Helper: Geocode coords to get address
    const reverseGeocode = (latVal: number, lngVal: number) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: latVal, lng: lngVal } }, (results: any, status: any) => {
        if (status === "OK" && results && results[0]) {
          setSearchText(results[0].formatted_address);
        }
      });
    };

    // 4. Initialize Autocomplete Search
    if (inputRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode", "establishment"]
      });
      autocompleteRef.current.bindTo("bounds", map);

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry || !place.geometry.location) return;

        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();

        setLocalLat(newLat);
        setLocalLng(newLng);
        map.setCenter({ lat: newLat, lng: newLng });
        map.setZoom(16);
        marker.setPosition({ lat: newLat, lng: newLng });
        circle.setCenter({ lat: newLat, lng: newLng });
        
        if (place.formatted_address) {
          setSearchText(place.formatted_address);
        }
        onUpdate(newLat, newLng, radius);
      });
    }

    // 5. Marker Drag End Listener
    const dragListener = marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        const newLat = pos.lat();
        const newLng = pos.lng();
        setLocalLat(newLat);
        setLocalLng(newLng);
        circle.setCenter({ lat: newLat, lng: newLng });
        onUpdate(newLat, newLng, radius);
        reverseGeocode(newLat, newLng);
      }
    });

    // 6. Map Click Listener
    const clickListener = map.addListener("click", (e: any) => {
      const pos = e.latLng;
      if (pos) {
        const newLat = pos.lat();
        const newLng = pos.lng();
        setLocalLat(newLat);
        setLocalLng(newLng);
        marker.setPosition({ lat: newLat, lng: newLng });
        circle.setCenter({ lat: newLat, lng: newLng });
        onUpdate(newLat, newLng, radius);
        reverseGeocode(newLat, newLng);
      }
    });

    return () => {
      google.maps.event.removeListener(dragListener);
      google.maps.event.removeListener(clickListener);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Search location input */}
      <div className="space-y-1.5">
        <Label className="text-[9px] font-black uppercase text-slate-400">Location</Label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            ref={inputRef}
            placeholder="Search for a location or address"
            className="h-11 pl-11 pr-10 rounded-xl bg-slate-50 border-none font-medium focus:bg-white text-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Map display */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 shadow-inner h-[280px]">
        <div ref={mapDivRef} className="h-full w-full" />
        
        {/* Buttons overlay on Map */}
        <div className="absolute bottom-4 left-4 z-10 flex gap-2">
          <Button
            type="button"
            className="bg-white border border-blue-600 text-blue-600 hover:bg-blue-50/50 shadow-md rounded-xl font-bold h-10 px-4 text-xs"
            onClick={() => onUpdate(localLat, localLng, radius)}
          >
            Set Location
          </Button>
          <Button
            type="button"
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-md rounded-xl font-bold h-10 px-4 text-xs flex items-center gap-1.5"
            onClick={() => {
              window.open(`https://www.google.com/maps/search/?api=1&query=${localLat},${localLng}`, "_blank");
            }}
          >
            <MapPin className="h-3.5 w-3.5 text-blue-600" /> Open in Maps
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GeoFenceMapPicker({ lat, lng, radius, onUpdate }: GeoFenceMapPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const numericLat = parseFloat(lat) || 21.1938; // Default Bhilai/Durg
  const numericLng = parseFloat(lng) || 81.3509;
  const numericRadius = parseInt(radius) || 500;

  const [sliderVal, setSliderVal] = useState(numericRadius);
  const [rangeInput, setRangeInput] = useState(`${numericRadius}m`);
  const [searchText, setSearchText] = useState("");

  // Sync inputs with incoming changes
  useEffect(() => {
    const r = parseInt(radius) || 500;
    setSliderVal(r);
    setRangeInput(`${r}m`);
  }, [radius]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 100;
    setSliderVal(val);
    setRangeInput(`${val}m`);
    onUpdate(numericLat, numericLng, val);
  };

  const handleRangeTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setRangeInput(rawVal);
    const parsed = parseInt(rawVal.replace(/[^0-9]/g, ""));
    if (!isNaN(parsed)) {
      const clamped = Math.max(100, Math.min(3000, parsed));
      setSliderVal(clamped);
      onUpdate(numericLat, numericLng, clamped);
    }
  };

  const handleRangeTextBlur = () => {
    setRangeInput(`${sliderVal}m`);
  };

  if (!apiKey || apiKey === "your-google-maps-api-key") {
    return (
      <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
        <p className="text-xs font-semibold text-slate-500">
          Google Maps API key is currently a placeholder. Please configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/admin/.env` to load the interactive geofence map.
        </p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="space-y-1">
            <Label className="text-[9px] font-black uppercase text-slate-400">Lat</Label>
            <Input
              type="number"
              step="any"
              className="h-10 bg-white border-slate-200 text-xs font-semibold rounded-xl"
              value={lat}
              onChange={(e) => onUpdate(parseFloat(e.target.value) || 0, numericLng, numericRadius)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] font-black uppercase text-slate-400">Lng</Label>
            <Input
              type="number"
              step="any"
              className="h-10 bg-white border-slate-200 text-xs font-semibold rounded-xl"
              value={lng}
              onChange={(e) => onUpdate(numericLat, parseFloat(e.target.value) || 0, numericRadius)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] font-black uppercase text-slate-400">Radius</Label>
            <Input
              type="number"
              className="h-10 bg-white border-slate-200 text-xs font-semibold rounded-xl"
              value={radius}
              onChange={(e) => onUpdate(numericLat, numericLng, parseInt(e.target.value) || 100)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50 bg-white font-bold text-xs rounded-xl h-10 px-4 flex items-center gap-2 shadow-sm transition-all hover:scale-[1.01]"
            onClick={() => {
              window.open(`https://www.google.com/maps/search/?api=1&query=${lat || 21.1938},${lng || 81.3509}`, "_blank");
            }}
          >
            <MapPin className="h-4 w-4 text-blue-600" /> Open in Google Maps
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 bg-white border border-slate-100 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-300">
      
      {/* Slider Controls */}
      <div className="space-y-2">
        <Label className="text-[9px] font-black uppercase text-slate-400">Select Range (Meters)</Label>
        <div className="flex items-center gap-4">
          <Input
            className="w-20 h-10 border border-slate-200 rounded-xl text-center text-xs font-black bg-slate-50 focus:bg-white text-slate-700"
            value={rangeInput}
            onChange={handleRangeTextChange}
            onBlur={handleRangeTextBlur}
          />
          <div className="flex-1 flex items-center gap-2 relative">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">100m</span>
            <input
              type="range"
              min="100"
              max="3000"
              step="50"
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={sliderVal}
              onChange={handleSliderChange}
            />
            <span className="text-[10px] font-bold text-slate-400 shrink-0">3000m</span>
          </div>
        </div>
      </div>

      {/* Google Map Loader */}
      <Wrapper apiKey={apiKey} libraries={["places"]}>
        <MapCanvas
          center={{ lat: numericLat, lng: numericLng }}
          radius={sliderVal}
          onUpdate={onUpdate}
          searchText={searchText}
          setSearchText={setSearchText}
        />
      </Wrapper>
    </div>
  );
}
