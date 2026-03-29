import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export function ReviewStep() {
  const { snapshot } = usePathContext<ApplicationData>();
  const data = snapshot!.data;

  return (
    <View style={styles.body}>
      <Text style={styles.intro}>All async checks passed. Review before submitting.</Text>

      <View style={styles.summary}>
        <View style={styles.row}>
          <Text style={styles.key}>Role</Text>
          <Text style={styles.val}>{data.roleId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Experience</Text>
          <Text style={styles.val}>{data.yearsExperience} years</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Skills</Text>
          <Text style={styles.val}>{data.skills as string}</Text>
        </View>
        {data.coverLetter ? (
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.key}>Cover Letter</Text>
            <Text style={styles.val} numberOfLines={3}>{data.coverLetter as string}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body:    { gap: 14 },
  intro:   { fontSize: 13, color: "#6b7280", lineHeight: 20 },
  summary: { borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f8fafc", overflow: "hidden" },
  row:     { flexDirection: "row", gap: 8, padding: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#f1f3f7" },
  rowLast: { borderBottomWidth: 0 },
  key:     { width: 90, fontSize: 13, color: "#6b7280", fontWeight: "500" },
  val:     { flex: 1, fontSize: 13, color: "#1f2937" },
});
