import { getRetention } from "./env";
import {
  expireForRetention,
  listActiveStorageRecords,
  listRetentionCandidates,
  markDeleted,
} from "./image-repository";
import { deletePersonalizedImage, deleteStaleTransientUploads, listStoredImagePaths } from "./storage";

export interface RetentionReport {
  recordsDeleted: number;
  orphanBlobsDeleted: number;
  transientBlobsDeleted: number;
  missingBlobsMarked: number;
  failures: number;
}

export async function runRetention(now = new Date()): Promise<RetentionReport> {
  const retention = getRetention();
  const candidates = await listRetentionCandidates(now, {
    privateBefore: new Date(now.getTime() - retention.privateHours * 3_600_000),
    pendingBefore: new Date(now.getTime() - retention.pendingHours * 3_600_000),
    rejectedBefore: new Date(now.getTime() - retention.rejectedHours * 3_600_000),
  });
  let recordsDeleted = 0;
  let failures = 0;

  for (const image of candidates) {
    try {
      if (["private", "pending_review", "approved"].includes(image.status)) {
        await expireForRetention(image.id, image.status);
      }
      await deletePersonalizedImage(image.blobPath);
      await markDeleted(image.id, now);
      recordsDeleted += 1;
    } catch {
      failures += 1;
    }
  }

  const [storedPaths, activeRecords] = await Promise.all([
    listStoredImagePaths(),
    listActiveStorageRecords(),
  ]);
  const known = new Set(activeRecords.map((record) => record.blobPath));
  let orphanBlobsDeleted = 0;
  for (const pathname of storedPaths) {
    if (known.has(pathname)) continue;
    try {
      await deletePersonalizedImage(pathname);
      orphanBlobsDeleted += 1;
    } catch {
      failures += 1;
    }
  }

  const stored = new Set(storedPaths);
  let missingBlobsMarked = 0;
  for (const record of activeRecords) {
    if (stored.has(record.blobPath)) continue;
    if (["private", "pending_review", "approved"].includes(record.status)) {
      await expireForRetention(record.id, record.status);
    }
    await markDeleted(record.id, now);
    missingBlobsMarked += 1;
  }
  const transientBlobsDeleted = await deleteStaleTransientUploads(now);
  return { recordsDeleted, orphanBlobsDeleted, transientBlobsDeleted, missingBlobsMarked, failures };
}
