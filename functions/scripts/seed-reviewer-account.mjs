#!/usr/bin/env node
/**
 * Provision (or reset) the dedicated App Store Review demo account and a
 * secondary community seed post/comment so Apple reviewers can sign in via
 * Email/Password and immediately exercise:
 *   1. Pet profile, dog walk tracking, and walk history
 *   2. Community feed posting (including pre-post objectionable content filter)
 *   3. Post/comment "..." Report & Block flows (requires another author's public UGC)
 *   4. Settings -> Blocked Users management
 *
 * Usage:
 *   REVIEWER_PASSWORD="<strong-password>" node functions/scripts/seed-reviewer-account.mjs --commit
 *   node functions/scripts/seed-reviewer-account.mjs --generate-password --commit
 *   node functions/scripts/seed-reviewer-account.mjs --client --generate-password --commit
 *
 * Options:
 *   --commit              Apply changes to Firebase Auth + Firestore (default: dry-run)
 *   --generate-password   Generate a strong random password and print it once
 *   --email=<addr>        Override reviewer email (default: env REVIEWER_EMAIL or appreview@mangopet.app)
 *   --client              Use the Firebase Client SDK (Email/Password auth + security-rules-compliant
 *                         writes + createFamily callable) instead of Admin SDK ADC. Requires Email/Password
 *                         provider to be enabled in Firebase Authentication.
 *
 * Auth credentials:
 *   - Admin mode (default): Application Default Credentials (gcloud auth application-default login
 *     or GOOGLE_APPLICATION_CREDENTIALS), or emulators when FIRESTORE_EMULATOR_HOST is set.
 *   - Client mode (--client): Firebase Web API key (env NEXT_PUBLIC_FIREBASE_API_KEY or project plist).
 */
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const generatePassword = args.includes("--generate-password");
const useClient = args.includes("--client");
const emailFlag = args.find((a) => a.startsWith("--email="))?.slice("--email=".length);

const reviewerEmail = (
  emailFlag ??
  process.env.REVIEWER_EMAIL ??
  "appreview@mangopet.app"
).trim().toLowerCase();

let reviewerPassword = process.env.REVIEWER_PASSWORD ?? "";
if (!reviewerPassword && generatePassword) {
  reviewerPassword = `Mango!${randomBytes(9).toString("base64url")}`;
}

if (commit && !reviewerPassword) {
  console.error(
    "Missing password. Set REVIEWER_PASSWORD or pass --generate-password with --commit.",
  );
  process.exit(1);
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "mango-pet-app";
const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const REVIEWER_NAME = "Mango Reviewer";
const FAMILY_ID = "seed-review-family";
const PET_ID = "seed-review-pet";
const WALK_ID = "seed-review-walk";
const OWN_POST_ID = "seed-review-own-post";
const NEIGHBOR_UID = "seed-community-neighbor";
const NEIGHBOR_EMAIL = (process.env.NEIGHBOR_EMAIL ?? "neighbor-demo@mangopet.app").trim().toLowerCase();
const NEIGHBOR_PASSWORD = process.env.NEIGHBOR_PASSWORD ?? "MangoNeighbor!2026";
const NEIGHBOR_NAME = "柴柴鄰居";
const NEIGHBOR_POST_ID = "seed-review-public-post";
const NEIGHBOR_COMMENT_ID = "seed-review-comment";

const EMPTY_REACTIONS = {
  "❤️": 0,
  "😂": 0,
  "🐶": 0,
  "👍": 0,
  "🎉": 0,
};

async function runAdminSeed() {
  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { FieldValue, Timestamp, getFirestore } = await import("firebase-admin/firestore");

  initializeApp({
    ...(useEmulator ? {} : { credential: applicationDefault() }),
    projectId,
  });

  const auth = getAuth();
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  async function ensureReviewerAuthUser() {
    try {
      const existing = await auth.getUserByEmail(reviewerEmail);
      const updated = await auth.updateUser(existing.uid, {
        password: reviewerPassword,
        displayName: REVIEWER_NAME,
        emailVerified: true,
        disabled: false,
      });
      return { uid: updated.uid, created: false };
    } catch (err) {
      if (err?.code !== "auth/user-not-found") throw err;
      const created = await auth.createUser({
        email: reviewerEmail,
        password: reviewerPassword,
        displayName: REVIEWER_NAME,
        emailVerified: true,
      });
      return { uid: created.uid, created: true };
    }
  }

  const { uid: reviewerUid, created } = await ensureReviewerAuthUser();
  const now = Timestamp.now();
  const oneHourAgo = Timestamp.fromMillis(now.toMillis() - 60 * 60 * 1000);
  const halfHourAgo = Timestamp.fromMillis(now.toMillis() - 32 * 60 * 1000);

  // 1. Reviewer profile & private contact
  await db.doc(`users/${reviewerUid}`).set(
    {
      uid: reviewerUid,
      displayName: REVIEWER_NAME,
      displayNameLower: REVIEWER_NAME.toLowerCase(),
      photoURL: null,
      authProvider: "password",
      isGuest: false,
      locale: "zh-TW",
      createdAt: now,
      lastSeenAt: now,
      defaultPostVisibility: "public",
      allowFriendRequests: true,
      familyIds: FieldValue.arrayUnion(FAMILY_ID),
      currentFamilyId: FAMILY_ID,
      blockedUids: [],
    },
    { merge: true },
  );

  await db.doc(`users/${reviewerUid}/private/contact`).set(
    { email: reviewerEmail },
    { merge: true },
  );

  // 2. Demo family, pet, walk, and own post
  const famRef = db.doc(`families/${FAMILY_ID}`);
  const famSnap = await famRef.get();
  await famRef.set(
    {
      name: "Mango Demo Family",
      ownerUid: reviewerUid,
      memberUids: FieldValue.arrayUnion(reviewerUid),
      inviteCode: famSnap.exists ? famSnap.data()?.inviteCode ?? "880168" : "880168",
      createdAt: famSnap.exists ? famSnap.data()?.createdAt ?? now : now,
    },
    { merge: true },
  );

  await db.doc(`pets/${PET_ID}`).set(
    {
      petId: PET_ID,
      familyId: FAMILY_ID,
      ownerUid: reviewerUid,
      name: "芒果 Mango",
      species: "dog",
      breed: "Shiba Inu",
      gender: "male",
      weightKg: 10.5,
      bio: "Loves evening park walks and treats.",
      walkGoal: { minutes: 30, source: "manual" },
      createdAt: now,
    },
    { merge: true },
  );

  await db.doc(`walks/${WALK_ID}`).set(
    {
      walkId: WALK_ID,
      familyId: FAMILY_ID,
      walkerUid: reviewerUid,
      walkerName: REVIEWER_NAME,
      walkerPhotoURL: null,
      ownerUid: reviewerUid,
      petId: PET_ID,
      petName: "芒果 Mango",
      startedAt: oneHourAgo,
      endedAt: halfHourAgo,
      distanceKm: 1.8,
      durationMin: 28,
      isManual: true,
      score: 36,
      notes: "Morning park walk",
      createdAt: halfHourAgo,
    },
    { merge: true },
  );

  await db.doc(`posts/${OWN_POST_ID}`).set(
    {
      authorUid: reviewerUid,
      authorName: REVIEWER_NAME,
      authorPhotoURL: null,
      petIds: [PET_ID],
      text: "今天帶芒果到公園散步，天氣超好！🐾",
      photoURLs: [],
      visibility: "public",
      createdAt: halfHourAgo,
      reactionCounts: EMPTY_REACTIONS,
      hidden: false,
      reportCount: 0,
    },
    { merge: true },
  );

  // 3. Secondary community author + public post/comment so reviewer can test Report & Block
  await db.doc(`users/${NEIGHBOR_UID}`).set(
    {
      uid: NEIGHBOR_UID,
      displayName: NEIGHBOR_NAME,
      displayNameLower: NEIGHBOR_NAME.toLowerCase(),
      photoURL: null,
      authProvider: "google",
      isGuest: false,
      locale: "zh-TW",
      createdAt: now,
      lastSeenAt: now,
      defaultPostVisibility: "public",
      allowFriendRequests: false,
    },
    { merge: true },
  );

  await db.doc(`posts/${NEIGHBOR_POST_ID}`).set(
    {
      authorUid: NEIGHBOR_UID,
      authorName: NEIGHBOR_NAME,
      authorPhotoURL: null,
      petIds: [],
      text: "週末在河濱公園散步遇到好多毛孩朋友 🐶",
      photoURLs: [],
      visibility: "public",
      createdAt: oneHourAgo,
      reactionCounts: EMPTY_REACTIONS,
      commentCount: 1,
      hidden: false,
      reportCount: 0,
    },
    { merge: true },
  );

  await db
    .doc(`posts/${NEIGHBOR_POST_ID}/comments/${NEIGHBOR_COMMENT_ID}`)
    .set(
      {
        authorUid: NEIGHBOR_UID,
        authorName: NEIGHBOR_NAME,
        authorPhotoURL: null,
        text: "大家最喜歡哪個時間帶狗狗出門？",
        createdAt: halfHourAgo,
        hidden: false,
        reportCount: 0,
      },
      { merge: true },
    );

  console.log(
    JSON.stringify(
      {
        mode: "commit",
        sdk: "admin",
        projectId,
        reviewerUid,
        reviewerEmail,
        createdAuthUser: created,
        ...(generatePassword ? { generatedPassword: reviewerPassword } : {}),
        neighborPostId: NEIGHBOR_POST_ID,
      },
      null,
      2,
    ),
  );
}

async function ensureClientAuthUser(authModule, authInstance, { email, password, displayName }) {
  const {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
  } = authModule;
  let cred;
  let created = false;
  try {
    cred = await createUserWithEmailAndPassword(authInstance, email, password);
    created = true;
  } catch (err) {
    if (err?.code !== "auth/email-already-in-use") throw err;
    cred = await signInWithEmailAndPassword(authInstance, email, password);
  }
  if (cred.user.displayName !== displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return { user: cred.user, created };
}

async function runClientSeed() {
  const appMod = await import("firebase/app");
  const authMod = await import("firebase/auth");
  const fsMod = await import("firebase/firestore");
  const fnMod = await import("firebase/functions");

  const { initializeApp: initClientApp, deleteApp } = appMod;
  const { getAuth } = authMod;
  const {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    serverTimestamp,
    setDoc,
    terminate,
    Timestamp,
    where,
  } = fsMod;
  const { getFunctions, httpsCallable } = fnMod;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyD_oYrPK-olpOK-y8ekKAH6RUBdAPNesdk",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "722604603606",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:722604603606:web:9d4efbb3033bfd9811f177",
  };

  let reviewerApp;
  let reviewerDb;
  let neighborApp;
  let neighborDb;

  try {
    reviewerApp = initClientApp(firebaseConfig, "reviewer");
    const reviewerAuth = getAuth(reviewerApp);
    reviewerDb = getFirestore(reviewerApp);

    const { user: reviewerUser, created } = await ensureClientAuthUser(authMod, reviewerAuth, {
      email: reviewerEmail,
      password: reviewerPassword,
      displayName: REVIEWER_NAME,
    });
    const reviewerUid = reviewerUser.uid;
    await reviewerUser.getIdToken();

    // 1. Reviewer profile & private contact
    await setDoc(
      doc(reviewerDb, "users", reviewerUid),
      {
        uid: reviewerUid,
        displayName: REVIEWER_NAME,
        displayNameLower: REVIEWER_NAME.toLowerCase(),
        photoURL: null,
        authProvider: "password",
        isGuest: false,
        locale: "zh-TW",
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        defaultPostVisibility: "public",
        allowFriendRequests: true,
        blockedUids: [],
      },
      { merge: true },
    );

    await setDoc(
      doc(reviewerDb, "users", reviewerUid, "private", "contact"),
      { email: reviewerEmail },
      { merge: true },
    );

    // 2. Demo family (via createFamily callable to obey firestore.rules)
    const userSnap = await getDoc(doc(reviewerDb, "users", reviewerUid));
    let familyId = userSnap.data()?.currentFamilyId ?? null;
    if (!familyId) {
      const createFamily = httpsCallable(getFunctions(reviewerApp, "asia-east1"), "createFamily");
      const familyRes = await createFamily({ name: "Mango Demo Family" });
      familyId = familyRes.data?.familyId ?? null;
    }
    if (!familyId) {
      throw new Error("Failed to obtain demo familyId from user profile or createFamily callable.");
    }

    // 3. Demo pet, walk, and own post
    const petRef = doc(reviewerDb, "pets", PET_ID);
    const petSnap = await getDoc(petRef);
    const petData = {
      petId: PET_ID,
      familyId,
      ownerUid: reviewerUid,
      name: "芒果 Mango",
      species: "dog",
      breed: "Shiba Inu",
      gender: "male",
      weightKg: 10.5,
      bio: "Loves evening park walks and treats.",
      walkGoal: { minutes: 30, source: "manual" },
      ...(petSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    };
    await setDoc(petRef, petData, { merge: true });

    const nowMs = Date.now();
    const oneHourAgo = new Date(nowMs - 60 * 60 * 1000);
    const halfHourAgo = new Date(nowMs - 32 * 60 * 1000);

    const walkRef = doc(reviewerDb, "walks", WALK_ID);
    const walkSnap = await getDoc(walkRef);
    if (!walkSnap.exists()) {
      await setDoc(walkRef, {
        walkId: WALK_ID,
        familyId,
        walkerUid: reviewerUid,
        walkerName: REVIEWER_NAME,
        walkerPhotoURL: null,
        ownerUid: reviewerUid,
        petId: PET_ID,
        petName: "芒果 Mango",
        startedAt: Timestamp.fromDate(oneHourAgo),
        endedAt: Timestamp.fromDate(halfHourAgo),
        distanceKm: 1.8,
        durationMin: 28,
        path: [],
        isManual: true,
        score: 36,
        notes: "Morning park walk",
        photoURLs: [],
        createdAt: serverTimestamp(),
      });
    }

    const ownPostsSnap = await getDocs(
      query(
        collection(reviewerDb, "posts"),
        where("visibility", "==", "public"),
        where("authorUid", "==", reviewerUid),
      ),
    );
    if (!ownPostsSnap.docs.some((d) => d.id === OWN_POST_ID)) {
      await setDoc(doc(reviewerDb, "posts", OWN_POST_ID), {
        authorUid: reviewerUid,
        authorName: REVIEWER_NAME,
        authorPhotoURL: null,
        petIds: [PET_ID],
        text: "今天帶芒果到公園散步，天氣超好！🐾",
        photoURLs: [],
        visibility: "public",
        createdAt: serverTimestamp(),
        reactionCounts: EMPTY_REACTIONS,
      });
    }

    // 4. Secondary community author + public post/comment for Report & Block review
    neighborApp = initClientApp(firebaseConfig, "neighbor");
    const neighborAuth = getAuth(neighborApp);
    neighborDb = getFirestore(neighborApp);

    const { user: neighborUser } = await ensureClientAuthUser(authMod, neighborAuth, {
      email: NEIGHBOR_EMAIL,
      password: NEIGHBOR_PASSWORD,
      displayName: NEIGHBOR_NAME,
    });
    const neighborUid = neighborUser.uid;
    await neighborUser.getIdToken();

    await setDoc(
      doc(neighborDb, "users", neighborUid),
      {
        uid: neighborUid,
        displayName: NEIGHBOR_NAME,
        displayNameLower: NEIGHBOR_NAME.toLowerCase(),
        photoURL: null,
        authProvider: "password",
        isGuest: false,
        locale: "zh-TW",
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        defaultPostVisibility: "public",
        allowFriendRequests: false,
      },
      { merge: true },
    );

    const neighborPostsSnap = await getDocs(
      query(
        collection(neighborDb, "posts"),
        where("visibility", "==", "public"),
        where("authorUid", "==", neighborUid),
      ),
    );
    if (!neighborPostsSnap.docs.some((d) => d.id === NEIGHBOR_POST_ID)) {
      await setDoc(doc(neighborDb, "posts", NEIGHBOR_POST_ID), {
        authorUid: neighborUid,
        authorName: NEIGHBOR_NAME,
        authorPhotoURL: null,
        petIds: [],
        text: "週末在河濱公園散步遇到好多毛孩朋友 🐶",
        photoURLs: [],
        visibility: "public",
        createdAt: serverTimestamp(),
        reactionCounts: EMPTY_REACTIONS,
      });
    }

    const neighborCommentRef = doc(
      neighborDb,
      "posts",
      NEIGHBOR_POST_ID,
      "comments",
      NEIGHBOR_COMMENT_ID,
    );
    const neighborCommentSnap = await getDoc(neighborCommentRef);
    if (!neighborCommentSnap.exists()) {
      await setDoc(neighborCommentRef, {
        authorUid: neighborUid,
        authorName: NEIGHBOR_NAME,
        authorPhotoURL: null,
        text: "大家最喜歡哪個時間帶狗狗出門？",
        createdAt: serverTimestamp(),
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: "commit",
          sdk: "client",
          projectId,
          reviewerUid,
          reviewerEmail,
          familyId,
          createdAuthUser: created,
          ...(generatePassword ? { generatedPassword: reviewerPassword } : {}),
          neighborUid,
          neighborEmail: NEIGHBOR_EMAIL,
          neighborPostId: NEIGHBOR_POST_ID,
        },
        null,
        2,
      ),
    );
  } finally {
    if (neighborDb) await terminate(neighborDb);
    if (neighborApp) await deleteApp(neighborApp);
    if (reviewerDb) await terminate(reviewerDb);
    if (reviewerApp) await deleteApp(reviewerApp);
  }
}

async function run() {
  if (!commit) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          sdk: useClient ? "client" : "admin",
          projectId,
          reviewerEmail,
          hasPassword: Boolean(reviewerPassword),
          plannedDocs: [
            useClient ? "families/<auto-via-createFamily>" : `families/${FAMILY_ID}`,
            `pets/${PET_ID}`,
            `walks/${WALK_ID}`,
            `posts/${OWN_POST_ID}`,
            useClient ? `users/<neighbor-uid> (${NEIGHBOR_EMAIL})` : `users/${NEIGHBOR_UID}`,
            `posts/${NEIGHBOR_POST_ID}`,
            `posts/${NEIGHBOR_POST_ID}/comments/${NEIGHBOR_COMMENT_ID}`,
          ],
        },
        null,
        2,
      ),
    );
    return;
  }

  if (useClient) {
    await runClientSeed();
  } else {
    await runAdminSeed();
  }
}

run().catch((err) => {
  console.error("Failed to seed reviewer account:", err);
  process.exitCode = 1;
});
