import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
import type { ApplicationServices, Role } from "@daltonr/pathwrite-demo-workflow-job-application";

export function RoleStep() {
  const { snapshot, setData, services } = usePathContext<ApplicationData, ApplicationServices>();
  const snap   = snapshot!;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  const [roles, setRoles]     = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    services.getRoles().then(r => {
      setRoles(r);
      setLoading(false);
    });
  }, []);

  return (
    <View style={styles.body}>
      <Text style={styles.intro}>
        Roles are loaded from the service inside the step —{" "}
        <Text style={styles.code}>usePathContext&lt;TData, TServices&gt;()</Text>{" "}
        returns <Text style={styles.code}>services</Text> alongside{" "}
        <Text style={styles.code}>snapshot</Text>.
      </Text>

      <Text style={styles.label}>Open Position</Text>

      {loading ? (
        <View style={styles.skeleton}>
          <ActivityIndicator size="small" color="#9ca3af" />
          <Text style={styles.skeletonText}>Loading roles…</Text>
        </View>
      ) : (
        <View style={styles.roleList}>
          {roles.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.roleOption, snap.data.roleId === r.id && styles.roleOptionSelected]}
              onPress={() => setData("roleId", r.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.radio, snap.data.roleId === r.id && styles.radioSelected]} />
              <Text style={styles.roleLabel}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {errors.roleId ? <Text style={styles.error}>{errors.roleId}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body:                { gap: 12 },
  intro:               { fontSize: 13, color: "#6b7280", lineHeight: 20 },
  code:                { fontFamily: "monospace", fontSize: 12, color: "#4f46e5", backgroundColor: "#eef2ff" },
  label:               { fontSize: 14, fontWeight: "600", color: "#374151" },
  skeleton:            { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 8, backgroundColor: "#f3f4f6" },
  skeletonText:        { fontSize: 14, color: "#9ca3af" },
  roleList:            { gap: 8 },
  roleOption:          { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  roleOptionSelected:  { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  radio:               { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#d1d5db" },
  radioSelected:       { borderColor: "#2563eb", backgroundColor: "#2563eb" },
  roleLabel:           { fontSize: 14, color: "#374151" },
  error:               { fontSize: 13, color: "#dc2626" },
});
