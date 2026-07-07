import React, { useState, useEffect } from 'react';
import { getRoomDetails, joinRoom } from '../services/api';
import { useRoom } from '../context/RoomContext';
import { Film, AlertCircle, Loader } from 'lucide-react';

interface JoinGateProps {
  roomCode: string;
  onJoinSuccess: (roomName: string) => void;
}

const JoinGate: React.FC<JoinGateProps> = ({ roomCode, onJoinSuccess }) => {
  const { joinSession, addToast } = useRoom();
  const [usernameInput, setUsernameInput] = useState('');
  const [roomName, setRoomName] = useState<string | null>(null);
  
  // States for verification
  const [verifying, setVerifying] = useState(true);
  const [roomExists, setRoomExists] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verifyRoom = async () => {
      setVerifying(true);
      setErrorMessage(null);
      try {
        const details = await getRoomDetails(roomCode);
        setRoomName(details.roomName);
        setRoomExists(true);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(err.message || 'Room not found or has been deactivated.');
        setRoomExists(false);
      } finally {
        setVerifying(false);
      }
    };

    verifyRoom();
  }, [roomCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      addToast('Please enter a username to join', 'error');
      return;
    }

    setJoining(true);
    setErrorMessage(null);
    try {
      const res = await joinRoom(roomCode, usernameInput.trim());
      joinSession(roomCode, res.roomId, res.userId, res.username, res.role, roomName || 'YouTube Party');
      addToast(`Welcome to the party, ${res.username}!`, 'success');
      onJoinSuccess(roomName || 'YouTube Party');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to join the room');
      addToast(err.message || 'Failed to join the room', 'error');
    } finally {
      setJoining(false);
    }
  };

  if (verifying) {
    return (
      <div style={styles.gateOverlay}>
        <div style={styles.loaderBox}>
          <Loader className="animate-spin" size={32} color="#8B5CF6" />
          <p style={{ marginTop: '12px' }}>Verifying room code...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.gateOverlay}>
      <div className="glass-panel" style={styles.gateCard}>
        {roomExists ? (
          <>
            <div style={styles.iconHeader}>
              <Film size={36} color="#8B5CF6" style={styles.pulseIcon} />
            </div>
            <h2 style={styles.title}>You've been invited!</h2>
            <p style={styles.roomText}>
              To join the watch party <strong style={{ color: '#A78BFA' }}>"{roomName}"</strong>, please enter a display name below.
            </p>

            <form onSubmit={handleJoin} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Display Username</label>
                <input
                  type="text"
                  placeholder="e.g. GuestGuest"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                  maxLength={20}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={joining}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {joining ? 'Entering Party...' : 'Join Watch Party'}
              </button>
            </form>
          </>
        ) : (
          <div style={styles.errorBox}>
            <AlertCircle size={40} color="#EF4444" />
            <h2 style={styles.errorTitle}>Invalid Room Code</h2>
            <p style={styles.errorDescription}>{errorMessage || 'This room does not exist or has ended.'}</p>
            <a href="/" className="btn btn-secondary" style={{ marginTop: '16px', textDecoration: 'none' }}>
              Return Home
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  gateOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 50% 50%, #151336 0%, #0B0A19 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  loaderBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: '#9CA3AF'
  },
  gateCard: {
    maxWidth: '460px',
    width: '100%',
    padding: '40px 30px',
    textAlign: 'center'
  },
  iconHeader: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px'
  },
  pulseIcon: {
    filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.4))'
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    marginBottom: '10px'
  },
  roomText: {
    fontSize: '14px',
    color: '#9CA3AF',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'left'
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  },
  errorTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#EF4444'
  },
  errorDescription: {
    fontSize: '13px',
    color: '#9CA3AF',
    lineHeight: '1.5'
  }
};

export default JoinGate;
