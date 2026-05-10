// components/app/RouteStepsList.tsx
import {
    Step,
    humanizeStep,
    mToNice,
    sToMin,
    stepIcon,
} from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import React, { JSX } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ORANGE = "#FF6F00";
const BLACK = "#000000";
const GREY = "#8E8E93";
const LIGHT_GREY = "#E5E5EA";

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
  stepsOpen,
  setStepsOpen,
  nextPreview,
  nextStepIdx,
  navigating,
  selectedName,
}: RouteStepsListProps): JSX.Element | null {
  if (steps.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => setStepsOpen((v) => !v)}
        style={styles.stepsHeader}
        accessibilityRole="button"
      >
        <View style={styles.headerLeft}>
          <Ionicons name="list-outline" size={18} color={BLACK} />
          <Text style={styles.headerTitle}>
            Steps ({steps.length})
          </Text>
          {!stepsOpen && nextPreview && (
            <Text numberOfLines={1} style={styles.previewText}>
              {nextPreview}
            </Text>
          )}
        </View>
        <Ionicons
          name={stepsOpen ? "chevron-up-outline" : "chevron-down-outline"}
          size={18}
          color={BLACK}
        />
      </Pressable>

      {stepsOpen && (
        <View style={styles.stepsContainer}>
          {steps.map((st, i) => {
            const isLast = i === steps.length - 1;
            const text = humanizeStep(st); // simplified call based on our mapHelpers update
            const active = i === nextStepIdx && navigating;
            const isPassed = navigating && i < nextStepIdx;

            return (
              <View
                key={i}
                style={[
                  styles.stepRow,
                  isPassed && { opacity: 0.4 }
                ]}
              >
                {/* ICON COLUMN */}
                <View style={styles.iconCol}>
                  <View style={[styles.iconBox, active && { backgroundColor: ORANGE }]}>
                    <Ionicons
                      name={stepIcon(st.type)}
                      size={18}
                      color={active ? "#FFFFFF" : BLACK}
                    />
                  </View>
                  {!isLast && <View style={styles.line} />}
                </View>

                {/* CONTENT COLUMN */}
                <View style={styles.contentCol}>
                  <Text style={[styles.instructionText, active && { color: ORANGE, fontWeight: "700" }]}>
                    {text}
                  </Text>
                  
                  {(st.distance > 0 || st.duration > 0) && (
                    <Text style={styles.metricsText}>
                      {mToNice(st.distance)} {st.duration ? `• ${sToMin(st.duration)}` : ""}
                    </Text>
                  )}

                  {/* TURN-BY-TURN SUB-STEPS FOR WALKING */}
                  {st.subSteps && st.subSteps.length > 0 && !isPassed && (
                    <View style={styles.subStepsContainer}>
                      {st.subSteps.map((sub: any, j: number) => (
                        <View key={j} style={styles.subStepRow}>
                          <Ionicons name="arrow-forward" size={14} color={GREY} style={{ marginRight: 8, marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.subStepInstruction}>{sub.instruction}</Text>
                            {sub.distance > 0 && (
                              <Text style={styles.subStepDistance}>{mToNice(sub.distance)}</Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LIGHT_GREY,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  headerTitle: { color: BLACK, fontWeight: "600", fontSize: 15 },
  previewText: { color: GREY, marginLeft: 8, flexShrink: 1, fontSize: 14 },
  stepsContainer: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  stepRow: {
    flexDirection: "row",
    minHeight: 60,
  },
  iconCol: {
    width: 32,
    alignItems: "center",
    marginRight: 16,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: LIGHT_GREY,
    marginTop: -4,
    marginBottom: -4,
  },
  contentCol: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 24,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "600",
    color: BLACK,
  },
  metricsText: {
    fontSize: 14,
    color: GREY,
    marginTop: 4,
  },
  subStepsContainer: {
    marginTop: 12,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  subStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  subStepInstruction: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  subStepDistance: {
    fontSize: 12,
    color: GREY,
    marginTop: 2,
  }
});