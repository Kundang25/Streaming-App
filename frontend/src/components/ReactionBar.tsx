import React from 'react';
import { useRoom } from '../context/RoomContext';

const EMOJIS = ['🎉', '😂', '❤️', '👍', '😮', '😢', '👏', '🔥'];

const ReactionBar: React.FC = () => {
  const { emitSendReaction } = useRoom();

  return (
    <div style={styles.bar}>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          style={styles.emojiBtn}
          onClick={() => emitSendReaction(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    gap: '8px'
  },
  emojiBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

export default ReactionBar;
