const Room = require('./Room');
const roomRepository = require('../repositories/RoomRepository');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  createRoom(roomId, roomCode, roomName, hostId, settings, state) {
    const room = new Room({ roomId, roomCode, roomName, hostId, settings, state });
    this.rooms.set(roomId, room);
    return room;
  }

  removeRoom(roomId) {
    this.rooms.delete(roomId);
  }

  async loadRoomFromDB(roomId) {
    try {
      const roomData = await roomRepository.getRoomById(roomId);
      if (!roomData) return null;

      const state = await roomRepository.getRoomState(roomId);
      const settings = await roomRepository.getRoomSettings(roomId);
      const participantsData = await roomRepository.getRoomParticipants(roomId);

      const room = new Room({
        roomId: roomData.id,
        roomCode: roomData.room_code,
        roomName: roomData.room_name,
        hostId: roomData.host_id,
        settings,
        state
      });

      // Load active participants
      if (participantsData && participantsData.length > 0) {
        participantsData.forEach(p => {
          room.addParticipant({
            userId: p.user_id,
            username: p.username,
            role: p.role,
            socketId: null // will be updated when they emit join_room
          });
        });
      }

      this.rooms.set(roomId, room);
      return room;
    } catch (error) {
      console.error(`Error loading room ${roomId} from DB:`, error);
      return null;
    }
  }

  async getOrCreateRoom(roomId) {
    let room = this.getRoom(roomId);
    if (!room) {
      room = await this.loadRoomFromDB(roomId);
    }
    return room;
  }
}

module.exports = new RoomManager();
