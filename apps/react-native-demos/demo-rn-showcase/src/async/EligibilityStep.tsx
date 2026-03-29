import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export function EligibilityStep() {
  const { snapshot } = usePathContext<ApplicationData>();
  const snap = snapshot!;

  // validationDisplay="inline" suppresses the shell's blockingError rendering.
  const blockingError = snap.hasAttemptedNext ? snap.blockingError : null;
  const guardRunning  = snap.status === "validating";

  return (
    <View style={styles.body}>
      <Text style={styles.intro}>
        Tapping <Text style={styles.bold}>Next</Text> runs an async eligibility check (~900ms).
        Watch the loading indicator on the button.
      </Text>

      <View style={styles.summary}>
        <View style={styles.row}>
          <Text style={styles.key}>Role</Text>
          <Text style={styles.val}>{snap.data.roleId || "—"}</Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.key}>Experience</Text>
          <Text style={styles.val}>
            {snap.data.yearsExperience ? `${snap.data.yearsExperience} years` : "—"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Skills</Text>
          <Text style={styles.val}>{snap.data.skills || "—"}</Text>
        </View>
      </View>

      {blockingError ? (
        <Text style={styles.blockingError}>{blockingError}</Text>
      ) : null}

      {!guardRunning ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            <Text style={styles.hintBold}>What's happening: </Text>
            <Text style={styles.code}>canMoveNext</Text> is async — the engine awaits the
            result before deciding whether to advance. While it runs,{" "}
            <Text style={styles.code}>snapshot.status === "validating"</Text> and the shell
            shows a loading indicator. If blocked,{" "}
            <Text style={styles.code}>snapshot.blockingError</Text> is set and we render it
            here (since <Text style={styles.code}>validationDisplay="inline"</Text> suppresses
            the shell's own rendering).
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body:          { gap: 14 },
  intro:         { fontSize: 13, color: "#6b7280", lineHeight: 20 },
  bold:          { fontWeight: "600", color: "#1f2937" },
  summary:       { borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f8fafc", overflow: "hidden" },
  row:           { flexDirection: "row", gap: 8, padding: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#f1f3f7" },
  rowLast:       { borderBottomWidth: 0 },
  key:           { width: 90, fontSize: 13, color: "#6b7280", fontWeight: "500" },
  val:           { flex: 1, fontSize: 13, color: "#1f2937" },
  blockingError: { fontSize: 13, color: "#dc2626", fontWeight: "500" },
  hint:          { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f8fafc" },
  hintText:      { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  hintBold:      { fontWeight: "600", color: "#374151" },
  code:          { fontFamily: "monospace", fontSize: 11, color: "#4f46e5" },
});
