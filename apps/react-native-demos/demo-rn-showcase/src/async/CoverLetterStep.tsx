import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export function CoverLetterStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  const snap   = snapshot!;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <View style={styles.body}>
      <Text style={styles.intro}>
        This step uses an async <Text style={styles.code}>shouldSkip</Text>. Selecting{" "}
        <Text style={styles.bold}>Software Engineer</Text> or{" "}
        <Text style={styles.bold}>Data Scientist</Text> routes here; other roles skip
        straight to Review. The step count updates once the skip resolves.
      </Text>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Cover Letter</Text>
          <Text style={[
            styles.charCount,
            (snap.data.coverLetter as string).trim().length > 0 && (snap.data.coverLetter as string).trim().length < 20
              ? styles.charCountWarn
              : (snap.data.coverLetter as string).trim().length >= 20
                ? styles.charCountOk
                : null
          ]}>
            {(snap.data.coverLetter as string).trim().length} / 20
          </Text>
        </View>
        <TextInput
          style={[styles.textarea, errors.coverLetter ? styles.inputError : null]}
          value={snap.data.coverLetter as string}
          onChangeText={v => setData("coverLetter", v)}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          placeholder="Tell us why you're a great fit for this role…"
          placeholderTextColor="#9ca3af"
        />
        {errors.coverLetter ? <Text style={styles.error}>{errors.coverLetter}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body:       { gap: 16 },
  intro:      { fontSize: 13, color: "#6b7280", lineHeight: 20 },
  bold:       { fontWeight: "600", color: "#1f2937" },
  code:       { fontFamily: "monospace", fontSize: 12, color: "#4f46e5" },
  field:      { gap: 6 },
  labelRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label:      { fontSize: 14, fontWeight: "600", color: "#374151" },
  charCount:  { fontSize: 12, color: "#9ca3af" },
  charCountWarn: { color: "#d97706" },
  charCountOk:   { color: "#15803d" },
  textarea:   { borderWidth: 1, borderColor: "#c2d0e5", borderRadius: 8, padding: 10, fontSize: 14, color: "#1f2937", backgroundColor: "#fff", minHeight: 120 },
  inputError: { borderColor: "#dc2626" },
  error:      { fontSize: 13, color: "#dc2626" },
});
