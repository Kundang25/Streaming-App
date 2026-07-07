const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
const API_BASE_URL = backendUrl.endsWith('/api') ? backendUrl : `${backendUrl}/api`;

export interface CreateRoomResponse {
  roomCode: string;
  roomId: string;
  userId: string;
  username: string;
  role: 'HOST';
}

export interface RoomSettings {
  room_id: string;
  allow_chat: boolean;
  allow_seek: boolean;
  allow_video_change: boolean;
  allow_reactions: boolean;
  allow_guests: boolean;
  auto_sync: boolean;
  max_participants: number;
  room_visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
}

export interface RoomDetailsResponse {
  roomId: string;
  roomName: string;
  isActive: boolean;
  participantCount: number;
  roomSettings: RoomSettings;
}

export interface JoinRoomResponse {
  roomId: string;
  userId: string;
  username: string;
  role: 'HOST' | 'MODERATOR' | 'PARTICIPANT' | 'VIEWER';
}

export async function createRoom(username: string, roomName: string): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, roomName })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Failed to create room');
  }
  return body;
}

export async function getRoomDetails(roomCode: string): Promise<RoomDetailsResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomCode.toUpperCase()}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Room not found');
  }
  return body;
}

export async function joinRoom(roomCode: string, username: string, userId?: string): Promise<JoinRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomCode.toUpperCase()}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, userId })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Failed to join room');
  }
  return body;
}
