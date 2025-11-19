// src/firebaseHelpers.js
// Firestore helper utilities used by the Daily Log and Dashboard pages.

import { db } from "./firebaseConfig";
// src/firebaseHelpers.js
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  where,        // ✅ needed for filters
  updateDoc,    // ✅ you call updateDoc in several helpers
  deleteDoc     // ✅ used by deleteDailyLog
} from "firebase/firestore";

/** ------------------------------
 * Core CRUD for daily_logs
 * ------------------------------*/

/**
 * Create a daily log entry for a user.
 * @returns the new document id string
 */
export async function createDailyLog(uid, payload = {}) {
  if (!uid) throw new Error("Missing uid in createDailyLog");
  const colRef = collection(db, "users", uid, "daily_logs");
  const now = Date.now();
  const docRef = await addDoc(colRef, {
    ...payload,
    // numeric timestamp keeps ordering stable in UI
    timestamp: payload.timestamp || now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing daily log doc with `data` (merges fields).
 */
export async function updateDailyLog(uid, logId, data = {}) {
  if (!uid || !logId) throw new Error("Missing uid or logId in updateDailyLog");
  const ref = doc(db, "users", uid, "daily_logs", logId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Retrieve all daily logs for a user (once).
 * returns array of { id, ...data }
 */
export async function getDailyLogs(uid) {
  if (!uid) return [];
  const colRef = collection(db, "users", uid, "daily_logs");
  const q = query(colRef, orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Real-time watcher for daily_logs collection (entire set).
 * returns unsubscribe()
 */
export function watchDailyLogs(uid, onChange) {
  if (!uid) return () => {};
  const colRef = collection(db, "users", uid, "daily_logs");
  const q = query(colRef, orderBy("timestamp", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("watchDailyLogs snapshot error:", err);
      onChange([]);
    }
  );
}

/**
 * Delete a specific daily log.
 */
export async function deleteDailyLog(uid, id) {
  if (!uid || !id) throw new Error("deleteDailyLog requires uid and id");
  const d = doc(db, "users", uid, "daily_logs", id);
  await deleteDoc(d);
  return true;
}

/** ------------------------------
 * Date-scoped helpers (used in DailyLogPage)
 * ------------------------------*/

/**
 * Get logs for a specific ISO date (YYYY-MM-DD).
 */
export async function getDailyLogsByDate(uid, dateIso) {
  if (!uid || !dateIso) return [];
  const colRef = collection(db, "users", uid, "daily_logs");
  const q = query(
    colRef,
    where("date", "==", dateIso),
    orderBy("timestamp", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Watch logs for a specific date (real-time).
 * returns unsubscribe()
 */
export function watchDailyLogsByDate(uid, dateIso, onChange) {
  if (!uid || !dateIso) return () => {};
  const colRef = collection(db, "users", uid, "daily_logs");
  const q = query(
    colRef,
    where("date", "==", dateIso),
    orderBy("timestamp", "desc")
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("watchDailyLogsByDate snapshot error:", err);
      onChange([]);
    }
  );
}

/**
 * Delete all logs for a given date (utility when you add a "clear day" action).
 */
export async function deleteAllLogsForDate(uid, dateIso) {
  const logs = await getDailyLogsByDate(uid, dateIso);
  await Promise.all(logs.map((l) => deleteDailyLog(uid, l.id)));
  return logs.length;
}

/** ------------------------------
 * Backend integrations (port 8000)
 * ------------------------------*/

const API_BASE = "https://caloreat.onrender.com";

/**
 * Run nutrient analysis for items: [{ name, quantity, portion_mult?, manual_calories? }, ...]
 * Returns backend json or null.
 */
export async function analyzeMeals(items) {
  try {
    const resp = await fetch(`${API_BASE}/api/run_nutrients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    return await resp.json();
  } catch (err) {
    console.error("analyzeMeals failed:", err);
    return null;
  }
}

/**
 * Start daily summary generation, then poll status until complete (or timeout).
 * Returns the final summary JSON or null.
 */
export async function generateDailySummary(userId, logs, dateIso = new Date().toISOString().slice(0, 10), opts = {}) {
  const {
    pollIntervalMs = 1500,
    maxAttempts = 30,
  } = opts;

  try {
    // kick off
    const start = await fetch(`${API_BASE}/api/summarizeDaily`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, date: dateIso, logs }),
    });
    if (!start.ok) throw new Error(await start.text());

    // poll
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts += 1;
      const st = await fetch(
        `${API_BASE}/api/summarizeDaily/status?user_id=${encodeURIComponent(userId)}&date=${encodeURIComponent(dateIso)}`
      );
      if (st.ok) {
        const js = await st.json();
        if (js && js.status === "complete" && js.summary) return js.summary;
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    console.warn("generateDailySummary: timed out");
    return null;
  } catch (err) {
    console.error("generateDailySummary failed:", err);
    return null;
  }
}

/** ------------------------------
 * Profile / personalization (paths aligned to /users/{uid}/… rules)
 * ------------------------------*/

/**
 * Get the user's profile doc at /users/{uid}/profile/current
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid, "profile", "current");
  const snap = await getDoc(ref);
  return snap.exists() ? { id: ref.id, ...snap.data() } : null;
}

/**
 * Upsert (merge) the user's profile.
 */
export async function upsertUserProfile(uid, data) {
  if (!uid) throw new Error("Missing uid");
  const ref = doc(db, "users", uid, "profile", "current");
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return true;
}

/**
 * Get / upsert personalization at /users/{uid}/personalization/current
 */
export async function getUserPersonalization(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid, "personalization", "current");
  const snap = await getDoc(ref);
  return snap.exists() ? { id: ref.id, ...snap.data() } : null;
}

export async function upsertUserPersonalization(uid, data) {
  if (!uid) throw new Error("Missing uid");
  const ref = doc(db, "users", uid, "personalization", "current");
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return true;
}


/** -------------------------------------------------------
 * Friends, Requests, Streaks, DM threads, Communities
 * ------------------------------------------------------*/

// --- FRIEND REQUESTS ---
export async function uidFromShortcode(code) {
  const q = query(collection(db, "users"), where("profile.shortcode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("No user found");
  return snap.docs[0].id;
}


/** Send a friend request (simple: target by UID) */
export async function sendFriendRequest(fromUid, toUid) {
  if (!fromUid || !toUid) throw new Error("sendFriendRequest requires both UIDs");
  if (fromUid === toUid) throw new Error("Cannot add yourself");

  // Deterministic doc id: the sender's uid (reqId == fromUid)
  const ref = doc(db, "users", toUid, "friend_requests", fromUid);
  await setDoc(ref, {
    fromUid,
    toUid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return { ok: true, id: ref.id };
}

/** List incoming pending requests for a user */
export async function listIncomingRequests(uid) {
  if (!uid) return [];
  const qy = query(
    collection(db, "users", uid, "friend_requests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Accept a friend request and create reciprocal friend docs */
export async function acceptFriendRequest(uid, requestId) {
  const reqRef = doc(db, "users", uid, "friend_requests", requestId);
  const req = await getDoc(reqRef);
  if (!req.exists()) throw new Error("Request not found");
  const { fromUid } = req.data();

  await updateDoc(reqRef, { status: "accepted", respondedAt: serverTimestamp() });

  // Add to each user's /friends/{friendUid}
  const aRef = doc(db, "users", uid, "friends", fromUid);
  const bRef = doc(db, "users", fromUid, "friends", uid);
  const payload = { status: "accepted", since: serverTimestamp() };
  await Promise.all([setDoc(aRef, payload), setDoc(bRef, payload)]);

  return { ok: true, friendUid: fromUid };
}

/** Decline (or cancel) a friend request */
export async function declineFriendRequest(uid, requestId) {
  const reqRef = doc(db, "users", uid, "friend_requests", requestId);
  await updateDoc(reqRef, { status: "declined", respondedAt: serverTimestamp() });
  return { ok: true };
}

/** List friends for a user */
export async function listFriends(uid) {
  if (!uid) return [];
  const snap = await getDocs(collection(db, "users", uid, "friends"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// --- FRIEND LOGS & STREAKS ---

/** Get a friend's logs for a given ISO date */
// export async function getFriendLogsByDate(friendUid, dateIso) {
//   if (!friendUid || !dateIso) return [];
//   const colRef = collection(db, "users", friendUid, "daily_logs");
//   const qy = query(colRef, where("date", "==", dateIso), orderBy("timestamp", "desc"));
//   const snap = await getDocs(qy);
//   return snap.docs.map(d => ({ id: d.id, ...d.data() }));
// }

export async function getFriendLogsToday(friendUid) {
  if (!friendUid) return [];
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const colRef = collection(db, "users", friendUid, "daily_logs");
  const qy = query(colRef, where("date", "==", today), orderBy("timestamp", "desc"));
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


/** Simple streak calculator from an array of logs with .date */
export function calcStreakFromLogs(logs) {
  const daySet = new Set(
    logs.map(l => l.date || (l.timestamp && new Date(l.timestamp).toISOString().slice(0,10)))
  );
  let streak = 0;
  const d = new Date();
  while (true) {
    const iso = d.toISOString().slice(0,10);
    if (daySet.has(iso)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// --- DIRECT MESSAGES (DM) ---

/** Deterministic thread id for 1:1 chats (uidA_uidB sorted) */
function dmThreadId(a, b) {
  return [a, b].sort().join("__"); // stable id for the pair
}

export async function ensureDMThread(uidA, uidB) {
  if (!uidA || !uidB) throw new Error("ensureDMThread requires two uids");
  const tid = dmThreadId(uidA, uidB);
  const tref = doc(db, "threads", tid);
  const snap = await getDoc(tref);
  if (!snap.exists()) {
    // create minimal doc; rules allow because participants include the writer
    await setDoc(tref, {
      type: "dm",
      participants: [uidA, uidB],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return tid;
}

export async function sendThreadMessage(threadId, fromUid, text) {
  const mref = collection(db, "threads", threadId, "messages");
  await addDoc(mref, {
    fromUid,
    text,
    createdAt: serverTimestamp(),
  });
  // touch parent for ordering
  await setDoc(doc(db, "threads", threadId), { updatedAt: serverTimestamp() }, { merge: true });
}

export function watchThreadMessages(threadId, onChange) {
  const qy = query(collection(db, "threads", threadId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(qy, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
/** Watch messages for a thread (real-time) */


// --- COMMUNITIES (small group chats) ---

/** Create a community (group) with members */
export async function createCommunity(ownerUid, name, memberUids = []) {
  const grpRef = doc(collection(db, "groups"));
  await setDoc(grpRef, {
    name,
    ownerUid,
    members: Array.from(new Set([ownerUid, ...memberUids])),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return grpRef.id;
}

/** Send a message to a community */
export async function sendGroupMessage(groupId, fromUid, text) {
  const mRef = collection(db, "groups", groupId, "messages");
  await addDoc(mRef, {
    fromUid,
    text,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "groups", groupId), { updatedAt: serverTimestamp() });
}

/** Watch group messages */
export function watchGroupMessages(groupId, onChange) {
  const qy = query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(qy, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** List communities the user is a member of (basic) */
export async function listMyCommunities(uid) {
  const qy = query(collection(db, "groups"), where("members", "array-contains", uid), orderBy("updatedAt", "desc"));
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
/** -------------------------------------------------------
 * Friends activity window + real streak
 * ------------------------------------------------------*/

/** Fetch a friend's logs for the last `days` days, newest first. */
export async function getFriendActivityWindow(friendUid, days = 60) {
  const colRef = collection(db, "users", friendUid, "daily_logs");
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const startISO = start.toISOString().slice(0,10);
  const endISO = end.toISOString().slice(0,10);

  // Order by date desc; filter end boundary on client to avoid extra index
  const qy = query(colRef, where("date", ">=", startISO), orderBy("date", "desc"));
  const snap = await getDocs(qy);
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return rows.filter(r => (r.date || "") <= endISO);
}

/** Real streak: consecutive days up to today with >=1 meal log */
export function calcStreakFromLogsRange(logs) {
  const days = new Set(
    logs
      .filter(l => (l.category || "meal") === "meal")
      .map(l => l.date || (l.timestamp && new Date(l.timestamp).toISOString().slice(0,10)))
      .filter(Boolean)
  );
  let s = 0;
  const d = new Date();
  while (true) {
    const iso = d.toISOString().slice(0,10);
    if (days.has(iso)) { s++; d.setDate(d.getDate() - 1); } else break;
  }
  return s;
}

/** Last meal snippet from a list (newest first) */
export function lastMealInfo(logs) {
  const m = logs.find(l => (l.category || "meal") === "meal");
  if (!m) return { title: null, date: null, calories: null };
  return {
    title: m.item || m.name || "Meal",
    date: m.date || (m.timestamp && new Date(m.timestamp).toISOString().slice(0,10)) || null,
    calories: m.calories ?? m.macros?.calories_kcal ?? null,
  };
}
