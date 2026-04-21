// components/app/RouteStepsList.tsx
import {
    Step,
    humanizeStep,
    mToNice,
    sToMin,
    stepIcon,
} from "@/utils/mapHelpers";
import { Ionicons } from "@expo/vector-icons";
import { JSX } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const BLACK = "#000000";

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          }}
        >
          <Ionicons name="list-outline" size={18} color={BLACK} />
          <Text style={{ color: BLACK, fontWeight: "600" }}>
            Steps ({steps.length})
          </Text>
          {!stepsOpen && nextPreview && (
            <Text
              numberOfLines={1}
              style={{ color: "#6B7280", marginLeft: 8, flexShrink: 1 }}
            >
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
        <View style={{ gap: 6 }}>
          {steps.map((st, i) => {
            const isLast = i === steps.length - 1;
            const text = humanizeStep(st, i, isLast, selectedName);
            const active = i === nextStepIdx && navigating;
            return (
              <View
                key={i}
                style={[
                  styles.stepRow,
                  active && { backgroundColor: "#FFF", borderRadius: 8 },
                ]}
              >
                <Ionicons
                  name={stepIcon(st.type, st.modifier)}
                  size={18}
                  color={BLACK}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: BLACK }}>
                    <Text style={{ fontWeight: "700" }}>
                      {i === 0 ? "From your location: " : ""}
                    </Text>
                    {text}
                  </Text>
                  <Text style={{ color: "#6B7280", marginTop: 2 }}>
                    {mToNice(st.distance)}{" "}
                    {st.duration ? `• ${sToMin(st.duration)}` : ""}
                  </Text>
                </View>
              </View>
            );
          })}
          {steps[steps.length - 1]?.type === "arrive" && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons name="location-outline" size={16} color={BLACK} />
              <Text style={styles.sub}>
                At the destination, the stage is likely on your{" "}
                <Text style={{ fontWeight: "600", color: BLACK }}>
                  {steps[steps.length - 1]?.modifier ?? "side"}
                </Text>
                .
              </Text>
            </View>
          )}
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  sub: { color: "#6B7280", textAlign: "left" },
});
