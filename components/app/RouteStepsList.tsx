// components/app/RouteStepsList.tsx
import { RouteStop, Step, WalkSubStep, getRouteColor, maneuverIcon, mToNice, sToMin } from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ORANGE     = "#FF6F00";
const BLACK      = "#1C1C1E";
const GREY       = "#8E8E93";
const LIGHT_GREY = "#F2F2F7";
const BORDER     = "#E5E5EA";
const BG         = "#FFFFFF";

// Left-rail column width — keeps every node icon pixel-aligned
const RAIL_W = 46;

// ─── Walk connector dots ──────────────────────────────────────────────────────

function WalkDots() {
  return (
    <View style={wd.col}>
      {[0, 1, 2].map((i) => <View key={i} style={wd.dot} />)}
    </View>
  );
}
const wd = StyleSheet.create({
  col: { width: RAIL_W, alignItems: "center", paddingVertical: 4, gap: 6 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#C7C7CC" },
});

// ─── Origin node ──────────────────────────────────────────────────────────────

function OriginNode() {
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <View style={orig.row}>
      <View style={orig.rail}>
        <View style={orig.outerRing}><View style={orig.innerDot} /></View>
      </View>
      <Text style={orig.label}>Your location</Text>
      <Text style={orig.time}>{time}</Text>
    </View>
  );
}
const orig = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  rail:      { width: RAIL_W, alignItems: "center" },
  outerRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFE2C2", // soft tint of #FF6F00
    alignItems: "center",
    justifyContent: "center",
  },
  innerDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#FF6F00", // your base color
  },
  label:     { flex: 1, fontSize: 15, fontWeight: "600", color: BLACK },
  time:      { fontSize: 13, color: GREY },
});

// ─── Walk sub-step ────────────────────────────────────────────────────────────

function SubStep({ sub, isLast }: { sub: WalkSubStep; isLast: boolean }) {
  return (
    <View style={[ss.row, !isLast && ss.divided]}>
      <View style={ss.iconWrap}>
        <Ionicons name={maneuverIcon(sub.maneuver)} size={14} color={GREY} />
      </View>
      <Text style={ss.instruction} numberOfLines={2}>{sub.instruction}</Text>
      {sub.distance > 0 && <Text style={ss.dist}>{mToNice(sub.distance)}</Text>}
    </View>
  );
}
const ss = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  divided:   { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  iconWrap:  {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: LIGHT_GREY, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  instruction: { flex: 1, fontSize: 13, fontWeight: "500", color: BLACK },
  dist:        { fontSize: 12, color: GREY, flexShrink: 0 },
});

// ─── Walk row (expandable sub-steps) ─────────────────────────────────────────

function WalkRow({
  step, isActive, isPassed,
}: { step: Step; isActive: boolean; isPassed: boolean }) {
  const [open, setOpen] = useState(isActive);
  const hasSubs = (step.subSteps?.length ?? 0) > 0;

  return (
    <View style={{ opacity: isPassed ? 0.35 : 1 }}>
      {/* Main walk row */}
      <Pressable
        style={wr.row}
        onPress={() => hasSubs && setOpen((v) => !v)}
        disabled={!hasSubs}
      >
        <View style={wr.rail}>
          <Ionicons name="walk" size={20} color={isActive ? ORANGE : GREY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[wr.walkText, isActive && { color: ORANGE }]}>
            Walk {sToMin(step.duration).replace("~", "")} ({mToNice(step.distance)})
          </Text>
        </View>
        {hasSubs && (
          <View style={wr.chevronPill}>
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={13}
              color={GREY}
            />
          </View>
        )}
        {/* Map button */}
        {/* <View style={wr.mapBtn}>
          <Ionicons name="map-outline" size={17} color="#4A90D9" />
        </View> */}
      </Pressable>

      {/* Sub-steps dropdown */}
      {open && hasSubs && (
        <View style={wr.subContainer}>
          {/* Indent rail spacer */}
          <View style={{ width: RAIL_W }} />
          {/* Card */}
          <View style={wr.subCard}>
            {step.subSteps!.map((sub, j) => (
              <SubStep
                key={j}
                sub={sub}
                isLast={j === step.subSteps!.length - 1}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
const wr = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 5, gap: 6 },
  rail:       { width: RAIL_W, alignItems: "center" },
  walkText:   { fontSize: 15, fontWeight: "500", color: BLACK },
  chevronPill:{
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: LIGHT_GREY, alignItems: "center", justifyContent: "center",
  },
  mapBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EAF4FF", alignItems: "center", justifyContent: "center",
  },
  subContainer: {
    flexDirection: "row",
    paddingBottom: 8,
  },
  subCard: {
    flex: 1,
    backgroundColor: LIGHT_GREY,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginRight: 4,
  },
});

// ─── Transit section ──────────────────────────────────────────────────────────
//
// Layout: left rail (bus circle → colored bar → open circle) runs the FULL
// height of the section, matching Google Maps exactly. The bar is a flex:1
// View that stretches to whatever height the right-side content demands.
//
//  ┌──────────────────────────────────────┐
//  │ [bus○]  Park Inn                  >  │
//  │   ███   [33GTB] Commercial           │
//  │   ███   ▾ Ride 14 stops (17 min)     │
//  │   ───────────────────────────────    │
//  │ [  ○]  Total Jogoo Road/Mogas        │
//  └──────────────────────────────────────┘

// ─── Transit section ──────────────────────────────────────────────────────────

function StopsList({ stops, routeColor }: { stops: RouteStop[]; routeColor: string }) {
  // Show only intermediate stops — boarding/alighting are in the section header/footer
  const intermediate = stops.slice(1, -1);
  if (intermediate.length === 0) return null;

  return (
    <View style={sl.container}>
      {intermediate.map((stop, idx) => (
        <View key={idx} style={sl.row}>
          <View style={sl.track}>
            {idx > 0 && (
              <View style={[sl.line, { backgroundColor: routeColor + "55" }]} />
            )}
            <View style={[sl.dot, { backgroundColor: routeColor }]} />
            {idx < intermediate.length - 1 && (
              <View style={[sl.line, { backgroundColor: routeColor + "55" }]} />
            )}
          </View>
          <Text style={sl.name} numberOfLines={1}>{stop.name}</Text>
        </View>
      ))}
    </View>
  );
}

const sl = StyleSheet.create({
  container: { marginTop: 6, marginBottom: 2 },
  row:   { flexDirection: "row", alignItems: "center", minHeight: 30 },
  track: { width: 22, alignItems: "center", alignSelf: "stretch", justifyContent: "center" },
  dot:   { width: 7, height: 7, borderRadius: 3.5, zIndex: 1 },
  line:  { position: "absolute", top: 0, bottom: 0, width: 2, borderRadius: 1 },
  name:  { flex: 1, fontSize: 13, color: "#555", paddingLeft: 8, paddingVertical: 2 },
});

function TransitSection({
  depart, arrive, routeColor, stopName, alightName, isActive, isPassed,
}: {
  depart: Step; arrive: Step;
  routeColor: string; stopName: string; alightName: string;
  isActive: boolean; isPassed: boolean;
}) {
  const [rideExpanded, setRideExpanded] = useState(false);
  const routeNameMatch = depart.instruction?.match(/^Board Line (.+) at /);
  const routeName = routeNameMatch?.[1] ?? (depart as any).routeName ?? "";

  const stops     = depart.stops ?? [];
  const stopCount = stops.length > 1 ? stops.length - 1 : 1;
  const hasSubs   = stops.length > 2; // at least one intermediate stop

  const rideDur  = arrive ? sToMin(arrive.duration).replace("~", "") : "";
  const rideDist = arrive ? mToNice(arrive.distance) : "";

  return (
    <View style={[ts.wrapper, isPassed && { opacity: 0.35 }]}>

      {/* ── TOP: boarding stop ── */}
      <View style={ts.row}>
        <View style={ts.rail}>
          <View style={[ts.busCircle, { backgroundColor: BG }]}>
            <Ionicons name="bus" size={18} color={BLACK} />
          </View>
          <View style={[ts.verticalBar, { backgroundColor: routeColor, height: 20, marginTop: -2 }]} />
        </View>
        <View style={ts.headerText}>
          <Text style={ts.stopNameMain}>{stopName}</Text>
        </View>
      </View>

      {/* ── MIDDLE: route badge + ride row ── */}
      <View style={ts.row}>
        <View style={ts.rail}>
          <View style={[ts.verticalBar, { backgroundColor: routeColor, flex: 1 }]} />
        </View>
        <View style={ts.middleContent}>
          {/* Route badge + direction */}
          <View style={ts.routeInfoRow}>
            <View style={[ts.badge, { borderColor: routeColor + "60" }]}>
              <Text style={[ts.badgeText, { color: routeColor }]}>{routeName}</Text>
            </View>
            <Text style={ts.destinationText} numberOfLines={1}>{alightName}</Text>
          </View>

          {/* Ride N stops — tappable to show intermediate stops */}
          <Pressable
            style={[ts.rideRow, isActive && { borderTopColor: routeColor + "40" }]}
            onPress={() => hasSubs && setRideExpanded(v => !v)}
            disabled={!hasSubs}
          >
            <View style={ts.rideLeft}>
              <Text style={[ts.rideText, isActive && { color: ORANGE }]}>
                Ride {stopCount} stop{stopCount !== 1 ? "s" : ""}
                {(rideDur || rideDist) ? (
                  <Text style={ts.rideMeta}>
                    {"  ·  "}{rideDur}{rideDur && rideDist ? "  ·  " : ""}{rideDist}
                  </Text>
                ) : null}
              </Text>
            </View>
            {hasSubs && (
              <View style={ts.chevronPill}>
                <Ionicons
                  name={rideExpanded ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={GREY}
                />
              </View>
            )}
          </Pressable>

          {/* Intermediate stops dropdown */}
          {rideExpanded && hasSubs && (
            <StopsList stops={stops} routeColor={routeColor} />
          )}
        </View>
      </View>

      {/* ── BOTTOM: alighting stop ── */}
      <View style={ts.row}>
        <View style={ts.rail}>
          <View style={[ts.verticalBar, { backgroundColor: routeColor, height: 10 }]} />
          <View style={[ts.openCircle, { borderColor: routeColor }]} />
        </View>
        <Text style={ts.stopNameMain}>{alightName}</Text>
      </View>
    </View>
  );
}

const ts = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  row: { flexDirection: "row" },
  rail: { 
    width: RAIL_W, 
    alignItems: "center",
  },
  verticalBar: {
    width: 16, // Thick bar like the screenshot
  },
  busCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 2,
  },
  headerText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 0,
  },
  stopNameMain: {
    fontSize: 16,
    fontWeight: "500",
    color: BLACK,
  },
  middleContent: {
    flex: 1,
    paddingVertical: 12,
  },
  routeInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  badge: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: "500",
    color: BLACK,
  },
  destinationText: {
    fontSize: 16,
    color: BLACK,
  },
  frequencyText: {
    fontSize: 14,
    color: BLACK,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 14,
    color: BLACK,
    marginBottom: 8,
  },
  crowdingSection: {
    marginBottom: 16,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: LIGHT_GREY,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: BLACK,
  },
  rideRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingVertical: 12,
    marginTop: 10,
  },
  rideLeft: { flex: 1 },
  rideText: { fontSize: 15, color: BLACK },
  rideMeta: { fontSize: 13, color: GREY },
  chevronPill: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: LIGHT_GREY,
    alignItems: "center", justifyContent: "center",
    marginLeft: 8,
  },
  openCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 4, // Thick ring
    backgroundColor: BG,
    marginTop: -6,
    // zIndex: 2,
  },
});

// ─── Destination node ─────────────────────────────────────────────────────────

function DestNode({ name }: { name: string }) {
  return (
    <View style={dn.row}>
      <View style={{ width: RAIL_W, alignItems: "center" }}>
        <View style={dn.dot} />
      </View>
      <Text style={dn.label}>{name}</Text>
    </View>
  );
}
const dn = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  dot:   { width: 14, height: 14, borderRadius: 7, backgroundColor: BLACK },
  label: { flex: 1, fontSize: 16, fontWeight: "700", color: BLACK },
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

  // Build groups
  type WalkGroup    = { kind: "walk";    step: Step;                       flatIdx: number };
  type TransitGroup = { kind: "transit"; depart: Step; arrive: Step;       flatIdx: number };
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

        // Transit group
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

      {/* Dots before destination when journey ends on transit */}
      {lastGroup?.kind === "transit" && <WalkDots />}

      <DestNode name={selectedName} />

    </View>
  );
}