// app/(account)/notification-inbox.tsx
import { ScreenHeader } from "@/components/app/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FF6F00";
const GREY   = "#8E8E93";

// ── Type definitions (ready for real data) ───────────────────────────────────

type NotifCategory = "transit" | "community" | "system" | "journey";

interface Notification {
  id:       string;
  category: NotifCategory;
  title:    string;
  body:     string;
  time:     string;  // ISO
  read:     boolean;
}

const CATEGORY_META: Record<NotifCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; darkBg: string }> = {
  transit:   { icon: "bus",              color: ORANGE,    bg: "#FFF3E0", darkBg: "rgba(255,111,0,0.18)"  },
  community: { icon: "people",           color: "#10B981", bg: "#F0FFF4", darkBg: "rgba(16,185,129,0.15)" },
  system:    { icon: "information",      color: "#3B82F6", bg: "#EFF6FF", darkBg: "rgba(59,130,246,0.15)" },
  journey:   { icon: "navigate-circle",  color: "#8B5CF6", bg: "#F5F3FF", darkBg: "rgba(139,92,246,0.15)" },
};

// ── Color factory ─────────────────────────────────────────────────────────────

function makeC(dark: boolean) {
  return {
    bg:       dark ? "#0F0F0F" : "#F6F7F8",
    card:     dark ? "#1C1C1E" : "#FFFFFF",
    text:     dark ? "#FFFFFF" : "#1C1C1E",
    sub:      dark ? GREY      : "#6B7280",
    hairline: dark ? "#2C2C2E" : "#E5E7EB",
    unread:   dark ? "#2C2C2E" : "#FFF8F4",
    badge:    dark ? "#FF6F00" : "#FF6F00",
  };
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({
  notif,
  C,
  dark,
}: {
  notif: Notification;
  C: ReturnType<typeof makeC>;
  dark: boolean;
}) {
  const meta = CATEGORY_META[notif.category];
  const bg   = dark ? meta.darkBg : meta.bg;
  const time = formatTime(notif.time);

  return (
    <Pressable
      style={({ pressed }) => [
        s.notifRow,
        { backgroundColor: notif.read ? C.card : C.unread },
        pressed && { opacity: 0.75 },
      ]}
    >
      {/* Icon */}
      <View style={[s.notifIcon, { backgroundColor: bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>

      {/* Body */}
      <View style={s.notifBody}>
        <View style={s.notifTop}>
          <Text style={[s.notifTitle, { color: C.text }]} numberOfLines={1}>{notif.title}</Text>
          <Text style={[s.notifTime, { color: C.sub }]}>{time}</Text>
        </View>
        <Text style={[s.notifText, { color: C.sub }]} numberOfLines={2}>{notif.body}</Text>
      </View>

      {/* Unread dot */}
      {!notif.read && <View style={[s.unreadDot, { backgroundColor: ORANGE }]} />}
    </Pressable>
  );
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "Just now";
  if (m < 60)  return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function SectionLabel({ label, C }: { label: string; C: ReturnType<typeof makeC> }) {
  return (
    <View style={[s.sectionLabel, { backgroundColor: C.bg }]}>
      <Text style={[s.sectionText, { color: C.sub }]}>{label}</Text>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ C }: { C: ReturnType<typeof makeC> }) {
  return (
    <View style={s.empty}>
      {/* Bell with sparkle */}
      <View style={s.emptyIconWrap}>
        <View style={[s.emptyIconOuter, { backgroundColor: ORANGE + "18" }]}>
          <View style={[s.emptyIconInner, { backgroundColor: ORANGE + "30" }]}>
            <Ionicons name="notifications" size={38} color={ORANGE} />
          </View>
        </View>
        <View style={s.emptySparkle1}><Ionicons name="sparkles" size={14} color={ORANGE} /></View>
        <View style={s.emptySparkle2}><Ionicons name="star" size={10} color="#FCD34D" /></View>
      </View>

      <Text style={[s.emptyTitle, { color: C.text }]}>You're all caught up</Text>
      <Text style={[s.emptySub, { color: C.sub }]}>
        When you get transit alerts, journey reminders, or community updates, they'll appear here.
      </Text>

      {/* Category preview chips */}
      <View style={s.categoryRow}>
        {(Object.entries(CATEGORY_META) as [NotifCategory, typeof CATEGORY_META[NotifCategory]][]).map(([key, meta]) => (
          <View key={key} style={[s.categoryChip, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={13} color={meta.color} />
            <Text style={[s.categoryChipText, { color: meta.color }]}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NotificationInbox() {
  const insets = useSafeAreaInsets();
  const dark   = useColorScheme() === "dark";
  const C      = makeC(dark);
  const router = useRouter();

  // No real notifications yet — frontend only
  const notifications: Notification[] = [];

  const today   = notifications.filter((n) => isToday(n.time));
  const earlier = notifications.filter((n) => !isToday(n.time));
  const unreadCount = notifications.filter((n) => !n.read).length;

  const headerC = { bg: C.card, text: C.text, hairline: C.hairline };

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <ScreenHeader
        title="Notifications"
        C={headerC}
        rightLabel="Settings"
        rightAction={() => router.push("/(account)/notifications" as any)}
      />

      {notifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={[s.emptyScroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState C={C} />

          {/* Settings link */}
          <Pressable
            style={({ pressed }) => [s.settingsLink, { backgroundColor: C.card, opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push("/(account)/notifications" as any)}
          >
            <View style={[s.settingsIcon, { backgroundColor: ORANGE + "18" }]}>
              <Ionicons name="settings-outline" size={18} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.settingsTitle, { color: C.text }]}>Notification settings</Text>
              <Text style={[s.settingsSub, { color: C.sub }]}>Control what you receive and how</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.sub} />
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {today.length > 0 && (
            <>
              <SectionLabel label="TODAY" C={C} />
              {today.map((n) => <NotifRow key={n.id} notif={n} C={C} dark={dark} />)}
            </>
          )}
          {earlier.length > 0 && (
            <>
              <SectionLabel label="EARLIER" C={C} />
              {earlier.map((n) => <NotifRow key={n.id} notif={n} C={C} dark={dark} />)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Notification rows
  notifRow: {
    flexDirection:    "row",
    alignItems:       "flex-start",
    paddingHorizontal: 16,
    paddingVertical:  14,
    gap:              12,
  },
  notifIcon: {
    width:          44,
    height:         44,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  notifBody:  { flex: 1, gap: 4 },
  notifTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  notifTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  notifTime:  { fontSize: 12, flexShrink: 0 },
  notifText:  { fontSize: 13, lineHeight: 18 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },

  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     6,
  },
  sectionText: {
    fontSize:      11,
    fontWeight:    "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Empty state
  emptyScroll: { flexGrow: 1, paddingHorizontal: 24 },
  empty: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            16,
    paddingTop:     48,
    paddingBottom:  32,
  },
  emptyIconWrap:  { position: "relative", width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyIconOuter: { width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center" },
  emptyIconInner: { width: 78,  height: 78,  borderRadius: 39, alignItems: "center", justifyContent: "center" },
  emptySparkle1:  { position: "absolute", top: 4,  right: 6  },
  emptySparkle2:  { position: "absolute", bottom: 8, left: 8 },
  emptyTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  emptySub:   { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },

  categoryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 4 },
  categoryChip: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              5,
    paddingHorizontal: 10,
    paddingVertical:  6,
    borderRadius:     99,
  },
  categoryChipText: { fontSize: 12, fontWeight: "600" },

  settingsLink: {
    flexDirection:    "row",
    alignItems:       "center",
    gap:              12,
    marginTop:        24,
    borderRadius:     16,
    paddingHorizontal: 14,
    paddingVertical:  14,
    shadowColor:      "#000",
    shadowOpacity:    0.04,
    shadowRadius:     8,
    elevation:        2,
  },
  settingsIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingsTitle: { fontSize: 15, fontWeight: "600" },
  settingsSub:   { fontSize: 12, marginTop: 1 },
});
