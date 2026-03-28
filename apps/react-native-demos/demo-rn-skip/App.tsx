import React, { useRef } from "react";
import { SafeAreaView, StyleSheet, View, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { PathShell } from "@daltonr/pathwrite-react-native";
import type { PathShellHandle } from "@daltonr/pathwrite-react-native";
import { mainPath, INITIAL_DATA } from "./src/demo-path";
import { NameStep }            from "./src/NameStep";
import { CountryStep }         from "./src/CountryStep";
import { AddressUSStep }       from "./src/AddressUSStep";
import { AddressIEStep }       from "./src/AddressIEStep";
import { SkipToggleStep }      from "./src/SkipToggleStep";
import { OptionalStep }        from "./src/OptionalStep";
import { SubwizardIntroStep }  from "./src/SubwizardIntroStep";
import { SubStep1 }            from "./src/SubStep1";
import { SubStep2 }            from "./src/SubStep2";
import { DoneStep }            from "./src/DoneStep";

export default function App() {
  const shellRef = useRef<PathShellHandle>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pathwrite</Text>
        <Text style={styles.headerSub}>Full Feature Demo — React Native</Text>
      </View>

      <View style={styles.card}>
        <PathShell
          ref={shellRef}
          path={mainPath}
          initialData={INITIAL_DATA}
          completeLabel="Finish ✓"
          validationDisplay="inline"
          onComplete={() => shellRef.current?.restart()}
          steps={{
            "name":             <NameStep />,
            "country":          <CountryStep />,
            "address-us":       <AddressUSStep />,
            "address-ie":       <AddressIEStep />,
            "skip-toggle":      <SkipToggleStep />,
            "optional":         <OptionalStep />,
            "subwizard-intro":  <SubwizardIntroStep />,
            "sub-1":            <SubStep1 />,
            "sub-2":            <SubStep2 />,
            "done":             <DoneStep />,
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
