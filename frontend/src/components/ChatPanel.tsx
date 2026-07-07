import React, { useState, useEffect, useRef } from 'react';
import { useRoom } from '../context/RoomContext';
import { Send } from 'lucide-react';

const ChatPanel: React.FC = () => {
  const { messages, userId: currentUserId, emitSendMessage } = useRoom();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    emitSendMessage(inputText.trim());
    setInputText('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatSentTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div style={styles.chatContainer}>
      <div style={styles.messagesList}>
        {messages.length === 0 ? (
          <div style={styles.emptyChat}>
            <p>Welcome to the room chat!</p>
            <p style={{ fontSize: '11px', marginTop: '4px', color: '#9CA3AF' }}>
              Messages will sync and appear here in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  justifyContent: isSelf ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    ...styles.bubble,
                    background: isSelf ? '#8B5CF6' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelf ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: isSelf ? '14px 14px 2px 14px' : '14px 14px 14px 2px'
                  }}
                >
                  {!isSelf && <span style={styles.senderName}>{msg.senderUsername}</span>}
                  <p style={styles.messageText}>{msg.message}</p>
                  <span style={{ ...styles.timeText, textAlign: isSelf ? 'right' : 'left' }}>
                    {formatSentTime(msg.sentAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} style={styles.inputForm}>
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={styles.chatInput}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={styles.sendBtn}
          disabled={!inputText.trim()}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: 'calc(100% - 64px)', // Adjust height relative to reaction bar
    overflow: 'hidden'
  },
  messagesList: {
    flexGrow: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  emptyChat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    height: '100%',
    color: '#9CA3AF',
    fontSize: '13px'
  },
  messageRow: {
    display: 'flex',
    width: '100%'
  },
  bubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
  },
  senderName: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#A78BFA',
    textTransform: 'capitalize'
  },
  messageText: {
    fontSize: '13.5px',
    color: '#FFFFFF',
    wordBreak: 'break-word',
    lineHeight: '1.4'
  },
  timeText: {
    fontSize: '9px',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: '2px'
  },
  inputForm: {
    display: 'flex',
    gap: '8px',
    padding: '16px 20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'rgba(0, 0, 0, 0.1)'
  },
  chatInput: {
    flexGrow: 1,
    height: '40px',
    padding: '0 14px',
    fontSize: '13.5px'
  },
  sendBtn: {
    width: '40px',
    height: '40px',
    padding: 0,
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }
};

export default ChatPanel;
