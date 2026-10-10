import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Admin access to Firestore for the backup/restore/check scripts. Bypasses the
 * security rules. Uses the service account in GOOGLE_APPLICATION_CREDENTIALS,
 * or the emulator when FIRESTORE_EMULATOR_HOST is set (tests).
 */
export function adminDb(projectId = process.env.FIREBASE_PROJECT_ID): Firestore {
  if (!projectId) throw new Error("Set FIREBASE_PROJECT_ID.");
  const app =
    getApps().find((a) => a.name === projectId) ??
    initializeApp(
      process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential: applicationDefault() },
      projectId,
    );
  return getFirestore(app);
}
