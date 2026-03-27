import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./demo-path";

const COUNTRIES = [
  { id: "US", label: "🇺🇸  United States" },
  { id: "IE", label: "🇮🇪  Ireland" },
];

export function CountryStep() {
  const { snapshot, setData } = usePathContext<DemoData>();
  const country = snapshot.data.country ?? "";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Country</Text>
      <Text style={styles.hint}>
        Select your country — the next step will show the matching address form
        via <Text style={styles.code}>StepChoice</Text>.
      </Text>
      <View style={styles.options}>
        {COUNTRIES.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.option, country === c.id && styles.optionSelected]}
            onPress={() => setData("country", c.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionText, country === c.id && styles.optionTextSelected]}>
              {c.label}
            </Text>
            {country === c.id && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  label:  { fontSize: 20, fontWeight: "700", color: "#111827" },
  hint:   { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 3,
    borderRadius: 3,
    fontSize: 13,
    color: "#374151",
  },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  optionSelected: { borderColor: "#6366f1", backgroundColor: "#eef2ff" },
  optionText: { fontSize: 17, color: "#374151" },
  optionTextSelected: { color: "#4338ca", fontWeight: "600" },
  check: { fontSize: 16, color: "#6366f1", fontWeight: "700" },
});
