// components/app/RouteStepsList.tsx
import { RouteStop, Step, WalkSubStep, getRouteColor, maneuverIcon, mToNice, sToMin } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";

const ORANGE     = "#FF6F00";
const BLACK      = "#1C1C1E";
const GREY       = "#8E8E93";
const LIGHT_GREY = "#F2F2F7";
const BORDER     = "#E5E5EA";
const BG         = "#FFFFFF";

const RAIL_W = 46;

// ─── Walk connector dots ──────────────────────────────────────────────────────

function WalkDots() {
  const dark = useColorScheme() === "dark";
  const dotColor = dark ? "#4A4A4A" : "#C7C7CC";
  return (
    <View style={wd.col}>
      {[0, 1, 2].map((i) => <View key={i} style={[wd.dot, { backgroundColor: dotColor }]} />)}
    </View>
  );
}
const wd = StyleSheet.create({
  col: { width: RAIL_W, alignItems: "center", paddingVertical: 4, gap: 6 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});

// ─── Origin node ──────────────────────────────────────────────────────────────

function OriginNode() {
  const dark = useColorScheme() === "dark";
  const ringBg = dark ? "rgba(255,111,0,0.22)" : "#FFE2C2";
  const textColor = dark ? "#FFFFFF" : BLACK;
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <View style={orig.row}>
      <View style={orig.rail}>
        <View style={[orig.outerRing, { backgroundColor: ringBg }]}>
          <View style={orig.innerDot} />
        </View>
      </View>
      <Text style={[orig.label, { color: textColor }]}>Your location</Text>
      <Text style={orig.time}>{time}</Text>
    </View>
  );
}
const orig = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  rail:      { width: RAIL_W, alignItems: "center" },
  outerRing: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  innerDot:  { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FF6F00" },
  label:     { flex: 1, fontSize: 15, fontWeight: "600" },
  time:      { fontSize: 13, color: GREY },
});

// ─── Walk sub-step ────────────────────────────────────────────────────────────

function SubStep({ sub, isLast }: { sub: WalkSubStep; isLast: boolean }) {
  const dark = useColorScheme() === "dark";
  const iconBg    = dark ? "#2C2C2E" : LIGHT_GREY;
  const textColor = dark ? "#FFFFFF" : BLACK;
  const borderColor = dark ? "#2C2C2E" : BORDER;
  return (
    <View style={[ss.row, !isLast && ss.divided, !isLast && { borderBottomColor: borderColor }]}>
      <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={maneuverIcon(sub.maneuver)} size={14} color={GREY} />
      </View>
      <Text style={[ss.instruction, { color: textColor }]} numberOfLines={2}>{sub.instruction}</Text>
      {sub.distance > 0 && <Text style={ss.dist}>{mToNice(sub.distance)}</Text>}
    </View>
  );
}
const ss = StyleSheet.create({
  row:         { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  divided:     { borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap:    { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  instruction: { flex: 1, fontSize: 13, fontWeight: "500" },
  dist:        { fontSize: 12, color: GREY, flexShrink: 0 },
});

// ─── Walk row ─────────────────────────────────────────────────────────────────

function WalkRow({ step, isActive, isPassed }: { step: Step; isActive: boolean; isPassed: boolean }) {
  const [open, setOpen] = useState(isActive);
  const hasSubs = (step.subSteps?.length ?? 0) > 0;
  const dark = useColorScheme() === "dark";
  const textColor   = dark ? "#FFFFFF" : BLACK;
  const pillBg      = dark ? "#2C2C2E" : LIGHT_GREY;
  const subCardBg   = dark ? "#2C2C2E" : LIGHT_GREY;

  return (
    <View style={{ opacity: isPassed ? 0.35 : 1 }}>
      <Pressable style={wr.row} onPress={() => hasSubs && setOpen((v) => !v)} disabled={!hasSubs}>
        <View style={wr.rail}>
          <Ionicons name="walk" size={20} color={isActive ? ORANGE : GREY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[wr.walkText, { color: textColor }, isActive && { color: ORANGE }]}>
            Walk {sToMin(step.duration).replace("~", "")} ({mToNice(step.distance)})
          </Text>
        </View>
        {hasSubs && (
          <View style={[wr.chevronPill, { backgroundColor: pillBg }]}>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={13} color={GREY} />
          </View>
        )}
      </Pressable>

      {open && hasSubs && (
        <View style={wr.subContainer}>
          <View style={{ width: RAIL_W }} />
          <View style={[wr.subCard, { backgroundColor: subCardBg }]}>
            {step.subSteps!.map((sub, j) => (
              <SubStep key={j} sub={sub} isLast={j === step.subSteps!.length - 1} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
const wr = StyleSheet.create({
  row:          { flexDirection: "row", alignItems: "center", paddingVertical: 5, gap: 6 },
  rail:         { width: RAIL_W, alignItems: "center" },
  walkText:     { fontSize: 15, fontWeight: "500" },
  chevronPill:  { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  subContainer: { flexDirection: "row", paddingBottom: 8 },
  subCard:      { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 2, marginRight: 4 },
});

// ─── Stops list ───────────────────────────────────────────────────────────────

function StopsList({ stops, routeColor }: { stops: RouteStop[]; routeColor: string }) {
  const dark = useColorScheme() === "dark";
  const nameColor = dark ? "#ABABAB" : "#555";
  const intermediate = stops.slice(1, -1);
  if (intermediate.length === 0) return null;

  return (
    <View style={sl.container}>
      {intermediate.map((stop, idx) => (
        <View key={idx} style={sl.row}>
          <View style={sl.track}>
            {idx > 0 && <View style={[sl.line, { backgroundColor: routeColor + "55" }]} />}
            <View style={[sl.dot, { backgroundColor: routeColor }]} />
            {idx < intermediate.length - 1 && <View style={[sl.line, { backgroundColor: routeColor + "55" }]} />}
          </View>
          <Text style={[sl.name, { color: nameColor }]} numberOfLines={1}>{stop.name}</Text>
        </View>
      ))}
    </View>
  );
}
const sl = StyleSheet.create({
  container: { marginTop: 6, marginBottom: 2 },
  row:       { flexDirection: "row", alignItems: "center", minHeight: 30 },
  track:     { width: 22, alignItems: "center", alignSelf: "stretch", justifyContent: "center" },
  dot:       { width: 7, height: 7, borderRadius: 3.5, zIndex: 1 },
  line:      { position: "absolute", top: 0, bottom: 0, width: 2, borderRadius: 1 },
  name:      { flex: 1, fontSize: 13, paddingLeft: 8, paddingVertical: 2 },
});

// ─── Transit section ──────────────────────────────────────────────────────────

function TransitSection({
  depart, arrive, routeColor, stopName, alightName, isActive, isPassed,
}: {
  depart: Step; arrive: Step;
  routeColor: string; stopName: string; alightName: string;
  isActive: boolean; isPassed: boolean;
}) {
  const [rideExpanded, setRideExpanded] = useState(false);
  const dark = useColorScheme() === "dark";
  const C = {
    bg:       dark ? "#1C1C1E" : BG,
    text:     dark ? "#FFFFFF" : BLACK,
    border:   dark ? "#2C2C2E" : BORDER,
    pillBg:   dark ? "#2C2C2E" : LIGHT_GREY,
  };

  const routeNameMatch = depart.instruction?.match(/^Board Line (.+) at /);
  const routeName = routeNameMatch?.[1] ?? (depart as any).routeName ?? "";
  const stops     = depart.stops ?? [];
  const stopCount = stops.length > 1 ? stops.length - 1 : 1;
  const hasSubs   = stops.length > 2;
  const rideDur   = arrive ? sToMin(arrive.duration).replace("~", "") : "";
  const rideDist  = arrive ? mToNice(arrive.distance) : "";

  return (
    <View style={[ts.wrapper, isPassed && { opacity: 0.35 }]}>
      <View style={ts.row}>
        <View style={ts.rail}>
          <View style={[ts.busCircle, { backgroundColor: C.bg, borderColor: C.border }]}>
            <Ionicons name="bus" size={18} color={C.text} />
          </View>
          <View style={[ts.verticalBar, { backgroundColor: routeColor, height: 20, marginTop: -2 }]} />
        </View>
        <View style={ts.headerText}>
          <Text style={[ts.stopNameMain, { color: C.text }]}>{stopName}</Text>
        </View>
      </View>

      <View style={ts.row}>
        <View style={ts.rail}>
          <View style={[ts.verticalBar, { backgroundColor: routeColor, flex: 1 }]} />
        </View>
        <View style={ts.middleContent}>
          <View style={ts.routeInfoRow}>
            <View style={[ts.badge, { borderColor: routeColor + "60" }]}>
              <Text style={[ts.badgeText, { color: routeColor }]}>{routeName}</Text>
            </View>
            <Text style={[ts.destinationText, { color: C.text }]} numberOfLines={1}>{alightName}</Text>
          </View>

          <Pressable
            style={[ts.rideRow, { borderTopColor: isActive ? routeColor + "40" : C.border }]}
            onPress={() => hasSubs && setRideExpanded(v => !v)}
            disabled={!hasSubs}
          >
            <View style={ts.rideLeft}>
              <Text style={[ts.rideText, { color: C.text }, isActive && { color: ORANGE }]}>
                Ride {stopCount} stop{stopCount !== 1 ? "s" : ""}
                {(rideDur || rideDist) ? (
                  <Text style={ts.rideMeta}>{"  ·  "}{rideDur}{rideDur && rideDist ? "  ·  " : ""}{rideDist}</Text>
                ) : null}
              </Text>
            </View>
            {hasSubs && (
              <View style={[ts.chevronPill, { backgroundColor: C.pillBg }]}>
                <Ionicons name={rideExpanded ? "chevron-up" : "chevron-down"} size={12} color={GREY} />
              </View>
            )}
          </Pressable>

          {rideExpanded && hasSubs && <StopsList stops={stops} routeColor={routeColor} />}
        </View>
      </View>

      <View style={ts.row}>
        <View style={ts.rail}>
          <View style={[ts.verticalBar, { backgroundColor: routeColor, height: 10 }]} />
          <View style={[ts.openCircle, { borderColor: routeColor, backgroundColor: C.bg }]} />
        </View>
        <Text style={[ts.stopNameMain, { color: C.text }]}>{alightName}</Text>
      </View>
    </View>
  );
}

const ts = StyleSheet.create({
  wrapper:    { marginBottom: 10 },
  row:        { flexDirection: "row" },
  rail:       { width: RAIL_W, alignItems: "center" },
  verticalBar: { width: 16 },
  busCircle: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
    zIndex: 2, elevation: 2,
  },
  headerText:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 0 },
  stopNameMain:    { fontSize: 16, fontWeight: "500" },
  middleContent:   { flex: 1, paddingVertical: 12 },
  routeInfoRow:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  badge:           { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:       { fontSize: 15, fontWeight: "500" },
  destinationText: { fontSize: 16 },
  rideRow: {
    flexDirection:  "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, marginTop: 10,
  },
  rideLeft:    { flex: 1 },
  rideText:    { fontSize: 15 },
  rideMeta:    { fontSize: 13, color: GREY },
  chevronPill: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  openCircle:  { width: 18, height: 18, borderRadius: 9, borderWidth: 4, marginTop: -6 },
});

// ─── Destination node ─────────────────────────────────────────────────────────

function DestNode({ name }: { name: string }) {
  const dark = useColorScheme() === "dark";
  const textColor = dark ? "#FFFFFF" : BLACK;
  const dotColor  = dark ? "#FFFFFF" : BLACK;
  return (
    <View style={dn.row}>
      <View style={{ width: RAIL_W, alignItems: "center" }}>
        <View style={[dn.dot, { backgroundColor: dotColor }]} />
      </View>
      <Text style={[dn.label, { color: textColor }]}>{name}</Text>
    </View>
  );
}
const dn = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  dot:   { width: 14, height: 14, borderRadius: 7 },
  label: { flex: 1, fontSize: 16, fontWeight: "700" },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

interface RouteStepsListProps {
  steps: Step[];
  stepsOpen: boolean;
  setStepsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  nextPreview: string | null;
  nextStepIdx: number;
  navigating: boolean;
  selectedName: string;
}

export default function RouteStepsList({
  steps,
  nextStepIdx,
  navigating,
  selectedName,
}: RouteStepsListProps) {
  if (steps.length === 0) return null;

  type WalkGroup    = { kind: "walk";    step: Step;                 flatIdx: number };
  type TransitGroup = { kind: "transit"; depart: Step; arrive: Step; flatIdx: number };
  const groups: Array<WalkGroup | TransitGroup> = [];

  let i = 0;
  while (i < steps.length) {
    if (steps[i].type === "depart" && steps[i + 1]?.type === "arrive") {
      groups.push({ kind: "transit", depart: steps[i], arrive: steps[i + 1], flatIdx: i });
      i += 2;
    } else {
      groups.push({ kind: "walk", step: steps[i], flatIdx: i });
      i++;
    }
  }

  const lastGroup = groups[groups.length - 1];

  return (
    <View style={{ paddingTop: 8, paddingBottom: 8 }}>
      <OriginNode />

      {groups.map((g, gi) => {
        if (g.kind === "walk") {
          const isActive = navigating && nextStepIdx === g.flatIdx;
          const isPassed = navigating && nextStepIdx > g.flatIdx;
          return (
            <React.Fragment key={gi}>
              <WalkDots />
              <WalkRow step={g.step} isActive={isActive} isPassed={isPassed} />
              <WalkDots />
            </React.Fragment>
          );
        }

        const { depart, arrive } = g;
        const routeNameMatch = depart.instruction?.match(/^Board Line (.+) at /);
        const routeName  = routeNameMatch?.[1] ?? (depart as any).routeName ?? "";
        const routeColor = (depart as any).routeColor ?? getRouteColor(routeName);
        const stopName   = depart.instruction?.replace(/^Board Line .+ at /, "") ?? "";
        const alightName = arrive.instruction?.replace(/^Alight at /, "") ?? "";
        const isActive   = navigating && (nextStepIdx === g.flatIdx || nextStepIdx === g.flatIdx + 1);
        const isPassed   = navigating && nextStepIdx > g.flatIdx + 1;

        return (
          <TransitSection
            key={gi}
            depart={depart}
            arrive={arrive}
            routeColor={routeColor}
            stopName={stopName}
            alightName={alightName}
            isActive={isActive}
            isPassed={isPassed}
          />
        );
      })}

      {lastGroup?.kind === "transit" && <WalkDots />}
      <DestNode name={selectedName} />
    </View>
  );
}
