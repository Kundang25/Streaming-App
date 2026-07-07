import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import JoinGate from '../components/JoinGate';
import YoutubePlayer from '../components/YoutubePlayer';
import PlaybackControls from '../components/PlaybackControls';
import ParticipantList from '../components/ParticipantList';
import ChatPanel from '../components/ChatPanel';
import ReactionBar from '../components/ReactionBar';
import { LogOut, Copy, Check, Users, MessageSquare, ListVideo } from 'lucide-react';

const RoomPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const {
    userId,
    roomName,
    role,
    toasts,
    removeToast,
    removedByHost,
    leaveSession,
    addToast,
    queue,
    endedByHost,
    emitEndRoom,
    emitRemoveFromQueue
  } = useRoom();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'users' | 'queue'>('chat');

  // Triggered when user submits display name in the JoinGate
  const [, forceUpdate] = useState({});
  const handleJoinSuccess = () => {
    forceUpdate({});
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    addToast('Invitation link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    leaveSession();
    navigate('/');
  };

  const handleEndRoom = () => {
    if (confirm('Are you sure you want to end this watch party for all participants?')) {
      emitEndRoom();
    }
  };

  // 1. Session check: if no userId, show join gate
  if (!userId && roomCode) {
    return <JoinGate roomCode={roomCode} onJoinSuccess={handleJoinSuccess} />;
  }

  // 2. Kicked check: if removed by host, show removed overlay
  if (removedByHost) {
    return (
      <div style={styles.kickedOverlay}>
        <div className="glass-panel" style={styles.kickedCard}>
          <h2 style={{ color: '#EF4444', fontSize: '24px', marginBottom: '12px' }}>Access Denied</h2>
          <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>
            You have been removed from this watch party room by the Host.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // 3. Ended check: if watch party was ended by host, show ended overlay
  if (endedByHost) {
    return (
      <div style={styles.kickedOverlay}>
        <div className="glass-panel" style={styles.kickedCard}>
          <h2 style={{ color: '#8B5CF6', fontSize: '24px', marginBottom: '12px' }}>Party Ended</h2>
          <p style={{ color: '#9CA3AF', marginBottom: '24px' }}>
            This watch party has been ended by the Host.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            onClick={() => removeToast(toast.id)}
            style={{ cursor: 'pointer' }}
          >
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Main Watch Room Header */}
      <header style={styles.navHeader} className="glass-panel">
        <div style={styles.navLeft}>
          <h2 style={styles.roomTitle}>{roomName}</h2>
          <span style={styles.roleBadge}>{role}</span>
        </div>
        
        <div style={styles.navRight}>
          <div style={styles.codeContainer} onClick={handleCopyLink}>
            <span style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Room Code</span>
            <span style={styles.codeText}>{roomCode}</span>
            {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#9CA3AF" />}
          </div>

          {role === 'HOST' && (
            <button
              className="btn btn-primary"
              style={{ ...styles.leaveBtn, background: '#EF4444', borderColor: '#EF4444' }}
              onClick={handleEndRoom}
            >
              <span>End Party for All</span>
            </button>
          )}

          <button className="btn btn-secondary" style={styles.leaveBtn} onClick={handleLeave}>
            <LogOut size={16} />
            <span>Leave Room</span>
          </button>
        </div>
      </header>

      {/* Core Watch Room Grid Layout */}
      <main style={styles.mainGrid}>
        {/* Left Section: Video Player & Sync Bars */}
        <section style={styles.playerSection}>
          <div className="glass-panel" style={styles.playerContainer}>
            <YoutubePlayer />
          </div>
          <div className="glass-panel" style={styles.controlsContainer}>
            <PlaybackControls />
          </div>
        </section>

        {/* Right Section: Sidebar (Chat, Users, Queue tabbed pane) */}
        <section className="glass-panel" style={styles.sidebarSection}>
          <div style={styles.tabsHeader}>
            <button
              style={{
                ...styles.tabButton,
                borderBottom: activeTab === 'chat' ? '2px solid #8B5CF6' : 'none',
                color: activeTab === 'chat' ? '#FFF' : '#9CA3AF'
              }}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={16} />
              <span>Room Chat</span>
            </button>
            <button
              style={{
                ...styles.tabButton,
                borderBottom: activeTab === 'users' ? '2px solid #8B5CF6' : 'none',
                color: activeTab === 'users' ? '#FFF' : '#9CA3AF'
              }}
              onClick={() => setActiveTab('users')}
            >
              <Users size={16} />
              <span>Participants</span>
            </button>
            <button
              style={{
                ...styles.tabButton,
                borderBottom: activeTab === 'queue' ? '2px solid #8B5CF6' : 'none',
                color: activeTab === 'queue' ? '#FFF' : '#9CA3AF'
              }}
              onClick={() => setActiveTab('queue')}
            >
              <ListVideo size={16} />
              <span>Queue ({queue.length})</span>
            </button>
          </div>

          <div style={styles.tabContent}>
            {activeTab === 'chat' && (
              <div style={styles.chatWrapper}>
                <ChatPanel />
                <ReactionBar />
              </div>
            )}
            {activeTab === 'users' && (
              <ParticipantList />
            )}
            {activeTab === 'queue' && (
              <div style={styles.queueWrapper}>
                <div style={styles.queueHeader}>
                  <h3>Up Next ({queue.length})</h3>
                </div>
                <div style={styles.queueList}>
                  {queue.length === 0 ? (
                    <div style={styles.emptyQueue}>
                      <p>No videos cued next.</p>
                      <p style={{ fontSize: '11px', marginTop: '6px', color: '#9CA3AF' }}>
                        Paste a video URL and click "Add to Queue" in the player bar.
                      </p>
                    </div>
                  ) : (
                    queue.map((item, idx) => (
                      <div key={item.id} style={styles.queueItemRow}>
                        <span style={styles.queueIndex}>#{idx + 1}</span>
                        <div style={styles.queueItemDetails}>
                          <span style={styles.queueTitle} title={item.title}>{item.title}</span>
                          <span style={styles.queueAddedBy}>Added by {item.addedBy}</span>
                        </div>
                        {(role === 'HOST' || role === 'MODERATOR') && (
                          <button
                            style={styles.queueRemoveBtn}
                            onClick={() => emitRemoveFromQueue(item.id)}
                            title="Remove from queue"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  pageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%',
    padding: '20px',
    gap: '20px'
  },
  kickedOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#0B0A19',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px'
  },
  kickedCard: {
    maxWidth: '400px',
    width: '100%',
    padding: '30px',
    textAlign: 'center'
  },
  navHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderRadius: '14px'
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  roomTitle: {
    fontSize: '20px',
    fontWeight: 800
  },
  roleBadge: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    background: 'rgba(139, 92, 246, 0.15)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    color: '#A78BFA',
    padding: '3px 8px',
    borderRadius: '12px',
    textTransform: 'uppercase'
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  codeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '8px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  codeText: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '15px',
    color: '#FFF',
    letterSpacing: '0.5px'
  },
  leaveBtn: {
    padding: '8px 16px',
    fontSize: '13px'
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: '20px',
    flexGrow: 1,
    height: 'calc(100vh - 120px)',
    minHeight: '500px'
  },
  playerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%'
  },
  playerContainer: {
    flexGrow: 1,
    borderRadius: '14px',
    overflow: 'hidden',
    position: 'relative',
    background: '#000'
  },
  controlsContainer: {
    padding: '16px 20px',
    borderRadius: '14px'
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '14px',
    overflow: 'hidden',
    height: '100%'
  },
  tabsHeader: {
    display: 'flex',
    background: 'rgba(0, 0, 0, 0.15)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  tabButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.3s ease'
  },
  tabContent: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  chatWrapper: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
    height: '100%'
  },
  queueWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '20px',
    overflow: 'hidden'
  },
  queueHeader: {
    marginBottom: '16px'
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    flexGrow: 1
  },
  emptyQueue: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: '13px',
    padding: '20px'
  },
  queueItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '10px 14px',
    borderRadius: '12px',
    position: 'relative'
  },
  queueIndex: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#8B5CF6',
    fontFamily: 'monospace'
  },
  queueItemDetails: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden'
  },
  queueTitle: {
    fontSize: '13px',
    color: '#FFF',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden'
  },
  queueAddedBy: {
    fontSize: '10px',
    color: '#9CA3AF',
    marginTop: '2px'
  },
  queueRemoveBtn: {
    background: 'none',
    border: 'none',
    color: '#EF4444',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    transition: 'color 0.2s'
  }
};

export default RoomPage;
