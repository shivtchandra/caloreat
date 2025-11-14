// src/FriendsHub.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import StickerField from "./StickerField";
import {
  listFriends,
  listIncomingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriendActivityWindow,
  calcStreakFromLogsRange,
  lastMealInfo,
  getFriendLogsToday,
  ensureDMThread,
  watchThreadMessages,
  sendThreadMessage,
  listMyCommunities,
  createCommunity,
  watchGroupMessages,
  sendGroupMessage,
} from "./firebaseHelpers";
import "./App.css";

// Firebase storage helpers
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

/* ---------- Inline styles for drawers / sheet (no extra lib) ---------- */
const styles = {
  shell: { maxWidth: 1152, margin: "0 auto", padding: 16 },
  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    paddingBottom: 10,
    marginBottom: 10,
    background: "linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.65))",
    backdropFilter: "blur(6px)",
    borderBottom: "1px solid rgba(0,0,0,.06)",
  },
  stories: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    padding: "10px 2px 4px 2px",
    alignItems: "center",
  },
  storyBtn: { appearance: "none", border: "none", background: "transparent", cursor: "pointer", padding: 0, textAlign: "center" },
  ring: (active, size = 66, gradient = null) => ({
    width: size,
    height: size,
    borderRadius: 999,
    padding: 4,
    display: "grid",
    placeItems: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,.08)",
    background: gradient
      ? gradient
      : active
      ? "conic-gradient(#ff8a65,#ffb86b,#ff8a65)"
      : "conic-gradient(#e6e4ea,#f3f4fb,#e6e4ea)",
  }),
  avatar: (size = 58) => ({
    width: size - 12,
    height: size - 12,
    borderRadius: 999,
    background: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: Math.round(size / 3.6),
    color: "#111",
  }),
  card: {
    background: "rgba(247,242,239,.88)",
    border: "1px solid #e9e4df",
    borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,.10)",
    padding: 14,
  },
  h3: { margin: 0, fontWeight: 800 },
  subtle: { color: "#6b7280" },

  // Drawers & sheet
  drawerBase: (side) => ({
    position: "fixed",
    top: 0,
    bottom: 0,
    width: "88vw",
    maxWidth: 420,
    [side]: 0,
    transform: `translateX(${side === "left" ? "-105%" : "105%"})`,
    transition: "transform .28s ease",
    background: "rgba(247,242,239,.98)",
    border: "1px solid #e9e4df",
    boxShadow: side === "left" ? "12px 0 40px rgba(0,0,0,.14)" : "-12px 0 40px rgba(0,0,0,.14)",
    zIndex: 40,
    display: "flex",
    flexDirection: "column",
  }),
  drawerOpen: { transform: "translateX(0%)" },
  sheetBase: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    background: "rgba(247,242,239,.98)",
    border: "1px solid #e9e4df",
    boxShadow: "0 -16px 40px rgba(0,0,0,.14)",
    transform: "translateY(105%)",
    transition: "transform .28s ease",
    zIndex: 50,
  },
  sheetOpen: { transform: "translateY(0%)" },
  scrim: { position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", zIndex: 30 },
  fabWrap: { position: "fixed", right: 16, bottom: 16, display: "grid", gap: 10, zIndex: 45 },
  fab: { background: "#111", color: "#fff", padding: "12px 14px", borderRadius: 999, border: "none", fontWeight: 800, boxShadow: "0 10px 28px rgba(0,0,0,.2)", cursor: "pointer" },
};

/* ---------- Small atoms ---------- */
const Pill = ({ children }) => (
  <span style={{ background: "#effaf2", color: "#0f6a1a", padding: "4px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12 }}>
    {children}
  </span>
);

/* ---------- Main ---------- */
export default function FriendsHub() {
  const { user } = useAuth();
  const uid = user?.uid;

  // data
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [communities, setCommunities] = useState([]);

  // selection
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);

  // today feed + chat
  const [friendFeed, setFriendFeed] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupText, setGroupText] = useState("");

  // ui chrome
  const [openLeft, setOpenLeft] = useState(false); // Friends/Requests/Communities
  const [openRight, setOpenRight] = useState(false); // Chat drawer
  const [openSheet, setOpenSheet] = useState(false); // Add Friend sheet
  const [snapView, setSnapView] = useState(false); // Snap-style stories toggle

  // add friend form
  const [friendUidInput, setFriendUidInput] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  // upload state
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  /* BG */
  const GradientBG = () => (
    <>
      <div
        style={{
          position: "fixed",
          inset: "-10vh -10vw -10vh -10vw",
          zIndex: -2,
          background: `
          radial-gradient(1200px 800px at 10% -5%, #fdebd2, transparent),
          radial-gradient(1200px 800px at 90% 110%, #fdebd2, transparent),
          linear-gradient(180deg, #fff7da, #fff)
        `,
        }}
      />
      <StickerField className="fh-stickers" count={14} stickers={["🍎", "🥗", "🍳", "🍓", "🍪", "🥛", "🍌", "💪", "🥕", "🍞"]} seed={999} />
    </>
  );

  /* Prefill ?add= */
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const add = p.get("add");
      if (add && !friendUidInput) {
        setFriendUidInput(add);
        setOpenSheet(true);
      }
    } catch {}
    // eslint-disable-next-line
  }, []);

  /* Load lists + enrich */
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const [reqs, fs, groups] = await Promise.all([listIncomingRequests(uid), listFriends(uid), listMyCommunities(uid)]);
        const enriched = await Promise.all(
          fs.map(async (f) => {
            const logs = await getFriendActivityWindow(f.uid, 60);
            const streak = calcStreakFromLogsRange(logs);
            const last = lastMealInfo(logs);
            const today = new Date().toISOString().slice(0, 10);
            return {
              ...f,
              streak,
              lastTitle: last.title,
              lastDate: last.date,
              lastCalories: last.calories,
              activeToday: last.date === today,
              initials: (f.displayName?.slice(0, 2) || f.uid.slice(0, 2)).toUpperCase(),
            };
          })
        );
        setRequests(reqs || []);
        setFriends(enriched || []);
        setCommunities(groups || []);
        if (!selectedFriend && enriched?.[0]) setSelectedFriend(enriched[0]);
      } catch (e) {
        console.error("FriendsHub load failed", e);
      }
    })();
  }, [uid]); // eslint-disable-line

  /* Selecting a friend -> load TODAY feed + spin up DM thread */
  useEffect(() => {
    if (!selectedFriend || !uid) return;
    let mounted = true;
    (async () => {
      try {
        const rows = await getFriendLogsToday(selectedFriend.uid);
        if (mounted) setFriendFeed(rows.filter((l) => (l.category || "meal") === "meal"));
      } catch (e) {
        console.error("[Friend feed read failed]", e);
      }
      try {
        const tid = await ensureDMThread(uid, selectedFriend.uid);
        if (mounted) setThreadId(tid);
      } catch (e) {
        console.error("[DM thread setup failed]", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedFriend, uid]);

  /* Watch chats */
  useEffect(() => {
    if (!threadId) return;
    const un = watchThreadMessages(threadId, setMessages);
    return () => un && un();
  }, [threadId]);

  useEffect(() => {
    if (!activeGroup) return;
    const un = watchGroupMessages(activeGroup, setGroupMessages);
    return () => un && un();
  }, [activeGroup]);

  /* Actions */
  const addFriend = async () => {
    if (!friendUidInput.trim() || !uid) return;
    try {
      await sendFriendRequest(uid, friendUidInput.trim());
      setFriendUidInput("");
      alert("Request sent");
      setOpenSheet(false);
    } catch (e) {
      alert(e.message);
    }
  };
  const acceptReq = async (rid) => {
    await acceptFriendRequest(uid, rid);
    setRequests((prev) => prev.filter((r) => r.id !== rid));
  };
  const declineReq = async (rid) => {
    await declineFriendRequest(uid, rid);
    setRequests((prev) => prev.filter((r) => r.id !== rid));
  };
  const toggleMember = (fuid) => setSelectedMembers((prev) => (prev.includes(fuid) ? prev.filter((x) => x !== fuid) : [...prev, fuid]));
  const createGroup = async () => {
    const id = await createCommunity(uid, groupName || "My Group", selectedMembers);
    setGroupName("");
    setSelectedMembers([]);
    setActiveGroup(id);
    setOpenLeft(false); // close drawer
  };
  const sendMsg = async () => {
    if (!threadId || !msgText.trim() || !uid) return;
    await sendThreadMessage(threadId, uid, msgText.trim());
    setMsgText("");
  };
  const sendGroupMsg = async () => {
    if (!activeGroup || !groupText.trim() || !uid) return;
    await sendGroupMessage(activeGroup, uid, groupText.trim());
    setGroupText("");
  };

  /* Feed grouping */
  const groupedFeed = (() => {
    const map = {};
    for (const l of friendFeed) {
      const d = l.date || (l.timestamp && new Date(l.timestamp).toISOString().slice(0, 10)) || "Unknown";
      (map[d] = map[d] || []).push(l);
    }
    const keys = Object.keys(map).sort((a, b) => b.localeCompare(a));
    return { map, keys };
  })();
  const prettyDate = (iso) => {
    const today = new Date().toISOString().slice(0, 10);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yiso = y.toISOString().slice(0, 10);
    if (iso === today) return "Today";
    if (iso === yiso) return "Yesterday";
    return iso;
  };

  /* Sharing made simple: copies invite link or uses native share */
  const shareInvite = async () => {
    const inviteUrl = `${window.location.origin}/app/friends?add=${encodeURIComponent(uid || "")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Add me", text: "Add me on Food Analysis", url: inviteUrl });
        return;
      } catch (e) {
        // fall back to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert("Invite link copied!");
    } catch (e) {
      prompt("Copy this link:", inviteUrl);
    }
  };

  /* Upload profile photo -> Firebase Storage + set photo URL in user's profile doc */
  const onFileChosen = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file || !uid) return;
    try {
      setUploading(true);
      const storage = getStorage();
      const ref = storageRef(storage, `users/${uid}/profile_photo_${Date.now()}.${file.name.split(".").pop()}`);
      const snap = await uploadBytes(ref, file);
      const url = await getDownloadURL(snap.ref);

      // write photo URL into Firestore user's profile document (main)
      try {
        const profileRef = doc(db, "users", uid, "profile", "main");
        await updateDoc(profileRef, { photoURL: url });
      } catch (e) {
        // if update fails, still keep the url locally
        console.warn("Failed to write profile photo to Firestore:", e);
      }

      setPhotoUrl(url);
      alert("Photo uploaded!");
    } catch (e) {
      console.error("Upload failed:", e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* UI */
  return (
    <>
      <GradientBG />

      {/* Sticky top: title + stories row */}
      <div style={styles.stickyTop}>
        <div style={styles.shell}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontWeight: 900 }}>Friends</h2>
              <div style={{ color: "#6b7280" }}>Connect, compare streaks and chat</div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.fab, padding: "10px 12px" }} onClick={() => setOpenLeft(true)}>
                ☰
              </button>
              <button style={{ ...styles.fab, padding: "10px 12px" }} onClick={() => setOpenRight(true)}>
                💬
              </button>
              <button style={{ ...styles.fab, padding: "10px 12px" }} onClick={() => setOpenSheet(true)}>
                ＋
              </button>
            </div>
          </div>

          {/* Stories (horizontal scroll). SnapView toggles to large rings */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Stories</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Quick view</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={snapView} onChange={(e) => setSnapView(e.target.checked)} />
                <span style={{ fontSize: 13, color: "#6b7280" }}>Snap view</span>
              </label>
            </div>
          </div>

          <div style={{ ...styles.stories, marginTop: 10 }}>
            {friends.map((it) => (
              <button
                key={it.uid}
                style={styles.storyBtn}
                onClick={() => {
                  setSelectedFriend(it);
                  setActiveGroup(null);
                }}
                title={it.uid}
              >
                <div style={styles.ring(it.activeToday, snapView ? 94 : 66, snapView ? "conic-gradient(#ff8a65,#ffd7a8,#ff8a65)" : null)}>
                  <div style={styles.avatar(snapView ? 86 : 58)}>{it.initials}</div>
                </div>
                <div style={{ marginTop: 8, fontSize: snapView ? 14 : 12, textAlign: "center" }}>
                  <div style={{ fontWeight: 700 }}>{it.displayName ? it.displayName.split(" ")[0] : it.uid.slice(0, 8)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>🔥 {it.streak ?? 0}d</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main: only TODAY feed (clean, uncluttered) */}
      <div style={styles.shell}>
        <div style={{ ...styles.card, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <h3 style={styles.h3}>{selectedFriend ? `Today — ${selectedFriend.displayName || selectedFriend.uid.slice(0, 8)}` : "Today"}</h3>
              <div style={styles.subtle}>
                {selectedFriend ? `${selectedFriend.streak ?? 0} day(s) streak • ${selectedFriend.activeToday ? "active today" : "no activity today"}` : "Friends' latest meals"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Profile photo uploader (this user) */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, overflow: "hidden", border: "1px solid #e9e4df", display: "grid", placeItems: "center" }}>
                  {photoUrl ? <img src={photoUrl} alt="you" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontWeight: 800 }}>{(user?.email || "U").slice(0, 1).toUpperCase()}</div>}
                </div>
                <input type="file" accept="image/*" onChange={onFileChosen} style={{ display: "none" }} />
              </label>

              <button style={{ ...styles.fab, padding: "10px 12px" }} onClick={shareInvite}>
                Share Invite
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {friendFeed.length === 0 ? (
              <div style={{ ...styles.subtle, marginTop: 8, textAlign: "center", padding: 22 }}>
                No meals logged today.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {groupedFeed.keys.map((k) => (
                  <div key={k}>
                    <div style={{ fontWeight: 700, margin: "8px 0" }}>{prettyDate(k)}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {(groupedFeed.map[k] || []).map((l) => (
                        <div key={l.id} style={{ ...styles.card, padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontWeight: 600 }}>{l.item || l.name || "Meal"}</div>
                            <div style={{ opacity: 0.7 }}>{Math.round(l.calories ?? l.macros?.calories_kcal ?? 0)} kcal</div>
                          </div>
                          {l.macros && (
                            <div style={{ ...styles.subtle, fontSize: 12, marginTop: 6 }}>
                              P{l.macros.protein_g ?? "—"} • C{l.macros.total_carbohydrate_g ?? l.macros?.carbs_g ?? "—"} • F{l.macros.total_fat_g ?? "—"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating buttons for mobile (duplicate of header buttons for reachability) */}
      <div style={styles.fabWrap}>
        <button style={styles.fab} onClick={() => setOpenLeft(true)}>
          ☰
        </button>
        <button style={styles.fab} onClick={() => setOpenRight(true)}>
          💬
        </button>
        <button style={styles.fab} onClick={() => setOpenSheet(true)}>
          ＋
        </button>
      </div>

      {/* SCRIM */}
      {(openLeft || openRight || openSheet) && <div style={styles.scrim} onClick={() => { setOpenLeft(false); setOpenRight(false); setOpenSheet(false); }} />}

      {/* LEFT DRAWER: Friends / Requests / Communities */}
      <div style={{ ...styles.drawerBase("left"), ...(openLeft ? styles.drawerOpen : {}) }}>
        <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>People & Groups</strong>
          <button style={{ ...styles.fab, padding: "8px 10px" }} onClick={() => setOpenLeft(false)}>
            ✕
          </button>
        </div>

        <div style={{ padding: 14, overflow: "auto" }}>
          {/* requests */}
          <div style={{ ...styles.card, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={styles.h3}>Requests</h3>
              <span style={styles.subtle}>{requests.length}</span>
            </div>
            {requests.length === 0 ? (
              <div style={styles.subtle}>No pending requests.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {requests.map((r) => (
                  <div key={r.id} style={{ ...styles.card, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{(r.fromUid || "").slice(0, 8)}…</strong>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={styles.fab} onClick={() => acceptReq(r.id)}>
                          Accept
                        </button>
                        <button style={styles.fab} onClick={() => declineReq(r.id)}>
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* friends */}
          <div style={{ ...styles.card, padding: 12, marginBottom: 12 }}>
            <h3 style={styles.h3}>Friends</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {friends.map((f) => (
                <button
                  key={f.uid}
                  onClick={() => {
                    setSelectedFriend(f);
                    setActiveGroup(null);
                    setOpenLeft(false);
                  }}
                  style={{
                    ...styles.card,
                    padding: 10,
                    textAlign: "left",
                    cursor: "pointer",
                    border: selectedFriend?.uid === f.uid ? "2px solid #a5b4fc" : "1px solid #e9e4df",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 999, display: "grid", placeItems: "center", background: "#f3f4f6", fontWeight: 700, fontSize: 12 }}>
                      {f.initials}
                    </div>
                    <strong>{f.displayName || f.uid.slice(0, 8)}</strong>
                  </div>
                  <Pill>🔥 {f.streak ?? 0}d</Pill>
                </button>
              ))}
            </div>
          </div>

          {/* communities */}
          <div style={{ ...styles.card, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={styles.h3}>Communities</h3>
              <button style={styles.fab} onClick={() => createGroup()}>
                ＋
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {communities.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setActiveGroup(g.id);
                    setSelectedFriend(null);
                    setOpenLeft(false);
                    setOpenRight(true);
                  }}
                  style={{ ...styles.card, padding: 10, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{g.name}</strong>
                    <span style={{ ...styles.subtle, fontSize: 12 }}>{(g.members || []).length} members</span>
                  </div>
                </button>
              ))}
            </div>

            {/* quick create UI */}
            <div style={{ marginTop: 10 }}>
              <input placeholder="New group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #e9e4df" }} />
              <div style={{ ...styles.subtle, marginTop: 6 }}>Pick members:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {friends.map((f) => (
                  <label key={f.uid} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={selectedMembers.includes(f.uid)} onChange={() => toggleMember(f.uid)} />
                    <span>{f.displayName || f.uid.slice(0, 8)}</span>
                  </label>
                ))}
              </div>
              <button style={{ ...styles.fab, marginTop: 8 }} onClick={createGroup}>
                Create
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT DRAWER: Chat (DM or Group) */}
      <div style={{ ...styles.drawerBase("right"), ...(openRight ? styles.drawerOpen : {}) }}>
        <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{activeGroup ? "Community Chat" : "Direct Messages"}</strong>
          <button style={{ ...styles.fab, padding: "8px 10px" }} onClick={() => setOpenRight(false)}>
            ✕
          </button>
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
          <div style={{ ...styles.card, padding: 12, flex: "1 1 auto", overflow: "auto" }}>
            {activeGroup
              ? groupMessages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8 }}>
                    <div style={{ ...styles.subtle, fontSize: 12 }}>{m.fromUid.slice(0, 8)}…</div>
                    <div style={{ display: "inline-block", background: "#f3f4f6", borderRadius: 14, padding: "6px 10px" }}>{m.text}</div>
                  </div>
                ))
              : messages.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8, textAlign: m.fromUid === uid ? "right" : "left" }}>
                    <span
                      style={{
                        display: "inline-block",
                        background: m.fromUid === uid ? "#111" : "#f3f4f6",
                        color: m.fromUid === uid ? "#fff" : "#111",
                        borderRadius: 14,
                        padding: "6px 10px",
                      }}
                    >
                      {m.text}
                    </span>
                  </div>
                ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={activeGroup ? groupText : msgText} onChange={(e) => (activeGroup ? setGroupText(e.target.value) : setMsgText(e.target.value))} placeholder="Write a message" style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid #e9e4df" }} onKeyDown={(e) => { if (e.key === "Enter") { activeGroup ? sendGroupMsg() : sendMsg(); } }} />
            <button style={styles.fab} onClick={activeGroup ? sendGroupMsg : sendMsg}>
              Send
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM SHEET: Add friend + share */}
      <div style={{ ...styles.sheetBase, ...(openSheet ? styles.sheetOpen : {}) }}>
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Add a Friend</strong>
            <button style={{ ...styles.fab, padding: "8px 10px" }} onClick={() => setOpenSheet(false)}>
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div style={styles.subtle}>Share your ID or paste theirs:</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={friendUidInput} onChange={(e) => setFriendUidInput(e.target.value)} placeholder="Enter friend's UID" style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid #e9e4df" }} />
              <button style={styles.fab} onClick={addFriend}>
                Send
              </button>
            </div>

            {/* Share my own ID + invite link */}
            <div style={{ ...styles.card, padding: 12 }}>
              <div style={styles.subtle}>Your ID</div>
              <code style={{ background: "#f3f4f6", padding: "4px 8px", borderRadius: 8, display: "inline-block" }}>{uid}</code>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={styles.fab}
                  onClick={async () => {
                    const inviteUrl = `${window.location.origin}/app/friends?add=${encodeURIComponent(uid || "")}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: "Add me", text: "Add me on Food Analysis", url: inviteUrl });
                      } catch {}
                    } else {
                      await navigator.clipboard.writeText(inviteUrl);
                      alert("Invite link copied!");
                    }
                  }}
                >
                  Share Invite
                </button>
                <button
                  style={styles.fab}
                  onClick={async () => {
                    await navigator.clipboard.writeText(uid || "");
                    alert("ID copied!");
                  }}
                >
                  Copy ID
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
