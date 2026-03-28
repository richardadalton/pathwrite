import React, { useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { PathShell } from "@daltonr/pathwrite-react-native";
import type { PathShellHandle } from "@daltonr/pathwrite-react-native";
import type { PathData } from "@daltonr/pathwrite-react-native";
import { contactPath, INITIAL_DATA } from "./path";
import type { ContactData } from "./path";
import { ContactStep } from "./ContactStep";

type DemoView = "form" | "success" | "cancelled";

interface Props {
  onBack: () => void;
}

export function FormDemo({ onBack }: Props) {
  const shellRef = useRef<PathShellHandle>(null);
  const [view,          setView]          = useState<DemoView>("form");
  const [submittedData, setSubmittedData] = useState<ContactData | null>(null);

  function handleComplete(data: PathData) {
    setSubmittedData(data as ContactData);
    setView("success");
  }

  function handleCancel() {
    setView("cancelled");
  }

  function sendAnother() {
    setSubmittedData(null);
    setView("form");
    shellRef.current?.restart();
  }

  function tryAgain() {
    setView("form");
    shellRef.current?.restart();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Contact Form</Text>
          <Text style={styles.headerSub}>Validation demo — fieldErrors · fieldWarnings</Text>
        </View>
      </View>

      <View style={styles.card}>
        {view === "form" && (
          <PathShell
            ref={shellRef}
            path={contactPath}
            initialData={INITIAL_DATA}
            completeLabel="Send Message"
            validationDisplay="inline"
            cancelLabel="Discard"
            footerLayout="form"
            onComplete={handleComplete}
            onCancel={handleCancel}
            steps={{
              contact: <ContactStep />,
            }}
          />
        )}

        {view === "success" && submittedData && (
          <ScrollView contentContainerStyle={styles.result}>
            <Text style={styles.resultIcon}>✅</Text>
            <Text style={styles.resultTitle}>Message Sent!</Text>
            <Text style={styles.resultBody}>
              Thanks <Text style={styles.bold}>{submittedData.name}</Text>, we've received
              your message and will get back to you shortly.
            </Text>

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>Email</Text>
                <Text style={styles.summaryValue}>{submittedData.email}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowLast]}>
                <Text style={styles.summaryKey}>Subject</Text>
                <Text style={styles.summaryValue}>{submittedData.subject}</Text>
              </View>
            </View>

            <Pressable style={styles.btnPrimary} onPress={sendAnother}>
              <Text style={styles.btnPrimaryText}>Send Another Message</Text>
            </Pressable>
          </ScrollView>
        )}

        {view === "cancelled" && (
          <ScrollView contentContainerStyle={styles.result}>
            <Text style={styles.resultIcon}>✖</Text>
            <Text style={[styles.resultTitle, styles.resultTitleDark]}>Message Discarded</Text>
            <Text style={styles.resultBody}>Your message was not sent.</Text>

            <Pressable style={styles.btnSecondary} onPress={tryAgain}>
              <Text style={styles.btnSecondaryText}>Try Again</Text>
            </Pressable>
          </ScrollView>
        )}
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
  result: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  resultIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#15803d",
    textAlign: "center",
    marginBottom: 10,
  },
  resultTitleDark: {
    color: "#374151",
  },
  resultBody: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  bold: {
    fontWeight: "700",
    color: "#111827",
  },
  summary: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 28,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f7",
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryKey: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    width: 64,
    flexShrink: 0,
  },
  summaryValue: {
    fontSize: 13,
    color: "#111827",
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnSecondary: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    width: "100%",
    alignItems: "center",
  },
  btnSecondaryText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
});
