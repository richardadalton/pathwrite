import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet, SafeAreaView } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./demo-path";

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

export function AddressUSStep() {
  const { snapshot, setData } = usePathContext<DemoData>();
  const state = snapshot.data.state ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = US_STATES.filter(s => s.toLowerCase().includes(query.toLowerCase()));

  function select(s: string) {
    setData("state", s);
    setOpen(false);
    setQuery("");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>US Address</Text>
      <Text style={styles.hint}>
        Shown because you selected the US — this step was chosen by{" "}
        <Text style={styles.code}>StepChoice</Text>.
      </Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>State <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Text style={state ? styles.selectorValue : styles.selectorPlaceholder}>
            {state || "Select a state…"}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={open} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a State</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setQuery(""); }}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            autoFocus
            clearButtonMode="while-editing"
          />
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, item === state && styles.itemSelected]}
                onPress={() => select(item)}
              >
                <Text style={[styles.itemText, item === state && styles.itemTextSelected]}>{item}</Text>
                {item === state && <Text style={styles.itemCheck}>✓</Text>}
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
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f9fafb",
  },
  item:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  itemSelected: { backgroundColor: "#eef2ff" },
  itemText:         { fontSize: 15, color: "#374151" },
  itemTextSelected: { color: "#4338ca", fontWeight: "600" },
  itemCheck:    { fontSize: 15, color: "#6366f1", fontWeight: "700" },
});
