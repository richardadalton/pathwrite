import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ContactData } from "./path";

export function ContactStep() {
  const { snapshot, setData } = usePathContext<ContactData>();
  const data     = snapshot.data;
  const errors   = snapshot.hasAttemptedNext ? (snapshot.fieldErrors ?? {}) : {};
  const warnings = snapshot.fieldWarnings ?? {};

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Fill in your details below and we'll get back to you as soon as possible.
      </Text>

      {/* Name */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.name ? styles.inputError : undefined]}
          value={data.name ?? ""}
          onChangeText={text => setData("name", text)}
          placeholder="Your full name"
          autoCapitalize="words"
          autoCorrect={false}
        />
        {errors.name   && <Text style={styles.error}>{errors.name}</Text>}
      </View>

      {/* Email */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Email <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.email ? styles.inputError : undefined]}
          value={data.email ?? ""}
          onChangeText={text => setData("email", text)}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errors.email   && <Text style={styles.error}>{errors.email}</Text>}
        {!errors.email && warnings.email && (
          <Text style={styles.warning}>{warnings.email as string}</Text>
        )}
      </View>

      {/* Subject */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Subject <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.subject ? styles.inputError : undefined]}
          value={data.subject ?? ""}
          onChangeText={text => setData("subject", text)}
          placeholder="What's this about?"
          autoCorrect={false}
        />
        {errors.subject && <Text style={styles.error}>{errors.subject}</Text>}
      </View>

      {/* Message */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Message <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.textarea, errors.message ? styles.inputError : undefined]}
          value={data.message ?? ""}
          onChangeText={text => setData("message", text)}
          placeholder="Tell us how we can help… (min. 10 characters)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          autoCorrect
        />
        {errors.message   && <Text style={styles.error}>{errors.message}</Text>}
        {!errors.message && warnings.message && (
          <Text style={styles.warning}>{warnings.message as string}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  intro: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  required: {
    color: "#dc2626",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  textarea: {
    minHeight: 100,
    paddingTop: 11,
  },
  inputError: {
    borderColor: "#dc2626",
  },
  error: {
    fontSize: 13,
    color: "#dc2626",
    lineHeight: 18,
  },
  warning: {
    fontSize: 13,
    color: "#b45309",
    lineHeight: 18,
  },
});
