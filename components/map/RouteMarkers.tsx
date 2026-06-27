import React, { useEffect, useRef, useState } from "react";
import type { NodeMarker } from "@/components/map/types";
import { Animated, Image, StyleSheet, View } from "react-native";
import { Text } from "react-native";
import { PointAnnotation } from "@rnmapbox/maps";

// Named import mirrors the pattern used in StopsLayer/RouteOverlay — avoids the
// web .d.ts resolution issue that can leave namespace-accessed components undefined.
const NativePointAnnotation = PointAnnotation as unknown as React.ComponentType<any>;

const ORANGE = "#FF6F00";

export function LocationPin() {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
      <View style={{
        position: "absolute", width: 32, height: 32, borderRadius: 16,
        backgroundColor: "rgba(255,111,0,0.14)", borderWidth: 1, borderColor: "rgba(255,111,0,0.30)",
      }} />
      <View style={{
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: ORANGE, borderWidth: 2.5, borderColor: "#FFFFFF",
        shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }, elevation: 6,
      }} />
    </View>
  );
}

export function IntermediateStopDot({ color }: { color: string }) {
  return (
    <View style={{
      width: 13, height: 13, borderRadius: 4.5,
      backgroundColor: color,
      borderWidth: 2, borderColor: "#FFFFFF",
      shadowColor: "#000", shadowOpacity: 0.18,
      shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 4,
    }} />
  );
}

export function StopNodeMarker({ color, onLoad }: { color: string; onLoad: () => void }) {
  return (
    <View style={{
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: color,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2.5, borderColor: "#FFFFFF",
      shadowColor: "#000", shadowOpacity: 0.28,
      shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 8,
    }}>
      <Image
        source={require("@/assets/images/matatu.png")}
        style={{ width: 16, height: 16 }}
        resizeMode="contain"
        onLoad={onLoad}
      />
    </View>
  );
}

export function TrackedNodeMarker({ m, isBoardingStop }: { m: NodeMarker; isBoardingStop?: boolean }) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  // Mount-gate: hold off rendering the PointAnnotation until layout is complete.
  // matatu.png is a local bundle asset and loads in < 50 ms; 100 ms is ample.
  // Keeping id/key stable after mount avoids the "max 1 subview" race.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isBoardingStop) { pulseScale.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseScale, { toValue: 2.2, duration: 850, useNativeDriver: true }),
      Animated.timing(pulseScale, { toValue: 1.0, duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isBoardingStop, pulseScale]);

  const pulseOpacity = pulseScale.interpolate({ inputRange: [1, 2.2], outputRange: [0.55, 0] });

  if (!ready) return null;
  return (
    <NativePointAnnotation
      id={m.id}
      key={m.id}
      coordinate={[m.coord.longitude, m.coord.latitude]}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        {isBoardingStop && (
          <Animated.View style={[
            rm.pulseRing,
            { borderColor: m.color, transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]} />
        )}
        <StopNodeMarker color={m.color} onLoad={() => {}} />
      </View>
    </NativePointAnnotation>
  );
}

export function SquarePin({ isStart }: { isStart: boolean }) {
  return (
    <View style={{
      width: 20, height: 20, borderRadius: 5,
      backgroundColor: isStart ? ORANGE : "#1C1C1E",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2.5, borderColor: "#FFFFFF",
      shadowColor: "#000", shadowOpacity: 0.30,
      shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 8,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" }} />
    </View>
  );
}

export function DestinationPin({ name }: { name: string }) {
  return (
    <View style={{ alignItems: "center", height: 52 }}>
      <View style={{
        backgroundColor: "#1C1C1E",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        maxWidth: 160,
        marginBottom: 5,
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
      }}>
        <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700", letterSpacing: 0.2 }}>
          {name}
        </Text>
      </View>
      <SquarePin isStart={false} />
    </View>
  );
}

export function HeadingArrow() {
  return <View style={s.arrow} />;
}

const rm = StyleSheet.create({
  pulseRing: {
    position:     "absolute",
    width:        30,
    height:       30,
    borderRadius: 15,
    borderWidth:  2.5,
  },
});

const s = StyleSheet.create({
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#007AFF",
  },
});
