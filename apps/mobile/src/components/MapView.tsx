import { StyleSheet, View } from "react-native";
import NativeMapView, { Marker, Polyline } from "react-native-maps";
import { Text } from "react-native-paper";

import type { LatLng } from "../api";

type DayTrackMapViewProps = {
  height?: number;
  markers?: LatLng[];
  path?: LatLng[];
};

export function DayTrackMapView({ height = 220, markers = [], path = [] }: DayTrackMapViewProps) {
  const firstPoint = markers[0] ?? path[0];

  if (!firstPoint) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text>No map location available</Text>
      </View>
    );
  }

  const region = {
    latitude: firstPoint.lat,
    longitude: firstPoint.lng,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04
  };

  return (
    <NativeMapView initialRegion={region} style={[styles.map, { height }]}>
      {markers.map((marker, index) => (
        <Marker
          coordinate={{ latitude: marker.lat, longitude: marker.lng }}
          key={`${marker.lat}-${marker.lng}-${index}`}
        />
      ))}
      {path.length > 1 ? (
        <Polyline
          coordinates={path.map((point) => ({ latitude: point.lat, longitude: point.lng }))}
          strokeColor="#1A202C"
          strokeWidth={4}
        />
      ) : null}
    </NativeMapView>
  );
}

export default DayTrackMapView;

const styles = StyleSheet.create({
  map: {
    overflow: "hidden",
    borderRadius: 8,
    width: "100%"
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#EAF0EE"
  }
});
