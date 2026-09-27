/**
 * UGC moderation — server-side. Spec docs/features/ugc-moderation.md
 * (App Store Guideline 1.2: report + block + take-action-on-reports).
 *
 * `reports/{reportId}` is write-only from the client (see firestore.rules —
 * no client read/update). This module is the ONLY thing that reads reports
 * and acts on them: it bumps the target's denormalised `reportCount` and
 * flips `hidden = true` once it crosses REPORT_HIDE_THRESHOLD, then writes
 * a `moderationAudit/{reportId}` doc so the developer can review what
 * happened via the Firestore console (no admin dashboard in v1 — spec §不做).
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";

export const REPORT_HIDE_THRESHOLD = 3;

export type ReportDoc = {
  reporterUid: string;
  targetType: "post" | "comment" | "user";
  targetId: string;
  targetAuthorUid: string;
  postId?: string;
  reason: string;
  note?: string;
  status: string;
};

export type ActOnReportResult = {
  reportId: string;
  action: "hidden" | "logged";
  reportCount: number | null;
};

/** Resolve the Firestore ref of the content a report targets, or null for
 *  targetType "user" (no content doc to hide — logged for manual review). */
function targetContentRef(db: Firestore, report: ReportDoc) {
  if (report.targetType === "post") return db.doc(`posts/${report.targetId}`);
  if (report.targetType === "comment" && report.postId) {
    return db.doc(`posts/${report.postId}/comments/${report.targetId}`);
  }
  return null;
}

/** Increment reportCount on the target content and hide it once the count
 *  reaches REPORT_HIDE_THRESHOLD, then write an audit doc. Idempotent-ish:
 *  re-running for the same report would double-count, but onReportCreated
 *  only fires once per report doc (Firestore onCreate). */
export async function actOnReport(
  db: Firestore,
  reportId: string,
  report: ReportDoc,
): Promise<ActOnReportResult> {
  const ref = targetContentRef(db, report);
  let action: ActOnReportResult["action"] = "logged";
  let reportCount: number | null = null;

  if (ref) {
    reportCount = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null; // content already deleted
      const current = Number(snap.data()?.reportCount) || 0;
      const next = current + 1;
      const patch: Record<string, unknown> = { reportCount: next };
      if (next >= REPORT_HIDE_THRESHOLD) patch.hidden = true;
      tx.update(ref, patch);
      return next;
    });
    if (reportCount !== null && reportCount >= REPORT_HIDE_THRESHOLD) {
      action = "hidden";
    }
  }

  await db.doc(`moderationAudit/${reportId}`).set({
    reportId,
    targetType: report.targetType,
    targetId: report.targetId,
    targetAuthorUid: report.targetAuthorUid,
    postId: report.postId ?? null,
    reason: report.reason,
    reporterUid: report.reporterUid,
    reportCount,
    action,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { reportId, action, reportCount };
}
