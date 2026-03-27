import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ApprovalData } from "./types";

export function DecisionStep() {
  const { snapshot, setData } = usePathContext<ApprovalData>();
  const data   = snapshot!.data;
  const errors = snapshot!.hasAttemptedNext ? snapshot!.fieldErrors : {};

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Reviewing <Text style={styles.bold}>{data.documentTitle?.toString()}</Text> as{" "}
        <Text style={styles.bold}>{data.approverName?.toString()}</Text>.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Your Decision <Text style={styles.required}>*</Text></Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={[styles.radioOption, data.decision === "approved" && styles.radioApproved]}
            onPress={() => setData("decision", "approved")}
            activeOpacity={0.7}
          >
            <View style={[styles.radioCircle, data.decision === "approved" && styles.radioCircleApproved]}>
              {data.decision === "approved" && <View style={styles.radioFill} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={[styles.radioLabel, data.decision === "approved" && styles.radioLabelApproved]}>
                ✓ Approve
              </Text>
              <Text style={styles.radioDesc}>The document is ready to proceed.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.radioOption, data.decision === "rejected" && styles.radioRejected]}
            onPress={() => setData("decision", "rejected")}
            activeOpacity={0.7}
          >
            <View style={[styles.radioCircle, data.decision === "rejected" && styles.radioCircleRejected]}>
              {data.decision === "rejected" && <View style={styles.radioFillRejected} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={[styles.radioLabel, data.decision === "rejected" && styles.radioLabelRejected]}>
                ✗ Reject
              </Text>
              <Text style={styles.radioDesc}>Changes are required before this can proceed.</Text>
            </View>
          </TouchableOpacity>
        </View>
        {errors.decision && <Text style={styles.errorText}>{errors.decision}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Comment <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={data.comment?.toString() ?? ""}
          onChangeText={text => setData("comment", text)}
          placeholder="Add any notes or feedback for the document author..."
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  intro:    { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  bold:     { fontWeight: "700", color: "#374151" },
  field:    { gap: 8 },
  label:    { fontSize: 14, fontWeight: "600", color: "#374151" },
  required: { color: "#ef4444" },
  optional: { fontSize: 13, fontWeight: "400", color: "#9ca3af" },
  radioGroup: { gap: 8 },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  radioApproved: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  radioRejected: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleApproved: { borderColor: "#10b981" },
  radioCircleRejected: { borderColor: "#ef4444" },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
  },
  radioFillRejected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  radioContent: { flex: 1, gap: 2 },
  radioLabel: { fontSize: 15, fontWeight: "600", color: "#374151" },
  radioLabelApproved: { color: "#065f46" },
  radioLabelRejected: { color: "#991b1b" },
  radioDesc: { fontSize: 12, color: "#6b7280" },
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
  textarea: { minHeight: 80 },
  errorText: { fontSize: 13, color: "#ef4444" },
});
