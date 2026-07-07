import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { Shield, User, MoreVertical, Star, UserMinus, ShieldCheck } from 'lucide-react';

const ParticipantList: React.FC = () => {
  const {
    userId: currentUserId,
    role: currentUserRole,
    participants,
    emitAssignRole,
    emitRemoveParticipant,
    emitTransferHost
  } = useRoom();

  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  const isHost = currentUserRole === 'HOST';

  const toggleMenu = (uid: string) => {
    setActiveMenuUserId(activeMenuUserId === uid ? null : uid);
  };

  const handleRoleChange = (targetUserId: string, newRole: string) => {
    emitAssignRole(targetUserId, newRole);
    setActiveMenuUserId(null);
  };

  const handleRemove = (targetUserId: string) => {
    if (confirm('Are you sure you want to remove this participant?')) {
      emitRemoveParticipant(targetUserId);
    }
    setActiveMenuUserId(null);
  };

  const handleTransfer = (targetUserId: string) => {
    if (confirm('Are you sure you want to transfer host ownership? You will become a Moderator.')) {
      emitTransferHost(targetUserId);
    }
    setActiveMenuUserId(null);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'HOST':
        return <Star size={14} color="#FBBF24" fill="#FBBF24" />;
      case 'MODERATOR':
        return <ShieldCheck size={14} color="#8B5CF6" fill="#8B5CF6" />;
      case 'PARTICIPANT':
        return <Shield size={14} color="#3B82F6" />;
      default:
        return <User size={14} color="#9CA3AF" />;
    }
  };

  return (
    <div style={styles.listContainer}>
      <div style={styles.header}>
        <h3>Participants ({participants.length})</h3>
      </div>

      <div style={styles.list}>
        {participants.map((p) => {
          const isSelf = p.userId === currentUserId;
          const isMenuOpen = activeMenuUserId === p.userId;
          const showActions = isHost && !isSelf;

          return (
            <div key={p.userId} style={styles.row}>
              <div style={styles.left}>
                {/* Online indicator */}
                <span
                  style={{
                    ...styles.statusIndicator,
                    background: p.isOnline !== false ? '#10B981' : '#6B7280',
                    boxShadow: p.isOnline !== false ? '0 0 8px #10B981' : 'none'
                  }}
                />
                
                <div style={styles.nameSection}>
                  <span style={styles.username}>
                    {p.username} {isSelf && <span style={styles.selfTag}>(You)</span>}
                  </span>
                  <div style={styles.roleContainer}>
                    {getRoleIcon(p.role)}
                    <span style={styles.roleText}>{p.role}</span>
                  </div>
                </div>
              </div>

              {/* Host actions button */}
              {showActions && (
                <div style={{ position: 'relative' }}>
                  <button style={styles.menuBtn} onClick={() => toggleMenu(p.userId)}>
                    <MoreVertical size={16} color="#9CA3AF" />
                  </button>

                  {/* Actions Dropdown Card */}
                  {isMenuOpen && (
                    <>
                      <div style={styles.menuOverlay} onClick={() => setActiveMenuUserId(null)} />
                      <div style={styles.dropdown} className="glass-panel actions-dropdown">
                        <button
                          style={styles.dropdownItem}
                          onClick={() => handleTransfer(p.userId)}
                        >
                          <Star size={14} color="#FBBF24" />
                          <span>Make Host (Transfer)</span>
                        </button>
                        
                        {p.role !== 'MODERATOR' && (
                          <button
                            style={styles.dropdownItem}
                            onClick={() => handleRoleChange(p.userId, 'MODERATOR')}
                          >
                            <ShieldCheck size={14} color="#8B5CF6" />
                            <span>Make Moderator</span>
                          </button>
                        )}
                        
                        {p.role !== 'PARTICIPANT' && (
                          <button
                            style={styles.dropdownItem}
                            onClick={() => handleRoleChange(p.userId, 'PARTICIPANT')}
                          >
                            <Shield size={14} color="#3B82F6" />
                            <span>Make Participant</span>
                          </button>
                        )}
                        
                        {p.role !== 'VIEWER' && (
                          <button
                            style={styles.dropdownItem}
                            onClick={() => handleRoleChange(p.userId, 'VIEWER')}
                          >
                            <User size={14} color="#9CA3AF" />
                            <span>Make Viewer</span>
                          </button>
                        )}

                        <div style={styles.divider} />
                        
                        <button
                          style={{ ...styles.dropdownItem, color: '#EF4444' }}
                          onClick={() => handleRemove(p.userId)}
                        >
                          <UserMinus size={14} color="#EF4444" />
                          <span>Kick / Remove</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '20px'
  },
  header: {
    marginBottom: '16px'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    flexGrow: 1
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '10px 14px',
    borderRadius: '12px',
    position: 'relative'
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  nameSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  username: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#FFF'
  },
  selfTag: {
    fontSize: '11px',
    color: '#9CA3AF',
    fontStyle: 'italic'
  },
  roleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  roleText: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.3s'
  },
  menuOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    width: '200px',
    background: '#1A1835',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '6px',
    zIndex: 95,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    color: '#FFF',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s'
  },
  divider: {
    height: '1px',
    background: 'rgba(255, 255, 255, 0.05)',
    margin: '6px 0'
  }
};

export default ParticipantList;
