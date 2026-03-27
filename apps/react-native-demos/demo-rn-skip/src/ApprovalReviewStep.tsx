import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import { approvalSubPath, AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApprovalData, ApproverResult } from "./types";

export function ApprovalReviewStep() {
  const { snapshot, startSubPath } = usePathContext<DocumentData>();
  const data    = snapshot!.data;
  const errors  = snapshot!.hasAttemptedNext ? snapshot!.fieldErrors : {};
  const results = (data.approvalResults ?? {}) as Record<string, ApproverResult>;

  const selectedApprovers = AVAILABLE_APPROVERS.filter(a =>
    (data.approvers as string[]).includes(a.id)
  );

  const allDone = selectedApprovers.length > 0 &&
    selectedApprovers.every(a => !!results[a.id]?.decision);

  function launchReview(approverId: string, approverName: string) {
    const initialData: ApprovalData = {
      approverId,
      approverName,
      documentTitle:       data.title?.toString()       ?? "",
      documentDescription: data.description?.toString() ?? "",
      decision: "",
      comment:  "",
    };
    startSubPath(approvalSubPath, initialData, { approverId });
  }

  return (
    <View style={styles.container}>
      <View style={styles.docCard}>
        <Text style={styles.docLabel}>Document</Text>
        <Text style={styles.docTitle}>{data.title?.toString()}</Text>
        <Text style={styles.docDesc}>{data.description?.toString()}</Text>
      </View>

      <Text style={styles.sectionLabel}>Approvers</Text>

      <View style={styles.list}>
        {selectedApprovers.map(approver => {
          const result = results[approver.id];
          return (
            <View key={approver.id} style={styles.row}>
              <View style={[styles.avatar, result ? (result.decision === "approved" ? styles.avatarApproved : styles.avatarRejected) : styles.avatarPending]}>
                <Text style={styles.avatarText}>{approver.name.charAt(0)}</Text>
              </View>
              <Text style={styles.approverName}>{approver.name}</Text>
              {result ? (
                <View style={[styles.badge, result.decision === "approved" ? styles.badgeApproved : styles.badgeRejected]}>
                  <Text style={[styles.badgeText, result.decision === "approved" ? styles.badgeTextApproved : styles.badgeTextRejected]}>
                    {result.decision === "approved" ? "✓ Approved" : "✗ Rejected"}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.reviewBtn, snapshot!.isNavigating && styles.reviewBtnDisabled]}
                  onPress={() => launchReview(approver.id, approver.name)}
                  disabled={snapshot!.isNavigating}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reviewBtnText}>Review →</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {snapshot!.hasAttemptedNext && errors._ && (
        <Text style={styles.gateMessage}>⏳ {errors._}</Text>
      )}
      {allDone && (
        <Text style={[styles.gateMessage, styles.gateMessageDone]}>
          ✓ All approvers have responded. Tap Next to continue.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  docCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  docLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 },
  docTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  docDesc:  { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#374151" },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPending:  { backgroundColor: "#e5e7eb" },
  avatarApproved: { backgroundColor: "#d1fae5" },
  avatarRejected: { backgroundColor: "#fee2e2" },
  avatarText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  approverName: { flex: 1, fontSize: 14, color: "#374151" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeApproved: { backgroundColor: "#d1fae5" },
  badgeRejected: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextApproved: { color: "#065f46" },
  badgeTextRejected: { color: "#991b1b" },
  reviewBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reviewBtnDisabled: { opacity: 0.5 },
  reviewBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  gateMessage: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  gateMessageDone: { color: "#059669", fontWeight: "600" },
});
