import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function OptionalStep() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>You chose not to skip</Text>
      <Text style={styles.body}>
        Because you left the toggle off, <Text style={styles.code}>shouldSkip</Text> returned{" "}
        <Text style={styles.code}>false</Text> and this step remained in the flow.
      </Text>
      <Text style={styles.body}>
        Go back, turn the toggle on, and click Next — this step will disappear
        entirely. The step count in the progress indicator will drop by one.
      </Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 <Text style={styles.infoLabel}>shouldSkip</Text> is evaluated every time the
          engine approaches this step, so it always reflects the current data.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
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
  infoBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#6366f1",
  },
  infoText: {
    fontSize: 14,
    color: "#3730a3",
    lineHeight: 20,
  },
  infoLabel: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "600",
  },
});
