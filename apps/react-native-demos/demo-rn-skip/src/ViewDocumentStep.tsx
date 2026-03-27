import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ApprovalData } from "./types";

export function ViewDocumentStep() {
  const { snapshot } = usePathContext<ApprovalData>();
  const data = snapshot!.data;

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Reviewing as <Text style={styles.bold}>{data.approverName?.toString()}</Text>.{" "}
        Please read the document carefully before making your decision.
      </Text>

      <View style={styles.docCard}>
        <Text style={styles.docLabel}>Document</Text>
        <Text style={styles.docTitle}>{data.documentTitle?.toString()}</Text>
        <Text style={styles.docBody}>{data.documentDescription?.toString()}</Text>
      </View>

      <Text style={styles.note}>
        Tap <Text style={styles.bold}>Next</Text> to record your decision, or{" "}
        <Text style={styles.bold}>Previous</Text> to return to the approvals list.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  intro:  { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  bold:   { fontWeight: "700", color: "#374151" },
  docCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  docLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 },
  docTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  docBody:  { fontSize: 14, color: "#374151", lineHeight: 22 },
  note: { fontSize: 13, color: "#9ca3af", lineHeight: 18 },
});
