import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { DemoData } from "./skip-path";

interface Props {
  onRestart: () => void;
}

export function DoneStep({ onRestart }: Props) {
  const { snapshot } = usePathContext<DemoData>();
  const name = snapshot?.data.name ?? "there";
  const skipped = snapshot?.data.skipOptional;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.label}>Done, {name}!</Text>
      <Text style={styles.body}>
        {skipped
          ? "You skipped the optional step — shouldSkip worked exactly as expected."
          : "You saw the optional step — shouldSkip left it in the flow because the toggle was off."}
      </Text>
      <Text style={styles.body}>
        This path was defined in ~20 lines of plain TypeScript using{" "}
        <Text style={styles.code}>@daltonr/pathwrite-core</Text>. The{" "}
        <Text style={styles.code}>PathShell</Text> and hooks are from{" "}
        <Text style={styles.code}>@daltonr/pathwrite-react-native</Text>.
      </Text>
      <Pressable style={styles.btn} onPress={onRestart}>
        <Text style={styles.btnText}>↩ Start over</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    alignItems: "center",
  },
  emoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  label: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 22,
    textAlign: "center",
  },
  code: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#374151",
  },
  btn: {
    marginTop: 8,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
});
