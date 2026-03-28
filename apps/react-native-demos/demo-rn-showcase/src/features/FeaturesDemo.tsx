import React, { useRef } from "react";
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { PathShell } from "@daltonr/pathwrite-react-native";
import type { PathShellHandle } from "@daltonr/pathwrite-react-native";
import { mainPath, INITIAL_DATA } from "./demo-path";
import { NameStep }            from "./NameStep";
import { CountryStep }         from "./CountryStep";
import { AddressUSStep }       from "./AddressUSStep";
import { AddressIEStep }       from "./AddressIEStep";
import { SkipToggleStep }      from "./SkipToggleStep";
import { OptionalStep }        from "./OptionalStep";
import { SubwizardIntroStep }  from "./SubwizardIntroStep";
import { SubStep1 }            from "./SubStep1";
import { SubStep2 }            from "./SubStep2";
import { DoneStep }            from "./DoneStep";

interface Props {
  onBack: () => void;
}

export function FeaturesDemo({ onBack }: Props) {
  const shellRef = useRef<PathShellHandle>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Full Features</Text>
          <Text style={styles.headerSub}>guards · shouldSkip · StepChoice · subPath</Text>
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    fontSize: 18,
    color: "#4f46e5",
    fontWeight: "600",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#4f46e5",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 1,
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
