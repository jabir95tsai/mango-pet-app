/** Server-side moderation. Raw reports stay intact; a reporter gets one vote
 * per canonical target. Audit, vote, counter and hiding commit atomically. */
import { createHash } from "node:crypto";
import { FieldValue, type Firestore, type DocumentData } from "firebase-admin/firestore";

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
  outcome: "counted" | "duplicate" | "ignored" | "logged";
};

const hash = (parts: string[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const validId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !value.includes("/")
  && value !== "." && value !== ".." && !/^__.*__$/.test(value)
  && Buffer.byteLength(value, "utf8") <= 1500;
const auditString = (value: unknown) => typeof value === "string" ? value.slice(0, 1500) : null;

function validReport(report: ReportDoc) {
  return validId(report.reporterUid) && validId(report.targetId) && validId(report.targetAuthorUid)
    && ["post", "comment", "user"].includes(report.targetType)
    && (report.targetType !== "comment" || validId(report.postId))
    && ["spam", "harassment", "inappropriate", "other"].includes(report.reason)
    && report.status === "open";
}

function sameTarget(data: DocumentData, report: ReportDoc) {
  return data.targetType === report.targetType && data.targetId === report.targetId
    && (report.targetType !== "comment" || data.postId === report.postId)
    && data.targetAuthorUid === report.targetAuthorUid;
}

/** Old audits are the only evidence that the previous trigger counted a vote.
 * Old reportCount alone is untrusted: both retries and duplicate reports inflated
 * it. Preserve any existing hidden flag, but rebuild the count from distinct
 * audited reporters on the first new delivery for this target. */
function isLegacyCounted(data: DocumentData, report: ReportDoc) {
  return data.voteVersion !== 2 && sameTarget(data, report) && validId(data.reporterUid)
    && Number.isFinite(data.reportCount) && data.reportCount > 0
    && (data.action === "logged" || data.action === "hidden");
}

export async function actOnReport(db: Firestore, reportId: string, report: ReportDoc): Promise<ActOnReportResult> {
  const auditRef = db.doc(`moderationAudit/${reportId}`);
  return db.runTransaction(async (tx) => {
    const oldAudit = await tx.get(auditRef);
    if (oldAudit.exists) {
      const data = oldAudit.data()!;
      return {
        reportId, action: data.action === "hidden" ? "hidden" : "logged",
        reportCount: typeof data.reportCount === "number" ? data.reportCount : null,
        outcome: "duplicate",
      };
    }
    const audit = (result: ActOnReportResult, detail?: string) => tx.create(auditRef, {
      ...result, voteVersion: 2, detail: detail ?? null,
      targetType: auditString(report.targetType), targetId: auditString(report.targetId),
      targetAuthorUid: auditString(report.targetAuthorUid), postId: auditString(report.postId),
      reason: auditString(report.reason), reporterUid: auditString(report.reporterUid),
      createdAt: FieldValue.serverTimestamp(),
    });
    const ignored = (detail: string): ActOnReportResult => {
      const result: ActOnReportResult = { reportId, action: "logged", reportCount: null, outcome: "ignored" };
      audit(result, detail);
      return result;
    };
    if (!validReport(report)) return ignored("invalid-report");

    const path = report.targetType === "comment" ? `posts/${report.postId}/comments/${report.targetId}`
      : report.targetType === "post" ? `posts/${report.targetId}` : `users/${report.targetId}`;
    const targetRef = db.doc(path);
    const voteRef = db.doc(`moderationVotes/${hash([report.reporterUid, report.targetType, path])}`);
    const stateRef = db.doc(`moderationTargetState/${hash([report.targetType, path])}`);
    const [targetSnap, voteSnap, stateSnap] = await Promise.all([
      tx.get(targetRef), tx.get(voteRef), tx.get(stateRef),
    ]);
    if (!targetSnap.exists) return ignored("target-missing");
    const target = targetSnap.data()!;
    const authorUid = report.targetType === "user" ? targetSnap.id : target.authorUid;
    if (authorUid !== report.targetAuthorUid) return ignored("author-mismatch");

    if (report.targetType !== "user") {
      const parent = report.targetType === "comment" ? await tx.get(db.doc(`posts/${report.postId}`)) : targetSnap;
      if (!parent.exists) return ignored("parent-missing");
      const post = parent.data()!;
      let canRead = post.visibility === "public" || post.authorUid === report.reporterUid;
      if (!canRead && post.visibility === "friends" && validId(post.authorUid)) {
        canRead = (await tx.get(db.doc(`users/${post.authorUid}/friends/${report.reporterUid}`))).exists;
      }
      if (!canRead) return ignored("target-not-readable");
    }

    if (voteSnap.exists) {
      const current = stateSnap.data()?.reportCount;
      if (!Number.isSafeInteger(current) || current < 0) throw new Error("Invalid moderation counter state");
      const isContent = report.targetType !== "user";
      // An author can delete/recreate a document at the same path. Restore the
      // authoritative state on a new duplicate report without granting a new vote.
      if (isContent) tx.update(targetRef, {
        reportCount: current, ...(current >= REPORT_HIDE_THRESHOLD ? { hidden: true } : {}),
      });
      const result: ActOnReportResult = {
        reportId, action: isContent && current >= REPORT_HIDE_THRESHOLD ? "hidden" : "logged", outcome: "duplicate",
        reportCount: isContent ? current : null,
      };
      audit(result);
      return result;
    }

    // Only single-field queries: no new composite index or client query change.
    // A target initializes once; unseen reporters then consult only their own
    // legacy audits so an old counted reporter cannot add a second vote.
    const legacyQuery = stateSnap.exists
      ? db.collection("moderationAudit").where("reporterUid", "==", report.reporterUid)
      : db.collection("moderationAudit").where("targetId", "==", report.targetId);
    const legacyAudits = await tx.get(legacyQuery);
    const legacyReporters = new Set(legacyAudits.docs.map((doc) => doc.data())
      .filter((data) => isLegacyCounted(data, report)).map((data) => data.reporterUid as string));
    const duplicate = legacyReporters.has(report.reporterUid);
    const current = stateSnap.exists ? stateSnap.data()!.reportCount : legacyReporters.size;
    if (!Number.isSafeInteger(current) || current < 0) throw new Error("Invalid moderation counter state");
    const next = current + (duplicate ? 0 : 1);
    const isContent = report.targetType !== "user";
    const result: ActOnReportResult = {
      reportId, reportCount: isContent ? next : null,
      action: isContent && next >= REPORT_HIDE_THRESHOLD ? "hidden" : "logged",
      outcome: duplicate ? "duplicate" : isContent ? "counted" : "logged",
    };
    tx.create(voteRef, {
      reporterUid: report.reporterUid, targetType: report.targetType, targetPath: path,
      firstReportId: reportId, legacy: duplicate, createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(stateRef, { targetType: report.targetType, targetPath: path, reportCount: next, updatedAt: FieldValue.serverTimestamp() });
    if (isContent) tx.update(targetRef, {
      reportCount: next, ...(next >= REPORT_HIDE_THRESHOLD ? { hidden: true } : {}),
    });
    audit(result);
    return result;
  });
}
