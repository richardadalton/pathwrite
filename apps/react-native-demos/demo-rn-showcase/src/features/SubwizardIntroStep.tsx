import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import { subPath } from "./demo-path";
import type { DemoData } from "./demo-path";

export function SubwizardIntroStep() {
  const { snapshot, startSubPath } = usePathContext<DemoData>();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sub-Wizard</Text>
      <Text style={styles.body}>
        Tap the button to launch a nested sub-wizard. The parent path pauses
        and resumes automatically when the sub-wizard completes or is cancelled.
      </Text>
      <TouchableOpacity
        style={[styles.btn, snapshot.isNavigating && styles.btnDisabled]}
        onPress={() => startSubPath(subPath, {})}
        disabled={snapshot.isNavigating}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>Launch sub-wizard →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  label: { fontSize: 20, fontWeight: "700", color: "#111827" },
  body:  { fontSize: 14, color: "#6b7280", lineHeight: 22 },
  btn: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
