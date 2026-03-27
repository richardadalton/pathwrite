import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApproverResult } from "./types";

export function SummaryStep() {
  const { snapshot } = usePathContext<DocumentData>();
  const data    = snapshot!.data;
  const results = (data.approvalResults ?? {}) as Record<string, ApproverResult>;

  const selectedApprovers = AVAILABLE_APPROVERS.filter(a =>
    (data.approvers as string[]).includes(a.id)
  );

  const allApproved = selectedApprovers.every(a => results[a.id]?.decision === "approved");
  const anyRejected = selectedApprovers.some(a  => results[a.id]?.decision === "rejected");
  const status = allApproved ? "approved" : anyRejected ? "rejected" : "mixed";

  return (
    <View style={styles.container}>
      <View style={[styles.banner, status === "approved" ? styles.bannerApproved : styles.bannerRejected]}>
        <Text style={styles.bannerIcon}>
          {status === "approved" ? "✓" : "✗"}
        </Text>
        <Text style={[styles.bannerText, status === "approved" ? styles.bannerTextApproved : styles.bannerTextRejected]}>
          {status === "approved" && "All approvers approved the document."}
          {status === "rejected" && "One or more approvers rejected the document."}
          {status === "mixed"    && "Mixed results — review comments below."}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Document</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.key}>Title</Text>
            <Text style={styles.value}>{data.title?.toString()}</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.key}>Description</Text>
            <Text style={styles.value}>{data.description?.toString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Approver Decisions</Text>
        <View style={styles.card}>
          {selectedApprovers.map((approver, i) => {
            const result = results[approver.id];
            const isLast = i === selectedApprovers.length - 1;
            return (
              <View key={approver.id} style={[styles.approverRow, isLast && styles.rowLast]}>
                <View style={[styles.avatar, result?.decision === "approved" ? styles.avatarApproved : styles.avatarRejected]}>
                  <Text style={styles.avatarText}>{approver.name.charAt(0)}</Text>
                </View>
                <View style={styles.approverContent}>
                  <Text style={styles.approverName}>{approver.name}</Text>
                  {result?.comment ? (
                    <Text style={styles.comment}>"{result.comment}"</Text>
                  ) : null}
                </View>
                <View style={[styles.badge, result?.decision === "approved" ? styles.badgeApproved : styles.badgeRejected]}>
                  <Text style={[styles.badgeText, result?.decision === "approved" ? styles.badgeTextApproved : styles.badgeTextRejected]}>
                    {result?.decision === "approved" ? "✓" : "✗"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerApproved: { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" },
  bannerRejected: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  bannerIcon: { fontSize: 18, fontWeight: "700" },
  bannerText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  bannerTextApproved: { color: "#065f46" },
  bannerTextRejected: { color: "#991b1b" },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  rowLast: { borderBottomWidth: 0 },
  key:   { fontSize: 13, fontWeight: "600", color: "#9ca3af", width: 90 },
  value: { flex: 1, fontSize: 13, color: "#374151" },
  approverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarApproved: { backgroundColor: "#d1fae5" },
  avatarRejected: { backgroundColor: "#fee2e2" },
  avatarText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  approverContent: { flex: 1, gap: 2 },
  approverName: { fontSize: 14, color: "#374151", fontWeight: "500" },
  comment: { fontSize: 12, color: "#6b7280", fontStyle: "italic" },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeApproved: { backgroundColor: "#d1fae5" },
  badgeRejected: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 13, fontWeight: "700" },
  badgeTextApproved: { color: "#065f46" },
  badgeTextRejected: { color: "#991b1b" },
});
