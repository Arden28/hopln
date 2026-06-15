// app/(account)/offline-maps.tsx
import { ScreenHeader } from "@/components/app/ScreenHeader";
import {
  type BBox,
  DL_MAX_ZOOM,
  DL_MIN_ZOOM,
  TILE_PATH_TEMPLATE_DARK,
  TILE_PATH_TEMPLATE_LIGHT,
  deletePack,
  downloadPack,
  estimatePack,
  formatBytes,
} from "@/services/offlineTiles";
import { useNetworkStore } from "@/store/networkStore";
import { useAuthStore } from "@/store/authStore";
import { useOfflineMapStore } from "@/store/offlineMapStore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, UrlTile, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";

function makeC(dark: boolean) {
  return {
    bg:       dark ? "#0F0F0F" : "#F6F7F8",
    card:     dark ? "#1C1C1E" : "#FFFFFF",
    text:     dark ? "#FFFFFF" : "#1C1C1E",
    subText:  dark ? "#8E8E93" : "#4B5563",
    hairline: dark ? "#2C2C2E" : "#E5E7EB",
    track:    dark ? "#2C2C2E" : "#E5E7EB",
    soft:     dark ? "rgba(255,111,0,0.15)" : "#FFF3E0",
    pressed:  dark ? "#2C2C2E" : "#F2F2F7",
  };
}

const DEFAULT_REGION: Region = {
  latitude: -1.2864, longitude: 36.8172, latitudeDelta: 0.14, longitudeDelta: 0.14,
};
const PRESETS: { label: string; region: Region }[] = [
  { label: "Nairobi CBD",     region: { latitude: -1.2864, longitude: 36.8172, latitudeDelta: 0.05, longitudeDelta: 0.05 } },
  { label: "Greater Nairobi", region: { latitude: -1.2921, longitude: 36.8219, latitudeDelta: 0.32, longitudeDelta: 0.32 } },
];

function bboxFromRegion(r: Region): BBox {
  return {
    north: r.latitude  + r.latitudeDelta  / 2,
    south: r.latitude  - r.latitudeDelta  / 2,
    east:  r.longitude + r.longitudeDelta / 2,
    west:  r.longitude - r.longitudeDelta / 2,
  };
}

export default function OfflineMaps() {
  const dark   = useColorScheme() === "dark";
  const C      = makeC(dark);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnline        = useNetworkStore((s) => s.isOnline);

  const pack        = useOfflineMapStore((s) => s.pack);
  const progress    = useOfflineMapStore((s) => s.progress);
  const setPack     = useOfflineMapStore((s) => s.setPack);
  const clearPack   = useOfflineMapStore((s) => s.clearPack);
  const setStatus   = useOfflineMapStore((s) => s.setStatus);
  const setProgress = useOfflineMapStore((s) => s.setProgress);

  const mapRef    = useRef<MapView>(null);
  const cancelRef = useRef(false);

  const [region,      setRegion]      = useState<Region>(DEFAULT_REGION);
  const [regionName,  setRegionName]  = useState("Greater Nairobi");
  const [downloading, setDownloading] = useState(false);

  const est = useMemo(() => estimatePack(bboxFromRegion(region)), [region]);

  // ── Guest wall ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScreenHeader title="Offline maps" C={C} />
        <View style={s.wall}>
          <View style={[s.wallIcon, { backgroundColor: C.soft }]}>
            <Ionicons name="cloud-download-outline" size={34} color={ORANGE} />
          </View>
          <Text style={[s.wallTitle, { color: C.text }]}>Maps that work offline</Text>
          <Text style={[s.wallSub, { color: C.subText }]}>
            Sign in to download map areas and keep navigating Nairobi even without a connection.
          </Text>
          <Pressable style={s.primaryBtn} onPress={() => router.push("/(auth)/login" as any)}>
            <Text style={s.primaryBtnText}>Sign in</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={() => router.push("/(auth)/get-started" as any)}>
            <Text style={[s.secondaryBtnText, { color: C.subText }]}>Create an account</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handlePreset = (p: { label: string; region: Region }) => {
    setRegionName(p.label);
    mapRef.current?.animateToRegion(p.region, 500);
  };

  const handleDownload = async () => {
    if (est.tooLarge) {
      Alert.alert("Area too large", "Zoom in to select a smaller area before downloading.");
      return;
    }
    const bbox = bboxFromRegion(region);
    cancelRef.current = false;
    setDownloading(true);
    setStatus("downloading");
    setProgress(0);
    try {
      const res = await downloadPack(
        bbox, DL_MIN_ZOOM, DL_MAX_ZOOM,
        (done, total) => setProgress(total ? done / total : 0),
        () => cancelRef.current,
      );
      if (res.cancelled) {
        setStatus(pack ? "ready" : "idle");
        return;
      }
      setPack({
        id:        `pack-${Date.now()}`,
        name:      regionName,
        bbox,
        minZoom:   DL_MIN_ZOOM,
        maxZoom:   DL_MAX_ZOOM,
        tileCount: res.tileCount,
        bytes:     res.bytes,
        createdAt: Date.now(),
        styles:    { light: true, dark: true },
      });
    } catch (e: any) {
      setStatus("error");
      Alert.alert("Download failed", e?.message ?? "Could not download the offline map.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete offline map",
      "This removes the downloaded tiles from your device. You can download them again anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => { await deletePack(); clearPack(); },
        },
      ],
    );
  };

  const pct = Math.round(progress * 100);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenHeader title="Offline maps" C={C} />
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Existing pack */}
        {pack && (
          <View style={[s.section, { backgroundColor: C.card }]}>
            <Text style={[s.sectionTitle, { color: C.subText }]}>DOWNLOADED</Text>
            <View style={s.packRow}>
              <View style={[s.packIcon, { backgroundColor: C.soft }]}>
                <Ionicons name="map" size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.packName, { color: C.text }]}>{pack.name}</Text>
                <Text style={[s.packMeta, { color: C.subText }]}>
                  {formatBytes(pack.bytes)} · {pack.tileCount.toLocaleString()} tiles · {new Date(pack.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pressable onPress={handleDelete} hitSlop={10} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Region picker */}
        <View style={[s.section, { backgroundColor: C.card }]}>
          <Text style={[s.sectionTitle, { color: C.subText }]}>
            {pack ? "DOWNLOAD ANOTHER AREA" : "SELECT AN AREA"}
          </Text>

          <View style={s.mapWrap}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_GOOGLE}
              initialRegion={DEFAULT_REGION}
              onRegionChangeComplete={setRegion}
              pitchEnabled={false}
              rotateEnabled={false}
              // When offline, remove the blank Google base and show downloaded
              // tiles so the user can see exactly what they've got.
              mapType={!isOnline && pack ? "none" : "standard"}
            >
              {pack && (
                <UrlTile
                  urlTemplate={`file://${dark ? TILE_PATH_TEMPLATE_DARK : TILE_PATH_TEMPLATE_LIGHT}`}
                  tileSize={256}
                />
              )}
            </MapView>
            {/* Selection frame hint */}
            <View pointerEvents="none" style={s.frame} />
          </View>

          <Text style={[s.hint, { color: C.subText }]}>
            Pan and zoom so the area you need fills the frame.
          </Text>

          <View style={s.presets}>
            {PRESETS.map((p) => (
              <Pressable key={p.label} onPress={() => handlePreset(p)} style={[s.chip, { backgroundColor: C.soft }]}>
                <Text style={s.chipText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Estimate */}
          <View style={[s.estimate, { borderColor: C.hairline }]}>
            <Ionicons name="cloud-download-outline" size={16} color={C.subText} />
            <Text style={[s.estimateText, { color: C.text }]}>
              {est.tooLarge
                ? "Area too large — zoom in"
                : `≈ ${formatBytes(est.approxBytes)} · ${est.tileCount.toLocaleString()} tiles × 2 (light & dark)`}
            </Text>
          </View>

          {/* Progress / Download */}
          {downloading ? (
            <View style={s.dlBlock}>
              <View style={[s.progressTrack, { backgroundColor: C.track }]}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
              </View>
              <View style={s.dlRow}>
                <Text style={[s.dlPct, { color: C.subText }]}>{pct}%</Text>
                <Pressable onPress={() => { cancelRef.current = true; }} hitSlop={8}>
                  <Text style={s.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={handleDownload}
              disabled={est.tooLarge}
              style={[s.primaryBtn, est.tooLarge && { opacity: 0.5 }]}
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={s.primaryBtnText}>{pack ? "Update / download area" : "Download this area"}</Text>
            </Pressable>
          )}
        </View>

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={14} color={C.subText} />
          <Text style={[s.noteText, { color: C.subText }]}>
            When you lose connection, Hopln automatically switches to your downloaded map so stops and journeys keep working.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },

  section: {
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingTop:        12,
    paddingBottom:     14,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 },

  // Map picker
  mapWrap: {
    height:        260,
    borderRadius:  12,
    overflow:      "hidden",
    position:      "relative",
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    margin:        20,
    borderWidth:   2,
    borderColor:   ORANGE,
    borderRadius:  10,
    borderStyle:   "dashed",
  },
  hint: { fontSize: 12, lineHeight: 16, marginTop: 8 },

  presets: { flexDirection: "row", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { color: ORANGE, fontWeight: "700", fontSize: 12 },

  estimate: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    borderWidth:     StyleSheet.hairlineWidth,
    borderRadius:    10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop:       12,
  },
  estimateText: { fontSize: 13, fontWeight: "600" },

  dlBlock: { marginTop: 14, gap: 8 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: 8, borderRadius: 4, backgroundColor: ORANGE },
  dlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dlPct: { fontSize: 13, fontWeight: "600" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#FF3B30" },

  // Pack card
  packRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  packIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  packName: { fontSize: 15, fontWeight: "700" },
  packMeta: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 4 },

  // Buttons
  primaryBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    height:          50,
    borderRadius:    14,
    backgroundColor: ORANGE,
    marginTop:       14,
  },
  primaryBtnText:   { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  secondaryBtn:     { marginTop: 12, alignItems: "center" },
  secondaryBtnText: { fontSize: 14, fontWeight: "600" },

  // Guest wall
  wall: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  wallIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  wallTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  wallSub: { fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300, marginBottom: 8 },

  // Note
  note: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 4 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
