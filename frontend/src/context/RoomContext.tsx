import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export interface Participant {
  userId: string;
  username: string;
  role: 'HOST' | 'MODERATOR' | 'PARTICIPANT' | 'VIEWER';
  socketId?: string | null;
  isOnline?: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  videoId: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  message: string;
  sentAt: string;
}

export interface EmojiReaction {
  id: string;
  userId: string;
  username: string;
  emoji: string;
  timestamp: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  addedBy: string;
}

interface RoomContextProps {
  socket: Socket | null;
  userId: string | null;
  username: string | null;
  role: 'HOST' | 'MODERATOR' | 'PARTICIPANT' | 'VIEWER' | null;
  roomId: string | null;
  roomCode: string | null;
  roomName: string | null;
  participants: Participant[];
  playbackState: PlaybackState;
  messages: ChatMessage[];
  reactions: EmojiReaction[];
  toasts: ToastMessage[];
  removedByHost: boolean;
  queue: QueueItem[];
  endedByHost: boolean;
  joinSession: (roomCode: string, roomId: string, userId: string, username: string, role: any, roomName: string) => void;
  leaveSession: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  emitPlay: () => void;
  emitPause: () => void;
  emitSeek: (time: number) => void;
  emitChangeVideo: (videoId: string) => void;
  emitAssignRole: (userId: string, role: string) => void;
  emitRemoveParticipant: (userId: string) => void;
  emitTransferHost: (userId: string) => void;
  emitSendMessage: (message: string) => void;
  emitSendReaction: (emoji: string) => void;
  emitEndRoom: () => void;
  emitAddToQueue: (videoId: string, title?: string) => void;
  emitRemoveFromQueue: (id: string) => void;
  emitSkipVideo: () => void;
  playerRef: React.MutableRefObject<any>;
}

const RoomContext = createContext<RoomContextProps | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Session variables
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<'HOST' | 'MODERATOR' | 'PARTICIPANT' | 'VIEWER' | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  
  // Room lists and active syncs
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    videoId: null
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [removedByHost, setRemovedByHost] = useState<boolean>(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [endedByHost, setEndedByHost] = useState<boolean>(false);
  
  // Ref pointing to player instance
  const playerRef = useRef<any>(null);

  // Toast Helpers
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Called after REST API succeeds
  const joinSession = (
    code: string,
    id: string,
    uid: string,
    uname: string,
    urole: 'HOST' | 'MODERATOR' | 'PARTICIPANT' | 'VIEWER',
    rname: string
  ) => {
    setRoomCode(code);
    setRoomId(id);
    setUserId(uid);
    setUsername(uname);
    setRole(urole);
    setRoomName(rname);
    setRemovedByHost(false);
    setEndedByHost(false);
  };

  const leaveSession = () => {
    if (socket && roomId) {
      socket.emit('leave_room');
      socket.disconnect();
    }
    setSocket(null);
    setUserId(null);
    setUsername(null);
    setRole(null);
    setRoomId(null);
    setRoomCode(null);
    setRoomName(null);
    setParticipants([]);
    setMessages([]);
    setReactions([]);
    setQueue([]);
    setEndedByHost(false);
  };

  // Connect and bind WebSocket events
  useEffect(() => {
    if (!roomId || !userId || !username) return;

    console.log(`[Socket] Connecting to ${socketUrl}...`);
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      forceNew: true
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected, emitting join_room...');
      newSocket.emit('join_room', { roomId, username, userId });
    });

    newSocket.on('user_joined', (data: { username: string; userId: string; role: any; participants: Participant[] }) => {
      console.log('[Socket] User joined:', data);
      setParticipants(data.participants);
      if (data.userId !== userId) {
        addToast(`${data.username} joined the watch party`, 'success');
      }
    });

    newSocket.on('user_left', (data: { username: string; userId: string; participants: Participant[] }) => {
      console.log('[Socket] User left:', data);
      setParticipants(data.participants);
      addToast(`${data.username} left the watch party`, 'info');
    });

    newSocket.on('sync_state', (state: { playState: boolean; currentTime: number; videoId: string | null; queue?: QueueItem[] }) => {
      console.log('[Socket] Received sync_state:', state);
      setPlaybackState({
        isPlaying: state.playState,
        currentTime: state.currentTime,
        videoId: state.videoId
      });
      if (state.queue) {
        setQueue(state.queue);
      }

      const player = playerRef.current;
      if (player && typeof player.getPlayerState === 'function') {
        (window as any).isSyncing = true;

        // 1. Sync Video ID
        const currentVideoUrl = player.getVideoUrl();
        const currentVideoId = currentVideoUrl ? currentVideoUrl.match(/[?&]v=([^&#]*)/)?.[1] : null;

        if (state.videoId && state.videoId !== currentVideoId) {
          player.loadVideoById({
            videoId: state.videoId,
            startSeconds: state.currentTime
          });
        } else {
          // 2. Sync Time (allow slight delta)
          const localTime = player.getCurrentTime();
          if (Math.abs(localTime - state.currentTime) > 2) {
            player.seekTo(state.currentTime, true);
          }
        }

        // 3. Sync Play/Pause status
        const playerState = player.getPlayerState();
        if (state.playState) {
          if (playerState !== 1) {
            player.playVideo();
          }
        } else {
          if (playerState !== 2) {
            player.pauseVideo();
          }
        }

        setTimeout(() => {
          (window as any).isSyncing = false;
        }, 1000);
      }
    });

    newSocket.on('role_assigned', (data: { userId: string; username: string; role: any; participants: Participant[] }) => {
      console.log('[Socket] Role assigned:', data);
      setParticipants(data.participants);
      if (data.userId === userId) {
        setRole(data.role);
        addToast(`Your role has been updated to ${data.role}`, 'success');
      } else {
        addToast(`${data.username} is now a ${data.role}`, 'info');
      }
    });

    newSocket.on('participant_removed', (data: { userId: string; participants: Participant[] }) => {
      console.log('[Socket] Participant removed:', data);
      setParticipants(data.participants);
      if (data.userId === userId) {
        setRemovedByHost(true);
        addToast('You were removed from this room by the host', 'error');
        newSocket.disconnect();
      } else {
        addToast('A participant was removed by the host', 'info');
      }
    });

    newSocket.on('chat_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('emoji_reaction', (rxn: { userId: string; username: string; emoji: string; timestamp: string }) => {
      const rxnId = Math.random().toString(36).substring(2, 9);
      const reactionWithId: EmojiReaction = {
        id: rxnId,
        userId: rxn.userId,
        username: rxn.username,
        emoji: rxn.emoji,
        timestamp: rxn.timestamp
      };
      setReactions(prev => [...prev, reactionWithId]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== rxnId));
      }, 3000);
    });

    newSocket.on('action_error', (data: { message: string }) => {
      addToast(data.message, 'error');
    });

    newSocket.on('queue_updated', (updatedQueue: QueueItem[]) => {
      console.log('[Socket] Queue updated:', updatedQueue);
      setQueue(updatedQueue);
    });

    newSocket.on('room_ended', (data: { message: string }) => {
      console.log('[Socket] Room ended by Host');
      setEndedByHost(true);
      addToast(data.message, 'error');
      newSocket.disconnect();
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    setSocket(newSocket);

    return () => {
      console.log('[Socket] Cleaning up socket connection...');
      newSocket.emit('leave_room');
      newSocket.disconnect();
    };
  }, [roomId, userId]);

  // Emitters
  const emitPlay = () => socket?.emit('play');
  const emitPause = () => socket?.emit('pause');
  const emitSeek = (time: number) => socket?.emit('seek', { time });
  const emitChangeVideo = (videoId: string) => socket?.emit('change_video', { videoId });
  const emitAssignRole = (tId: string, nRole: string) => socket?.emit('assign_role', { userId: tId, role: nRole });
  const emitRemoveParticipant = (tId: string) => socket?.emit('remove_participant', { userId: tId });
  const emitTransferHost = (tId: string) => socket?.emit('transfer_host', { userId: tId });
  const emitSendMessage = (message: string) => socket?.emit('send_message', { message });
  const emitSendReaction = (emoji: string) => socket?.emit('send_reaction', { emoji });
  const emitEndRoom = () => socket?.emit('end_room');
  const emitAddToQueue = (videoId: string, title?: string) => socket?.emit('add_to_queue', { videoId, title });
  const emitRemoveFromQueue = (id: string) => socket?.emit('remove_from_queue', { id });
  const emitSkipVideo = () => socket?.emit('skip_video');

  return (
    <RoomContext.Provider value={{
      socket,
      userId,
      username,
      role,
      roomId,
      roomCode,
      roomName,
      participants,
      playbackState,
      messages,
      reactions,
      toasts,
      removedByHost,
      queue,
      endedByHost,
      joinSession,
      leaveSession,
      addToast,
      removeToast,
      emitPlay,
      emitPause,
      emitSeek,
      emitChangeVideo,
      emitAssignRole,
      emitRemoveParticipant,
      emitTransferHost,
      emitSendMessage,
      emitSendReaction,
      emitEndRoom,
      emitAddToQueue,
      emitRemoveFromQueue,
      emitSkipVideo,
      playerRef
    }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
