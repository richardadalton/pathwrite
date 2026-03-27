import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./demo-path";

export function NameStep() {
  const { snapshot, setData } = usePathContext<DemoData>();
  const name = snapshot.data.name ?? "";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>What's your name?</Text>
      <Text style={styles.hint}>
        Next unlocks once you've entered at least 2 characters.
        This is a <Text style={styles.code}>canMoveNext</Text> guard.
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(text) => setData("name", text)}
        placeholder="Enter your name…"
        autoFocus
        autoCapitalize="words"
      />
      {name.trim().length > 0 && name.trim().length < 2 && (
        <Text style={styles.error}>One more character…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  label: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  hint: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 4,
    borderRadius: 3,
    fontSize: 13,
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  error: {
    fontSize: 13,
    color: "#ef4444",
  },
});
