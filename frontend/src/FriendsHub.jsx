import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

/* ---------- Styles ---------- */
const styles = {
  pageWrap: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #fffaf3 0%, #fff2e2 90%)',
    padding: '16px',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box'
  },
  centerOuter: {
    width: '100%',
    maxWidth: '1152px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 10,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#5c4f3f',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '4px',
  },
  glassCard: {
    borderRadius: '1.5rem',
    padding: '24px',
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    boxShadow: '0 10px 30px rgba(16,24,40,0.06)',
    marginBottom: '16px',
  },
  button: {
    background: '#eae4da',
    color: '#4b4033',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 18px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    transition: 'all 0.25s ease',
  },
  homeButton: {
    border: "1px solid rgba(255,255,255,0.4)",
    borderRadius: "999px",
    padding: "8px 16px",
    background: "rgba(255,255,255,0.18)",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
    backdropFilter: "blur(6px)",
  },
  primaryButton: {
    background: '#bca987',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 24px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  input: {
    width: '100%',
    backgroundColor: '#f9fafb',
    border: '1px solid #e0e0e0',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: '#374151',
    boxSizing: 'border-box',
    marginBottom: '12px',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalContent: {
    background: 'white',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  streakSection: {
    background: 'linear-gradient(180deg,#fffdf7 0%, #fff7e8 100%)',
    border: '1px solid #f5e6c8',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
  },
  calendar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '6px',
    marginTop: '16px',
  },
  calendarDay: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  friendCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #f0e4c9',
    marginBottom: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #bca987 0%, #d4b896 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '18px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  badge: {
    background: '#bddfa3',
    color: '#3f5c2c',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    overflowX: 'auto',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '8px',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    color: '#6b7280',
    transition: 'all 0.2s',
  },
  activeTab: {
    background: '#f0e4c9',
    color: '#4b4033',
  },
};

export default function FriendsHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;

  // Data
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [userActivityDays, setUserActivityDays] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // UI State
  const [activeTab, setActiveTab] = useState("friends");
  const [showAddModal, setShowAddModal] = useState(false);
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
        const logs = await getFriendActivityWindow(uid, 365);
        const days = new Set();
        logs.forEach(log => {
          const date = log.date || (log.timestamp && new Date(log.timestamp).toISOString().slice(0, 10));
          if (date) days.add(date);
        });
        const sortedDays = Array.from(days).sort();
        setUserActivityDays(sortedDays);

        // Calculate current streak
        const streak = calcStreakFromLogsRange(logs);
        setCurrentStreak(streak || 0);
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
    } catch { }
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

  // Generate calendar for current month + previous 2 months (3 months total)
  const generateCalendar = () => {
    const now = new Date();
    const calendars = [];

    // Generate for 3 months (current + 2 previous)
    for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const monthCal = {
        label: targetDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        days: []
      };

      const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
      dayNames.forEach(name => {
        monthCal.days.push({ type: "header", label: name });
      });

      // Empty cells before month starts
      for (let i = 0; i < firstDay; i++) {
        monthCal.days.push({ type: "empty" });
      }

      // Days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const hasActivity = userActivityDays.includes(dateStr);
        const isToday = dateStr === new Date().toISOString().slice(0, 10);
        monthCal.days.push({ type: "day", day, hasActivity, isToday });
      }

      calendars.push(monthCal);
    }

    return calendars;
  };

  const calendars = generateCalendar();

  return (
    <div style={styles.pageWrap}>
      <StickerField
        count={18}
        stickers={["🍎", "🥗", "🍳", "🍓", "🍪", "🥛", "🍌", "💪", "🥕", "🍞", "🍇", "🥑", "🍊", "🥦", "🍉", "🥚", "🍑", "🥨"]}
        seed={999}
      />

      <div style={styles.centerOuter}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button style={styles.homeButton} onClick={() => navigate("/")}>
              ← Home
            </button>
            <div>
              <h1 style={styles.title}>Friends Hub</h1>
              <div style={styles.subtitle}>Connect, compare and chat</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={styles.button} onClick={shareInvite}>
              📤 Share Invite
            </button>
            <button style={styles.primaryButton} onClick={() => setShowAddModal(true)}>
              + Add Friend
            </button>
          </div>
        </div>

        {/* My Streak Section - Always Visible */}
        <div style={styles.streakSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#5c4f3f', fontWeight: '700' }}>
              📅 Your Activity Streak
            </h2>
            <div style={styles.badge}>
              🔥 {currentStreak} day{currentStreak !== 1 ? 's' : ''} streak
            </div>
          </div>

          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '12px' }}>
            {userActivityDays.length} days logged this year
          </div>

          {/* Calendars for last 3 months */}
          {calendars.map((cal, idx) => (
            <div key={idx} style={{ marginBottom: idx < calendars.length - 1 ? '24px' : 0 }}>
              <div style={{ marginBottom: '12px', fontWeight: '600', fontSize: '0.95rem', color: '#4b4033' }}>
                {cal.label}
              </div>

              <div style={styles.calendar}>
                {cal.days.map((cell, cidx) => (
                  <div
                    key={cidx}
                    style={{
                      ...styles.calendarDay,
                      background: cell.type === "header"
                        ? "transparent"
                        : cell.type === "empty"
                          ? "transparent"
                          : cell.hasActivity
                            ? "#bddfa3"
                            : "#f1f5f9",
                      color: cell.type === "header"
                        ? "#9ca3af"
                        : cell.hasActivity
                          ? "#3f5c2c"
                          : "#cbd5e1",
                      fontWeight: cell.isToday ? "700" : cell.type === "header" ? "600" : "500",
                      border: cell.isToday ? "2px solid #bca987" : "none",
                      boxShadow: cell.hasActivity && cell.type === "day" ? "0 2px 8px rgba(189,223,163,0.3)" : "none",
                    }}
                  >
                    {cell.type === "header" ? cell.label : cell.type === "day" ? cell.day : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '12px', fontSize: '13px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', background: '#bddfa3', borderRadius: '6px', boxShadow: '0 2px 8px rgba(189,223,163,0.3)' }}></div>
              <span style={{ color: '#4b4033' }}>Active day</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '20px', height: '20px', background: '#f1f5f9', borderRadius: '6px' }}></div>
              <span style={{ color: '#6b7280' }}>No activity</span>
            </div>
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
        <div style={styles.glassCard}>
          {activeTab === "friends" && (
            <>
              {friends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <p>No friends yet. Add your first friend to get started!</p>
                  <button style={styles.primaryButton} onClick={() => setShowAddModal(true)}>
                    Add Friend
                  </button>
                </div>
              ) : (
                friends.map(friend => (
                  <div
                    key={friend.uid}
                    style={{
                      ...styles.friendCard,
                      ':hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }
                    }}
                    onClick={() => openChat(friend)}
                  >
                    <div style={styles.avatar}>{friend.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
                        {friend.displayName || friend.uid.slice(0, 8)}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        🔥 {friend.streak || 0} day streak
                        {friend.activeToday && " • ✅ Active today"}
                      </div>
                    </div>
                    <button
                      style={{ ...styles.button, padding: '8px 16px' }}
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
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📬</div>
                  <p>No pending requests</p>
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} style={styles.friendCard}>
                    <div style={styles.avatar}>
                      {(req.fromUid || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#374151' }}>
                        {req.fromUid?.slice(0, 12)}...
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        Wants to connect
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={styles.primaryButton}
                        onClick={() => acceptReq(req.id)}
                      >
                        Accept
                      </button>
                      <button
                        style={styles.button}
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
              <h2 style={{ marginTop: 0, color: '#5c4f3f' }}>Add Friend</h2>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4b4033' }}>
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

              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#4b4033' }}>Your User ID</div>
                <code style={{
                  background: 'white',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  display: 'block',
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  border: '1px solid #e0e0e0',
                }}>
                  {uid}
                </code>
                <button
                  style={{ ...styles.button, marginTop: '12px', width: '100%' }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(uid || "");
                    alert("ID copied!");
                  }}
                >
                  Copy My ID
                </button>
              </div>

              <button
                style={{ ...styles.button, marginTop: '16px', width: '100%' }}
                onClick={() => setShowAddModal(false)}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={styles.avatar}>{selectedFriend.initials}</div>
                <div>
                  <h2 style={{ margin: 0, color: '#5c4f3f' }}>
                    {selectedFriend.displayName || selectedFriend.uid.slice(0, 8)}
                  </h2>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    🔥 {selectedFriend.streak || 0} day streak
                  </div>
                </div>
              </div>

              <div style={{
                height: '300px',
                overflowY: 'auto',
                padding: '16px',
                background: '#f9fafb',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid #e5e7eb',
              }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 20px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                    <div>No messages yet. Say hi!</div>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: msg.fromUid === uid ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={{
                        background: msg.fromUid === uid ? '#bca987' : 'white',
                        color: msg.fromUid === uid ? 'white' : '#1e293b',
                        padding: '10px 14px',
                        borderRadius: '14px',
                        maxWidth: '70%',
                        wordBreak: 'break-word',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
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
                style={{ ...styles.button, marginTop: '16px', width: '100%' }}
                onClick={() => setShowChatModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
