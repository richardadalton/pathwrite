import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, SafeAreaView } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./demo-path";

const IE_COUNTIES = [
  "Carlow","Cavan","Clare","Cork","Donegal","Dublin","Galway","Kerry",
  "Kildare","Kilkenny","Laois","Leitrim","Limerick","Longford","Louth",
  "Mayo","Meath","Monaghan","Offaly","Roscommon","Sligo","Tipperary",
  "Waterford","Westmeath","Wexford","Wicklow",
  "Antrim","Armagh","Down","Fermanagh","Londonderry","Tyrone",
];

export function AddressIEStep() {
  const { snapshot, setData } = usePathContext<DemoData>();
  const county = snapshot.data.county ?? "";
  const [open, setOpen] = useState(false);

  function select(c: string) {
    setData("county", c);
    setOpen(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Irish Address</Text>
      <Text style={styles.hint}>
        Shown because you selected Ireland — this step was chosen by{" "}
        <Text style={styles.code}>StepChoice</Text>.
      </Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>County <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Text style={county ? styles.selectorValue : styles.selectorPlaceholder}>
            {county || "Select a county…"}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={open} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a County</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={IE_COUNTIES}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, item === county && styles.itemSelected]}
                onPress={() => select(item)}
              >
                <Text style={[styles.itemText, item === county && styles.itemTextSelected]}>{item}</Text>
                {item === county && <Text style={styles.itemCheck}>✓</Text>}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  label: { fontSize: 20, fontWeight: "700", color: "#111827" },
  hint:  { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 3,
    borderRadius: 3,
    fontSize: 13,
    color: "#374151",
  },
  field:      { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  required:   { color: "#ef4444" },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  selectorValue:       { fontSize: 15, color: "#111827" },
  selectorPlaceholder: { fontSize: 15, color: "#9ca3af" },
  chevron: { fontSize: 20, color: "#9ca3af", marginTop: -2 },
  modal:       { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  modalTitle:  { fontSize: 17, fontWeight: "700", color: "#111827" },
  modalClose:  { fontSize: 16, color: "#6366f1", fontWeight: "600" },
  item:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  itemSelected: { backgroundColor: "#eef2ff" },
  itemText:         { fontSize: 15, color: "#374151" },
  itemTextSelected: { color: "#4338ca", fontWeight: "600" },
  itemCheck:    { fontSize: 15, color: "#6366f1", fontWeight: "700" },
});
