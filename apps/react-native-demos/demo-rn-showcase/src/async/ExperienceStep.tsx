import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export function ExperienceStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  const snap   = snapshot!;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <View style={styles.body}>
      <Text style={styles.intro}>
        Tell us about your background. The next step will run an async eligibility
        check — try entering <Text style={styles.bold}>less than 2 years</Text> to see
        the guard block navigation.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Years of Relevant Experience</Text>
        <TextInput
          style={[styles.input, errors.yearsExperience ? styles.inputError : null]}
          value={snap.data.yearsExperience}
          onChangeText={v => setData("yearsExperience", v)}
          keyboardType="numeric"
          placeholder="e.g. 3"
          placeholderTextColor="#9ca3af"
        />
        {errors.yearsExperience ? <Text style={styles.error}>{errors.yearsExperience}</Text> : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Key Skills</Text>
        <TextInput
          style={[styles.input, errors.skills ? styles.inputError : null]}
          value={snap.data.skills}
          onChangeText={v => setData("skills", v)}
          placeholder="e.g. TypeScript, React, Node.js"
          placeholderTextColor="#9ca3af"
        />
        {errors.skills ? <Text style={styles.error}>{errors.skills}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body:       { gap: 16 },
  intro:      { fontSize: 13, color: "#6b7280", lineHeight: 20 },
  bold:       { fontWeight: "600", color: "#1f2937" },
  field:      { gap: 6 },
  label:      { fontSize: 14, fontWeight: "600", color: "#374151" },
  input:      { borderWidth: 1, borderColor: "#c2d0e5", borderRadius: 8, padding: 10, fontSize: 14, color: "#1f2937", backgroundColor: "#fff" },
  inputError: { borderColor: "#dc2626" },
  error:      { fontSize: 13, color: "#dc2626" },
});
