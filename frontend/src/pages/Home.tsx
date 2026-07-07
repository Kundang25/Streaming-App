import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, getRoomDetails, joinRoom } from '../services/api';
import { useRoom } from '../context/RoomContext';
import { Film, UserPlus, HelpCircle } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { joinSession, addToast } = useRoom();

  // Create Form State
  const [createUsername, setCreateUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Join Form State
  const [joinUsername, setJoinUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername.trim() || !roomName.trim()) {
      addToast('Please enter both username and room name', 'error');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await createRoom(createUsername.trim(), roomName.trim());
      joinSession(res.roomCode, res.roomId, res.userId, res.username, 'HOST', roomName.trim());
      addToast('Room created successfully! Redirecting...', 'success');
      navigate(`/room/${res.roomCode}`);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to create room', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!joinUsername.trim() || !cleanCode) {
      addToast('Please enter both username and room code', 'error');
      return;
    }
    if (cleanCode.length !== 6) {
      addToast('Room code must be exactly 6 characters', 'error');
      return;
    }

    setJoinLoading(true);
    try {
      // 1. Validate room exists & get room details
      const details = await getRoomDetails(cleanCode);
      
      // 2. Perform join API call
      const res = await joinRoom(cleanCode, joinUsername.trim());
      
      // 3. Populate state & navigate
      joinSession(cleanCode, res.roomId, res.userId, res.username, res.role, details.roomName);
      addToast(`Joined room: ${details.roomName}`, 'success');
      navigate(`/room/${cleanCode}`);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to join room', 'error');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <Film size={40} color="#8B5CF6" style={styles.logoIcon} />
          <h1 style={styles.logoText}>Watch<span style={{ color: '#8B5CF6' }}>Party</span></h1>
        </div>
        <p style={styles.tagline}>Sync YouTube videos, chat, and react in real time with friends.</p>
      </header>

      <main style={styles.formsGrid}>
        {/* Form Box: Create Room */}
        <section className="glass-panel" style={styles.card}>
          <div style={styles.cardHeader}>
            <Film size={24} color="#8B5CF6" />
            <h2 style={styles.cardTitle}>Create a Room</h2>
          </div>
          <p style={styles.cardDescription}>Start a new party and invite others with a room code.</p>

          <form onSubmit={handleCreateRoom} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Your Username</label>
              <input
                type="text"
                placeholder="e.g. Alice"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                required
                maxLength={20}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Room Name</label>
              <input
                type="text"
                placeholder="e.g. Marvel Movie Night"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                maxLength={50}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={createLoading}
              style={{ width: '100%', marginTop: '10px' }}
            >
              {createLoading ? 'Creating...' : 'Create Watch Party'}
            </button>
          </form>
        </section>

        {/* Form Box: Join Room */}
        <section className="glass-panel" style={styles.card}>
          <div style={styles.cardHeader}>
            <UserPlus size={24} color="#10B981" />
            <h2 style={styles.cardTitle}>Join a Room</h2>
          </div>
          <p style={styles.cardDescription}>Enter a room code to join an existing watch party.</p>

          <form onSubmit={handleJoinRoom} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Your Username</label>
              <input
                type="text"
                placeholder="e.g. Bob"
                value={joinUsername}
                onChange={(e) => setJoinUsername(e.target.value)}
                required
                maxLength={20}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Room Code</label>
              <input
                type="text"
                placeholder="e.g. AB12CD"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                required
                maxLength={6}
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={joinLoading}
              style={{ width: '100%', marginTop: '10px', background: '#10B981', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)' }}
            >
              {joinLoading ? 'Joining...' : 'Join Watch Party'}
            </button>
          </form>
        </section>
      </main>

      <footer style={styles.footer}>
        <HelpCircle size={16} style={{ marginRight: '4px' }} />
        <span>No registration needed. Joining a room creates a secure guest session.</span>
      </footer>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '40px 20px',
    background: 'radial-gradient(circle at 50% 50%, #151336 0%, #0B0A19 100%)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
    maxWidth: '600px'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  logoIcon: {
    filter: 'drop-shadow(0 0 10px rgba(139, 92, 246, 0.6))'
  },
  logoText: {
    fontSize: '44px',
    fontWeight: 900,
    letterSpacing: '-1.5px',
    textShadow: '0 0 20px rgba(139, 92, 246, 0.2)'
  },
  tagline: {
    fontSize: '16px',
    color: '#9CA3AF'
  },
  formsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '30px',
    width: '100%',
    maxWidth: '860px',
    marginBottom: '40px'
  },
  card: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 700
  },
  cardDescription: {
    fontSize: '13px',
    color: '#9CA3AF',
    marginBottom: '24px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#9CA3AF',
    background: 'rgba(255, 255, 255, 0.03)',
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.05)'
  }
};

export default Home;
