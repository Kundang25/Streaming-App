const Participant = require('./Participant');

class Room {
  constructor({ roomId, roomCode, roomName, hostId, settings = {}, state = {} }) {
    this.roomId = roomId;
    this.roomCode = roomCode;
    this.roomName = roomName;
    this.hostId = hostId;
    this.participants = new Map(); // userId -> Participant
    this.settings = settings;
    this.state = state;
    this.queue = []; // in-memory video queue
  }

  addToQueue(video) {
    this.queue.push(video);
  }

  removeFromQueue(id) {
    this.queue = this.queue.filter(v => v.id !== id);
  }

  getNextVideo() {
    return this.queue.shift() || null;
  }


  addParticipant(participant) {
    if (!(participant instanceof Participant)) {
      participant = new Participant(participant);
    }
    this.participants.set(participant.userId, participant);
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
  }

  getParticipant(userId) {
    return this.participants.get(userId);
  }

  getParticipantList() {
    return Array.from(this.participants.values()).map(p => p.toJSON());
  }

  updateSettings(settingsPatch) {
    this.settings = { ...this.settings, ...settingsPatch };
  }

  updatePlaybackState(statePatch) {
    this.state = { ...this.state, ...statePatch };
  }

  broadcast(io, event, payload, excludeSocketId = null) {
    if (excludeSocketId) {
      const socket = io.sockets.sockets.get(excludeSocketId);
      if (socket) {
        socket.to(this.roomId).emit(event, payload);
        return;
      }
    }
    io.to(this.roomId).emit(event, payload);
  }
}

module.exports = Room;
