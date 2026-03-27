import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DocumentData } from "./types";

export function CreateDocumentStep() {
  const { snapshot, setData } = usePathContext<DocumentData>();
  const data   = snapshot!.data;
  const errors = snapshot!.hasAttemptedNext ? snapshot!.fieldErrors : {};

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Enter the details of the document you want to send for approval.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.title ? styles.inputError : null]}
          value={data.title?.toString() ?? ""}
          onChangeText={text => setData("title", text)}
          placeholder="e.g. Q1 Budget Report"
          autoFocus
          autoCapitalize="words"
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, styles.textarea, errors.description ? styles.inputError : null]}
          value={data.description?.toString() ?? ""}
          onChangeText={text => setData("description", text)}
          placeholder="Brief summary of the document and what needs to be approved..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  intro: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151" },
  required: { color: "#ef4444" },
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
  textarea: { minHeight: 96 },
  inputError: { borderColor: "#ef4444" },
  errorText: { fontSize: 13, color: "#ef4444" },
});
