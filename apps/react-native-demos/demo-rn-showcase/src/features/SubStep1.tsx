import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./demo-path";

export function SubStep1() {
  const { snapshot, setData } = usePathContext<DemoData>();
  const notes = snapshot.data.notes ?? "";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sub-Wizard: Step 1</Text>
      <Text style={styles.hint}>You're now inside the sub-wizard. The parent path is paused.</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={notes}
        onChangeText={text => setData("notes", text)}
        placeholder="Type something…"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        autoFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  label: { fontSize: 20, fontWeight: "700", color: "#111827" },
  hint:  { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },
  textarea: { minHeight: 100 },
});
