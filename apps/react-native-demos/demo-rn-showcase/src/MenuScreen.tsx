import React from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

type Screen = "form" | "features";

interface Props {
  onSelect: (screen: Screen) => void;
}

const DEMOS: { id: Screen; title: string; description: string; tag: string }[] = [
  {
    id: "form",
    title: "Contact Form",
    description:
      "Single-step form with field-level validation errors and warnings. " +
      "Demonstrates fieldErrors, fieldWarnings, validationDisplay, and " +
      "the restart() handle.",
    tag: "validation · fieldErrors · restart",
  },
  {
    id: "features",
    title: "Full Features",
    description:
      "Multi-step path showcasing guards (canMoveNext), conditional " +
      "steps (shouldSkip), branching forms (StepChoice), and a nested " +
      "sub-wizard.",
    tag: "guards · shouldSkip · StepChoice · subPath",
  },
];

export function MenuScreen({ onSelect }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pathwrite</Text>
          <Text style={styles.headerSub}>React Native Showcase</Text>
        </View>

        <Text style={styles.sectionLabel}>Pick a demo</Text>

        {DEMOS.map((demo) => (
          <TouchableOpacity
            key={demo.id}
            style={styles.card}
            onPress={() => onSelect(demo.id)}
            activeOpacity={0.75}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{demo.title}</Text>
              <Text style={styles.cardDescription}>{demo.description}</Text>
              <Text style={styles.cardTag}>{demo.tag}</Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f3ff",
  },
  content: {
    padding: 20,
    gap: 12,
  },
  header: {
    paddingVertical: 8,
    marginBottom: 8,
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  cardDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  cardTag: {
    fontSize: 12,
    color: "#6366f1",
    fontWeight: "500",
  },
  cardChevron: {
    fontSize: 24,
    color: "#d1d5db",
    marginTop: -2,
  },
});
