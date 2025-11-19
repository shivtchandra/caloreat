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
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebaseConfig";

/* ---------- Styles ---------- */
const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    background: "white",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "12px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    color: "white",
    margin: 0,
  },
  button: {
    background: "white",
    border: "none",
    borderRadius: "12px",
    padding: "10px 20px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    transition: "transform 0.2s",
  },
  primaryButton: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "12px 24px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    fontSize: "14px",
    marginBottom: "12px",
    boxSizing: "border-box",
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  modalContent: {
    background: "white",
    borderRadius: "20px",
    padding: "24px",
    maxWidth: "500px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
  },
  calendar: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
    marginTop: "12px",
  },
  calendarDay: {
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "500",
  },
  friendCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "#f8fafc",
    marginBottom: "8px",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "18px",
  },
  badge: {
    background: "#10b981",
    color: "white",
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "600",
  },
  tabContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    overflowX: "auto",
  },
  tab: {
    padding: "8px 16px",
    borderRadius: "12px",
    border: "none",
    background: "#f1f5f9",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  activeTab: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
  },
};

export default function FriendsHub() {
  const { user } = useAuth();
  const uid = user?.uid;

  // Data
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [userActivityDays, setUserActivityDays] = useState([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState("friends");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  
  // Form inputs
  const [friendUidInput, setFriendUidInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [threadId, setThreadId] = useState(null);

  // Load user's activity days for streak calendar
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const logs = await getFriendActivityWindow(uid, 365); // Last year
        const days = new Set();
        logs.forEach(log => {
          const date = log.date || (log.timestamp && new Date(log.timestamp).toISOString().slice(0, 10));
          if (date) days.add(date);
        });
        setUserActivityDays(Array.from(days).sort());
      } catch (e) {
        console.error("Failed to load activity", e);
      }
    })();
  }, [uid]);

  // Load friends and requests
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const [reqs, fs] = await Promise.all([
          listIncomingRequests(uid),
          listFriends(uid),
        ]);
        
        const enriched = await Promise.all(
          fs.map(async (f) => {
            const logs = await getFriendActivityWindow(f.uid, 60);
            const streak = calcStreakFromLogsRange(logs);
            const last = lastMealInfo(logs);
            const today = new Date().toISOString().slice(0, 10);
            return {
              ...f,
              streak,
              activeToday: last.date === today,
              initials: (f.displayName?.slice(0, 2) || f.uid.slice(0, 2)).toUpperCase(),
            };
          })
        );
        
        setRequests(reqs || []);
        setFriends(enriched || []);
      } catch (e) {
        console.error("Failed to load data", e);
      }
    })();
  }, [uid]);

  // Watch chat messages
  useEffect(() => {
    if (!threadId) return;
    const unsubscribe = watchThreadMessages(threadId, setMessages);
    return () => unsubscribe && unsubscribe();
  }, [threadId]);

  // Prefill friend UID from URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const addUid = params.get("add");
      if (addUid && !friendUidInput) {
        setFriendUidInput(addUid);
        setShowAddModal(true);
      }
    } catch {}
  }, []);

  // Actions
  const addFriend = async () => {
    if (!friendUidInput.trim() || !uid) return;
    try {
      await sendFriendRequest(uid, friendUidInput.trim());
      setFriendUidInput("");
      alert("Friend request sent!");
      setShowAddModal(false);
    } catch (e) {
      alert(e.message);
    }
  };

  const acceptReq = async (rid) => {
    await acceptFriendRequest(uid, rid);
    setRequests(prev => prev.filter(r => r.id !== rid));
  };

  const declineReq = async (rid) => {
    await declineFriendRequest(uid, rid);
    setRequests(prev => prev.filter(r => r.id !== rid));
  };

  const openChat = async (friend) => {
    setSelectedFriend(friend);
    try {
      const tid = await ensureDMThread(uid, friend.uid);
      setThreadId(tid);
      setShowChatModal(true);
    } catch (e) {
      console.error("Failed to open chat", e);
    }
  };

  const sendMsg = async () => {
    if (!threadId || !msgText.trim() || !uid) return;
    await sendThreadMessage(threadId, uid, msgText.trim());
    setMsgText("");
  };

  const shareInvite = async () => {
    const inviteUrl = `${window.location.origin}/app/friends?add=${encodeURIComponent(uid || "")}`;
    const shareData = {
      title: "Join me on Food Analysis!",
      text: `Hey! Track your meals with me on Food Analysis. Use my code: ${uid?.slice(0, 8)}`,
      url: inviteUrl,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        alert("Invite link copied to clipboard!");
      }
    } catch (e) {
      console.error("Share failed", e);
    }
  };

  // Generate calendar for current month
  const generateCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const calendar = [];
    const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
    
    // Add day names
    dayNames.forEach(name => {
      calendar.push({ type: "header", label: name });
    });
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      calendar.push({ type: "empty" });
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const hasActivity = userActivityDays.includes(dateStr);
      const isToday = dateStr === new Date().toISOString().slice(0, 10);
      calendar.push({ type: "day", day, hasActivity, isToday });
    }
    
    return calendar;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🍽️ Friends</h1>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button style={styles.button} onClick={() => setShowStreakModal(true)}>
            📅 My Streak
          </button>
          <button style={styles.button} onClick={shareInvite}>
            📤 Share
          </button>
          <button style={styles.primaryButton} onClick={() => setShowAddModal(true)}>
            + Add Friend
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabContainer}>
        <button
          style={{ ...styles.tab, ...(activeTab === "friends" ? styles.activeTab : {}) }}
          onClick={() => setActiveTab("friends")}
        >
          Friends ({friends.length})
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === "requests" ? styles.activeTab : {}) }}
          onClick={() => setActiveTab("requests")}
        >
          Requests ({requests.length})
        </button>
      </div>

      {/* Content */}
      <div style={styles.card}>
        {activeTab === "friends" && (
          <>
            {friends.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>👥</div>
                <p>No friends yet. Add your first friend to get started!</p>
                <button style={styles.primaryButton} onClick={() => setShowAddModal(true)}>
                  Add Friend
                </button>
              </div>
            ) : (
              friends.map(friend => (
                <div
                  key={friend.uid}
                  style={styles.friendCard}
                  onClick={() => openChat(friend)}
                >
                  <div style={styles.avatar}>{friend.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                      {friend.displayName || friend.uid.slice(0, 8)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      🔥 {friend.streak || 0} day streak
                      {friend.activeToday && " • Active today"}
                    </div>
                  </div>
                  <button
                    style={{ ...styles.button, padding: "8px 16px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openChat(friend);
                    }}
                  >
                    💬
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "requests" && (
          <>
            {requests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📬</div>
                <p>No pending requests</p>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} style={styles.friendCard}>
                  <div style={styles.avatar}>
                    {(req.fromUid || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600" }}>
                      {req.fromUid?.slice(0, 12)}...
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Wants to connect
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      style={{ ...styles.primaryButton, padding: "8px 16px" }}
                      onClick={() => acceptReq(req.id)}
                    >
                      Accept
                    </button>
                    <button
                      style={{ ...styles.button, padding: "8px 16px" }}
                      onClick={() => declineReq(req.id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddModal && (
        <div style={styles.modal} onClick={() => setShowAddModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Add Friend</h2>
            
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Friend's User ID
              </label>
              <input
                style={styles.input}
                value={friendUidInput}
                onChange={(e) => setFriendUidInput(e.target.value)}
                placeholder="Paste their user ID here"
              />
              <button style={styles.primaryButton} onClick={addFriend}>
                Send Friend Request
              </button>
            </div>

            <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "12px" }}>
              <div style={{ fontWeight: "600", marginBottom: "8px" }}>Your User ID</div>
              <code style={{
                background: "white",
                padding: "8px 12px",
                borderRadius: "8px",
                display: "block",
                fontSize: "12px",
                wordBreak: "break-all",
              }}>
                {uid}
              </code>
              <button
                style={{ ...styles.button, marginTop: "12px", width: "100%" }}
                onClick={async () => {
                  await navigator.clipboard.writeText(uid || "");
                  alert("ID copied!");
                }}
              >
                Copy My ID
              </button>
            </div>

            <button
              style={{ ...styles.button, marginTop: "16px", width: "100%" }}
              onClick={() => setShowAddModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Streak Calendar Modal */}
      {showStreakModal && (
        <div style={styles.modal} onClick={() => setShowStreakModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📅 Your Activity Streak</h2>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={styles.badge}>
                🔥 {userActivityDays.length} days logged this year
              </div>
            </div>

            <div style={{ marginBottom: "8px", fontWeight: "600" }}>
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>

            <div style={styles.calendar}>
              {generateCalendar().map((cell, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.calendarDay,
                    background: cell.type === "header"
                      ? "transparent"
                      : cell.type === "empty"
                      ? "transparent"
                      : cell.hasActivity
                      ? "#10b981"
                      : "#f1f5f9",
                    color: cell.type === "header"
                      ? "#64748b"
                      : cell.hasActivity
                      ? "white"
                      : "#94a3b8",
                    fontWeight: cell.isToday ? "700" : "500",
                    border: cell.isToday ? "2px solid #667eea" : "none",
                  }}
                >
                  {cell.type === "header" ? cell.label : cell.type === "day" ? cell.day : ""}
                </div>
              ))}
            </div>

            <div style={{ marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "12px", fontSize: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <div style={{ width: "16px", height: "16px", background: "#10b981", borderRadius: "4px" }}></div>
                <span>Days with logged meals</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "16px", height: "16px", background: "#f1f5f9", borderRadius: "4px" }}></div>
                <span>No activity</span>
              </div>
            </div>

            <button
              style={{ ...styles.button, marginTop: "16px", width: "100%" }}
              onClick={() => setShowStreakModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && selectedFriend && (
        <div style={styles.modal} onClick={() => setShowChatModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={styles.avatar}>{selectedFriend.initials}</div>
              <div>
                <h2 style={{ margin: 0 }}>
                  {selectedFriend.displayName || selectedFriend.uid.slice(0, 8)}
                </h2>
                <div style={{ fontSize: "14px", color: "#64748b" }}>
                  🔥 {selectedFriend.streak || 0} day streak
                </div>
              </div>
            </div>

            <div style={{
              height: "300px",
              overflowY: "auto",
              padding: "16px",
              background: "#f8fafc",
              borderRadius: "12px",
              marginBottom: "16px",
            }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "40px 20px" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>💬</div>
                  <div>No messages yet. Say hi!</div>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: "12px",
                      display: "flex",
                      justifyContent: msg.fromUid === uid ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{
                      background: msg.fromUid === uid
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "white",
                      color: msg.fromUid === uid ? "white" : "#1e293b",
                      padding: "8px 12px",
                      borderRadius: "12px",
                      maxWidth: "70%",
                      wordBreak: "break-word",
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                style={{ ...styles.input, marginBottom: 0 }}
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => e.key === "Enter" && sendMsg()}
              />
              <button style={styles.primaryButton} onClick={sendMsg}>
                Send
              </button>
            </div>

            <button
              style={{ ...styles.button, marginTop: "16px", width: "100%" }}
              onClick={() => setShowChatModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
