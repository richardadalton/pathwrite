import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./demo-path";

export function SubStep2() {
  const { snapshot } = usePathContext<DemoData>();
  const notes = snapshot.data.notes ?? "";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sub-Wizard: Step 2</Text>
      <Text style={styles.body}>
        Last step of the sub-wizard. Tap Finish to complete it — the parent
        path will resume from where it left off.
      </Text>
      {notes.trim().length > 0 && (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Your notes</Text>
          <Text style={styles.noteText}>{notes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  label: { fontSize: 20, fontWeight: "700", color: "#111827" },
  body:  { fontSize: 14, color: "#6b7280", lineHeight: 22 },
  noteBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  noteLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 },
  noteText:  { fontSize: 14, color: "#374151", lineHeight: 20 },
});
