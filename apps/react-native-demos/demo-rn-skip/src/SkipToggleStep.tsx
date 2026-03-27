import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./skip-path";

export function SkipToggleStep() {
  const { snapshot, setData } = usePathContext<DemoData>();
  const skipOptional = snapshot?.data.skipOptional ?? false;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Conditional Steps</Text>
      <Text style={styles.body}>
        The next step has a <Text style={styles.code}>shouldSkip</Text> guard
        that reads from your data. Toggle the switch below and click Next —
        the engine will silently remove that step from the flow. The progress
        indicator updates automatically.
      </Text>

      <View style={styles.toggle}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>Skip the next step</Text>
          <Text style={styles.toggleHint}>
            {skipOptional
              ? "The optional step will be removed from the flow."
              : "The optional step will appear in the flow."}
          </Text>
        </View>
        <Switch
          value={skipOptional}
          onValueChange={(value) => setData("skipOptional", value)}
          trackColor={{ false: "#e5e7eb", true: "#818cf8" }}
          thumbColor={skipOptional ? "#6366f1" : "#9ca3af"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  label: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  body: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 22,
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 4,
    borderRadius: 3,
    fontSize: 13,
    color: "#374151",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  toggleHint: {
    fontSize: 13,
    color: "#6b7280",
  },
});
