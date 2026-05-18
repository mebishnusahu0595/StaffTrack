import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { LatLng } from "../api";

type DayTrackMapViewProps = {
  height?: number;
  markers?: LatLng[];
  path?: LatLng[];
};

export function DayTrackMapView({ height = 220, markers = [], path = [] }: DayTrackMapViewProps) {
  const firstPoint = markers[0] ?? path[0];
  const points = path.length > 0 ? path : markers;

  if (!firstPoint) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text>No map location available</Text>
      </View>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${firstPoint.lat},${firstPoint.lng}`;

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(mapsUrl)}
      style={[styles.map, { height }]}
    >
      <Text style={styles.title}>Location preview</Text>
      <Text style={styles.coordinates}>
        {firstPoint.lat.toFixed(5)}, {firstPoint.lng.toFixed(5)}
      </Text>
      <View style={styles.routeLine}>
        {points.slice(0, 8).map((point, index) => (
          <View
            key={`${point.lat}-${point.lng}-${index}`}
            style={[
              styles.routePoint,
              index === 0 ? styles.routePointFirst : undefined,
              index === points.length - 1 ? styles.routePointLast : undefined
            ]}
          />
        ))}
      </View>
      <Text style={styles.hint}>Open in Maps</Text>
    </Pressable>
  );
}

export default DayTrackMapView;

const styles = StyleSheet.create({
  map: {
    backgroundColor: "#E7EFEA",
    borderColor: "#C7D8D0",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    padding: 18,
    width: "100%"
  },
  empty: {
    alignItems: "center",
    backgroundColor: "#EAF0EE",
    borderRadius: 8,
    justifyContent: "center"
  },
  title: {
    color: "#24312D",
    fontSize: 18,
    fontWeight: "700"
  },
  coordinates: {
    color: "#4A6583",
    marginTop: 6
  },
  routeLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 24
  },
  routePoint: {
    backgroundColor: "#78918A",
    borderRadius: 6,
    height: 12,
    width: 12
  },
  routePointFirst: {
    backgroundColor: "#146C5C"
  },
  routePointLast: {
    backgroundColor: "#A4262C"
  },
  hint: {
    color: "#146C5C",
    fontWeight: "700",
    marginTop: 18
  }
});
