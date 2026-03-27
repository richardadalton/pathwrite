import React, { useState } from "react";
import { SafeAreaView, StyleSheet, View, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PathShell } from "@daltonr/pathwrite-react-native";
import { skipPath, INITIAL_DATA } from "./src/skip-path";
import { NameStep } from "./src/NameStep";
import { SkipToggleStep } from "./src/SkipToggleStep";
import { OptionalStep } from "./src/OptionalStep";
import { DoneStep } from "./src/DoneStep";

export default function App() {
  const [completed, setCompleted] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  function handleRestart() {
    setCompleted(false);
    setRestartKey((k) => k + 1);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pathwrite</Text>
        <Text style={styles.headerSub}>Conditional Steps — React Native Demo</Text>
      </View>

      <View style={styles.card}>
        <PathShell
          key={restartKey}
          path={skipPath}
          initialData={INITIAL_DATA}
          onComplete={() => setCompleted(true)}
          steps={{
            name:         <NameStep />,
            "skip-toggle": <SkipToggleStep />,
            optional:     <OptionalStep />,
            done:         <DoneStep onRestart={handleRestart} />,
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f3ff",
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#4f46e5",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  card: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: "hidden",
  },
});
