// app/(tabs)/contribute.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Context-specific colors
const ORANGE = "#FF6F00";
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const BORDER = "#E5E7EB";
const SUBTEXT = "#6B7280";
const BG_LIGHT_GREY = "#F3F4F6";
const BG_SOFT_ORANGE = "#FFF7ED";
const SUCCESS_GREEN = "#10B981";
const BG_SUCCESS_LIGHT = "#ECFDF5";

const ACTIONS = [
  { id: "1", label: "Add route", icon: "bus-outline" as const },
  { id: "2", label: "Add stage", icon: "location-outline" as const },
  { id: "3", label: "Add review", icon: "chatbubble-ellipses-outline" as const },
  { id: "4", label: "Add photo", icon: "camera-outline" as const },
  { id: "5", label: "Fix info", icon: "create-outline" as const },
];

const TASKS = [
  { id: "1", label: "Add 2 photos", status: "1/2", done: false },
  { id: "2", label: "Verify 2 routes", status: "", done: true },
  { id: "3", label: "Answer 2 questions", status: "", done: true },
];

export default function ContributeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View  style={styles.header}>
        <Text style={styles.headerTitle}>Contribute</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── User Profile & Progress ── */}
        <View style={styles.profileSection}>
          <View style={styles.profileRow}>
            <Image
              source={{ uri: "https://i.pravatar.cc/100?img=11" }} // Placeholder
              style={styles.avatar}
            />
            <View>
              <Text style={styles.userName}>Arden BOUET</Text>
              <Text style={styles.userLevel}>Safiri Guide Level 3</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: "70%" }]} />
            </View>
            <Ionicons name="sparkles" size={24} color={ORANGE} style={styles.sparkleIcon} />
          </View>
          <Text style={styles.progressText}>128 points away from Level 4</Text>
        </View>

        {/* ── Horizontal Actions ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsScroll}
        >
          {ACTIONS.map((action) => (
            <Pressable key={action.id} style={styles.actionItem}>
              <View style={styles.actionIconCircle}>
                <Ionicons name={action.icon} size={24} color={ORANGE} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Badge Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.cardTitle}>Earn your Route Pioneer badge</Text>
              <Text style={styles.cardSubtitle}>
                Get started by making these simple updates
              </Text>
            </View>
            <Ionicons name="medal" size={48} color={ORANGE} style={{ opacity: 0.8 }} />
          </View>

          <View style={styles.tasksContainer}>
            {TASKS.map((task, index) => (
              <Pressable
                key={task.id}
                style={[
                  styles.taskRow,
                  task.done && styles.taskRowDone,
                  index !== 0 && { marginTop: 8 },
                ]}
              >
                <Text style={[styles.taskLabel, task.done && styles.taskLabelDone]}>
                  {task.label}
                </Text>
                {task.done ? (
                  <Ionicons name="checkmark" size={20} color={SUCCESS_GREEN} />
                ) : (
                  <View style={styles.taskRight}>
                    <Text style={styles.taskStatus}>{task.status}</Text>
                    <Ionicons name="chevron-forward" size={16} color={SUBTEXT} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Suggestions Section ── */}
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>
              Places are based on your trips, location, and more
            </Text>
            <Ionicons name="help-circle-outline" size={16} color={SUBTEXT} />
          </View>

          <View style={styles.suggestionItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionName}>Kencom Stage</Text>
              <Text style={styles.suggestionSub}>You visited 5 days ago</Text>
            </View>
            <Pressable style={styles.moreBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color={BLACK} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    position: "absolute"
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: BLACK,
    letterSpacing: -0.5,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BG_LIGHT_GREY,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: BLACK,
  },
  userLevel: {
    fontSize: 14,
    color: SUBTEXT,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: BG_SOFT_ORANGE,
    borderRadius: 3,
    marginRight: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: ORANGE,
    borderRadius: 3,
  },
  sparkleIcon: {
    marginTop: -2,
  },
  progressText: {
    fontSize: 13,
    color: SUBTEXT,
  },
  actionsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 20,
  },
  actionItem: {
    alignItems: "center",
    width: 64,
  },
  actionIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: BG_SOFT_ORANGE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FFEDD5", // slightly darker than bg
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
  card: {
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flex: 1,
    paddingRight: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: BLACK,
    marginBottom: 6,
    lineHeight: 24,
  },
  cardSubtitle: {
    fontSize: 14,
    color: SUBTEXT,
    lineHeight: 20,
  },
  tasksContainer: {
    gap: 8,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  taskRowDone: {
    backgroundColor: BG_SUCCESS_LIGHT,
    borderColor: "transparent",
  },
  taskLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: BLACK,
  },
  taskLabelDone: {
    color: SUCCESS_GREEN,
  },
  taskRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taskStatus: {
    fontSize: 14,
    color: SUBTEXT,
  },
  suggestionsSection: {
    paddingHorizontal: 16,
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 13,
    color: SUBTEXT,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: "500",
    color: BLACK,
    marginBottom: 2,
  },
  suggestionSub: {
    fontSize: 14,
    color: SUBTEXT,
  },
  moreBtn: {
    padding: 8,
  },
});