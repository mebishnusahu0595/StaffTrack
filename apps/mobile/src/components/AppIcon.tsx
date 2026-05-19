import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type AppIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function AppIcon({ name, size = 24, color = "#1A202C", style }: AppIconProps) {
  const normalizedName = name.toLowerCase();
  const stroke = Math.max(2, Math.round(size * 0.09));

  return (
    <View
      pointerEvents="none"
      style={[styles.frame, { width: size, height: size }, style]}
      testID={`app-icon-${normalizedName}`}
    >
      {renderIcon(normalizedName, size, color, stroke)}
    </View>
  );
}

export function appIconSource(name: string) {
  return ({ color, size }: { color: string; size: number }) => (
    <AppIcon color={color} name={name} size={size} />
  );
}

function renderIcon(name: string, size: number, color: string, stroke: number) {
  if (name === "menu") {
    return (
      <View style={styles.center}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.menuLine,
              {
                width: size * 0.78,
                height: stroke,
                borderRadius: stroke,
                backgroundColor: color,
                marginVertical: size * 0.075
              }
            ]}
          />
        ))}
      </View>
    );
  }

  if (name === "close") {
    return (
      <View style={styles.center}>
        <View style={[styles.crossLine, { width: size * 0.72, height: stroke, backgroundColor: color, transform: [{ rotate: "45deg" }] }]} />
        <View style={[styles.crossLine, { width: size * 0.72, height: stroke, backgroundColor: color, transform: [{ rotate: "-45deg" }] }]} />
      </View>
    );
  }

  if (name === "chevron-left" || name === "chevron-right") {
    const rotate = name === "chevron-left" ? "-45deg" : "135deg";

    return (
      <View style={styles.center}>
        <View
          style={{
            width: size * 0.42,
            height: size * 0.42,
            borderLeftWidth: stroke,
            borderBottomWidth: stroke,
            borderColor: color,
            transform: [{ rotate }]
          }}
        />
      </View>
    );
  }

  if (name === "filter-variant" || name === "filter") {
    return (
      <View style={styles.center}>
        <View style={[styles.filterLine, { width: size * 0.74, height: stroke, backgroundColor: color }]} />
        <View style={[styles.filterLine, { width: size * 0.5, height: stroke, backgroundColor: color, marginTop: size * 0.18 }]} />
        <View style={[styles.filterLine, { width: size * 0.28, height: stroke, backgroundColor: color, marginTop: size * 0.18 }]} />
      </View>
    );
  }

  if (name === "plus") {
    return (
      <View style={styles.center}>
        <View style={{ width: size * 0.7, height: stroke, borderRadius: stroke, backgroundColor: color }} />
        <View style={{ position: "absolute", width: stroke, height: size * 0.7, borderRadius: stroke, backgroundColor: color }} />
      </View>
    );
  }

  if (name === "eye" || name === "eye-off") {
    return (
      <View style={styles.center}>
        <View
          style={{
            width: size * 0.82,
            height: size * 0.46,
            borderWidth: stroke,
            borderColor: color,
            borderRadius: size,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <View style={{ width: size * 0.2, height: size * 0.2, borderRadius: size, backgroundColor: color }} />
        </View>
        {name === "eye-off" ? (
          <View style={[styles.diagonal, { width: size * 0.94, height: stroke, backgroundColor: color, transform: [{ rotate: "-35deg" }] }]} />
        ) : null}
      </View>
    );
  }

  if (name === "bell-outline" || name === "bell-badge" || name === "bell") {
    return (
      <View style={styles.center}>
        <View
          style={{
            width: size * 0.54,
            height: size * 0.62,
            borderWidth: stroke,
            borderColor: color,
            borderTopLeftRadius: size * 0.28,
            borderTopRightRadius: size * 0.28,
            borderBottomLeftRadius: size * 0.1,
            borderBottomRightRadius: size * 0.1
          }}
        />
        <View style={{ width: size * 0.66, height: stroke, borderRadius: stroke, backgroundColor: color, marginTop: -stroke }} />
        <View style={{ width: size * 0.18, height: size * 0.1, borderRadius: size, backgroundColor: color, marginTop: stroke }} />
        {name === "bell-badge" ? (
          <View style={[styles.badgeDot, { width: size * 0.24, height: size * 0.24, borderRadius: size, backgroundColor: color }]} />
        ) : null}
      </View>
    );
  }

  if (name === "office-building" || name === "home") {
    return (
      <View style={[styles.building, { width: size * 0.66, height: size * 0.78, borderWidth: stroke, borderColor: color }]}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.windowRow}>
            <View style={[styles.window, { width: size * 0.12, height: size * 0.12, backgroundColor: color }]} />
            <View style={[styles.window, { width: size * 0.12, height: size * 0.12, backgroundColor: color }]} />
          </View>
        ))}
      </View>
    );
  }

  if (name === "map-marker-outline" || name === "map-marker-distance" || name === "map-search") {
    return (
      <View style={styles.center}>
        <View
          style={[
            styles.pinHead,
            {
              width: size * 0.58,
              height: size * 0.58,
              borderWidth: stroke,
              borderColor: color,
              borderRadius: size
            }
          ]}
        >
          <View style={{ width: size * 0.16, height: size * 0.16, borderRadius: size, backgroundColor: color }} />
        </View>
        <View style={[styles.pinTail, { borderTopColor: color, borderLeftWidth: size * 0.13, borderRightWidth: size * 0.13, borderTopWidth: size * 0.26 }]} />
      </View>
    );
  }

  if (name === "coffee" || name === "coffee-outline") {
    return (
      <View style={styles.center}>
        <View style={{ width: size * 0.58, height: size * 0.44, borderWidth: stroke, borderColor: color, borderRadius: size * 0.12 }} />
        <View style={{ position: "absolute", right: size * 0.08, top: size * 0.34, width: size * 0.18, height: size * 0.22, borderWidth: stroke, borderColor: color, borderRadius: size }} />
        <View style={{ width: size * 0.72, height: stroke, borderRadius: stroke, backgroundColor: color, marginTop: size * 0.1 }} />
      </View>
    );
  }

  if (name.includes("calendar")) {
    return (
      <View style={[styles.calendar, { width: size * 0.72, height: size * 0.72, borderWidth: stroke, borderColor: color }]}>
        <View style={{ height: stroke * 2, backgroundColor: color, alignSelf: "stretch" }} />
        <View style={{ width: size * 0.26, height: size * 0.26, borderRadius: size, backgroundColor: color, marginTop: size * 0.16 }} />
      </View>
    );
  }

  if (name.includes("file") || name === "clipboard-list") {
    return (
      <View style={[styles.document, { width: size * 0.62, height: size * 0.76, borderWidth: stroke, borderColor: color }]}>
        <View style={{ width: size * 0.34, height: stroke, backgroundColor: color, marginTop: size * 0.2 }} />
        <View style={{ width: size * 0.34, height: stroke, backgroundColor: color, marginTop: size * 0.12 }} />
      </View>
    );
  }

  if (name.includes("check")) {
    return (
      <View style={styles.center}>
        <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: size, borderWidth: stroke, borderColor: color }} />
        <View style={[styles.checkShort, { width: size * 0.22, height: stroke, backgroundColor: color, transform: [{ rotate: "45deg" }] }]} />
        <View style={[styles.checkLong, { width: size * 0.4, height: stroke, backgroundColor: color, transform: [{ rotate: "-45deg" }] }]} />
      </View>
    );
  }

  if (name === "login" || name === "logout") {
    const arrowOffset = name === "login" ? size * 0.02 : size * 0.08;
    const doorOffset = name === "login" ? size * 0.16 : 0;

    return (
      <View style={styles.center}>
        <View style={{ width: size * 0.52, height: size * 0.62, borderWidth: stroke, borderColor: color, borderRadius: size * 0.08, marginLeft: doorOffset }} />
        <View style={{ position: "absolute", right: arrowOffset, width: size * 0.48, height: stroke, backgroundColor: color }} />
        <View style={[styles.arrowHead, { right: arrowOffset - size * 0.04, borderLeftColor: color, borderTopWidth: size * 0.12, borderBottomWidth: size * 0.12, borderLeftWidth: size * 0.18 }]} />
      </View>
    );
  }

  if (name === "account") {
    return (
      <View style={styles.center}>
        <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size, backgroundColor: color }} />
        <View style={{ width: size * 0.62, height: size * 0.32, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: color, marginTop: size * 0.08 }} />
      </View>
    );
  }

  return <View style={{ width: size * 0.62, height: size * 0.62, borderWidth: stroke, borderColor: color, borderRadius: size * 0.12 }} />;
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    alignItems: "center",
    justifyContent: "center"
  },
  menuLine: {},
  filterLine: {
    borderRadius: 4
  },
  crossLine: {
    position: "absolute",
    borderRadius: 4
  },
  diagonal: {
    position: "absolute",
    borderRadius: 4
  },
  badgeDot: {
    position: "absolute",
    right: 0,
    top: 0
  },
  building: {
    alignItems: "center",
    borderRadius: 3,
    justifyContent: "center"
  },
  windowRow: {
    flexDirection: "row"
  },
  window: {
    borderRadius: 2,
    margin: 2
  },
  pinHead: {
    alignItems: "center",
    justifyContent: "center"
  },
  pinTail: {
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    height: 0,
    marginTop: -2,
    width: 0
  },
  calendar: {
    borderRadius: 4,
    overflow: "hidden"
  },
  document: {
    alignItems: "center",
    borderRadius: 3
  },
  checkShort: {
    left: "35%",
    position: "absolute",
    top: "54%"
  },
  checkLong: {
    left: "43%",
    position: "absolute",
    top: "49%"
  },
  arrowHead: {
    borderBottomColor: "transparent",
    borderTopColor: "transparent",
    height: 0,
    position: "absolute",
    width: 0
  }
});
