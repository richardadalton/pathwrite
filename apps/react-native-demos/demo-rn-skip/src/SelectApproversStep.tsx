import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData } from "./types";

export function SelectApproversStep() {
  const { snapshot, setData } = usePathContext<DocumentData>();
  const data     = snapshot!.data;
  const errors   = snapshot!.hasAttemptedNext ? snapshot!.fieldErrors : {};
  const selected = (data.approvers ?? []) as string[];

  function toggle(id: string) {
    const updated = selected.includes(id)
      ? selected.filter(a => a !== id)
      : [...selected, id];
    setData("approvers", updated);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Choose who needs to approve this document. All selected approvers must review before the workflow can proceed.
      </Text>

      <View style={styles.list}>
        {AVAILABLE_APPROVERS.map(approver => {
          const isSelected = selected.includes(approver.id);
          return (
            <TouchableOpacity
              key={approver.id}
              style={[styles.item, isSelected && styles.itemSelected]}
              onPress={() => toggle(approver.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                  {approver.name.charAt(0)}
                </Text>
              </View>
              <Text style={[styles.name, isSelected && styles.nameSelected]}>{approver.name}</Text>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {errors.approvers && <Text style={styles.errorText}>{errors.approvers}</Text>}

      {selected.length > 0 && (
        <Text style={styles.count}>
          {selected.length} approver{selected.length !== 1 ? "s" : ""} selected
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  intro: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  list: { gap: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  itemSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSelected: { backgroundColor: "#6366f1" },
  avatarText: { fontSize: 15, fontWeight: "700", color: "#6b7280" },
  avatarTextSelected: { color: "#fff" },
  name: { flex: 1, fontSize: 15, color: "#374151" },
  nameSelected: { color: "#4338ca", fontWeight: "600" },
  checkmark: { fontSize: 16, color: "#6366f1", fontWeight: "700" },
  errorText: { fontSize: 13, color: "#ef4444" },
  count: { fontSize: 13, color: "#6366f1", fontWeight: "600" },
});
