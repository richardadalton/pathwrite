import React, { useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { PathShell } from "@daltonr/pathwrite-react-native";

import { services, createApplicationPath, INITIAL_DATA, type ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
import { RoleStep }        from "./RoleStep";
import { ExperienceStep }  from "./ExperienceStep";
import { EligibilityStep } from "./EligibilityStep";
import { CoverLetterStep } from "./CoverLetterStep";
import { ReviewStep }      from "./ReviewStep";

// Path created once — factory closes over the services singleton.
const applicationPath = createApplicationPath(services);

interface Props {
  onBack: () => void;
}

export function AsyncDemo({ onBack }: Props) {
  const [completedData, setCompletedData] = useState<ApplicationData | null>(null);

  if (completedData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Async Features</Text>
            <Text style={styles.headerSub}>
              async guards · async shouldSkip · loadingLabel · services
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.success}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Application Submitted</Text>
            <Text style={styles.successSub}>
              Your application for role{" "}
              <Text style={styles.successBold}>{completedData.roleId}</Text> was received.
            </Text>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => setCompletedData(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>Submit Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Async Features</Text>
          <Text style={styles.headerSub}>
            async guards · async shouldSkip · loadingLabel · services
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <PathShell
          path={applicationPath}
          services={services}
          initialData={INITIAL_DATA}
          completeLabel="Submit Application"
          loadingLabel="Please wait…"
          validationDisplay="inline"
          hideCancel
          onComplete={(data) => setCompletedData(data as ApplicationData)}
          steps={{
            "role":         <RoleStep />,
            "experience":   <ExperienceStep />,
            "eligibility":  <EligibilityStep />,
            "coverLetter":  <CoverLetterStep />,
            "review":       <ReviewStep />,
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
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  card: {
    flex: 1,
    margin: 16,
    marginTop: 0,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  success: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  successIcon: {
    fontSize: 48,
    color: "#15803d",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  successSub: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
  successBold: {
    fontWeight: "700",
    color: "#1f2937",
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
