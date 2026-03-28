import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./demo-path";

export function DoneStep() {
  const { snapshot } = usePathContext<DemoData>();
  const name = snapshot.data.name ?? "there";

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.label}>Done, {name}!</Text>
      <Text style={styles.body}>
        You've completed the full demo — guards, StepChoice, conditional skipping,
        and a sub-wizard, all in one path.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    alignItems: "center",
  },
  emoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  label: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 22,
    textAlign: "center",
  },
});
