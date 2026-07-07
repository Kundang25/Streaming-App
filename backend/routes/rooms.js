const express = require('express');
const router = express.Router();
const userRepository = require('../repositories/UserRepository');
const roomRepository = require('../repositories/RoomRepository');
const activityRepository = require('../repositories/ActivityRepository');
const roomManager = require('../domain/RoomManager');
const crypto = require('crypto');

// Helper to generate unique room code
function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
}

// POST /api/rooms - Create a room
router.post('/rooms', async (req, res, next) => {
  try {
    const { username, roomName } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!roomName || !roomName.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    // 1. Create the host user
    const user = await userRepository.createUser(username.trim());

    // 2. Generate a unique room code
    let roomCode = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      roomCode = generateRoomCode(parseInt(process.env.ROOM_CODE_LENGTH) || 6);
      const existing = await roomRepository.getRoomByCode(roomCode);
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate a unique room code. Please try again.' });
    }

    // 3. Create the room and host participation
    const room = await roomRepository.createRoom(roomCode, roomName.trim(), user.id);

    // 4. Log the activity
    await activityRepository.logActivity(room.id, user.id, 'CREATE_ROOM', {
      username: user.username,
      roomName: room.room_name
    });

    // 5. Pre-warm RoomManager cache
    await roomManager.getOrCreateRoom(room.id);

    return res.status(201).json({
      roomCode: room.room_code,
      roomId: room.id,
      userId: user.id,
      username: user.username,
      role: 'HOST'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/:roomCode - Look up room by code
router.get('/rooms/:roomCode', async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const room = await roomRepository.getRoomByCode(roomCode.toUpperCase());

    if (!room) {
      return res.status(404).json({ error: 'Room not found or is inactive' });
    }

    const participantCount = await roomRepository.getParticipantCount(room.id);

    return res.status(200).json({
      roomId: room.id,
      roomName: room.room_name,
      isActive: room.is_active,
      participantCount,
      roomSettings: room.room_settings
    });
  } catch (error) {
    console.error('Error looking up room:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rooms/:roomCode/join - Join a room
router.post('/rooms/:roomCode/join', async (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const { username, userId } = req.body; // userId optional if they have an existing session

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const room = await roomRepository.getRoomByCode(roomCode.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'Room not found or is inactive' });
    }

    const settings = room.room_settings;

    // 1. Check if user is banned
    if (userId) {
      const isBanned = await roomRepository.isUserBanned(room.id, userId);
      if (isBanned) {
        return res.status(403).json({ error: 'You are banned from this room' });
      }
    }

    // 2. Check participant count
    const participantCount = await roomRepository.getParticipantCount(room.id);
    const maxParticipants = settings?.max_participants || 50;
    if (participantCount >= maxParticipants) {
      return res.status(400).json({ error: 'Room is full' });
    }

    // 3. Resolve user (use existing or create new)
    let user;
    if (userId) {
      user = await userRepository.getUserById(userId);
    }

    if (!user) {
      user = await userRepository.createUser(username.trim());
    } else {
      // If user exists, update their username if it has changed
      if (user.username !== username.trim()) {
        user = await userRepository.createUser(username.trim()); // treat as new guest to avoid altering historical usernames of other rooms
      }
    }

    // 4. Determine role (default to PARTICIPANT, or VIEWER if settings.allow_guests is false)
    const allowGuests = settings ? settings.allow_guests : true;
    const role = allowGuests ? 'PARTICIPANT' : 'VIEWER';

    // 5. Add/update room participant
    await roomRepository.addParticipant(room.id, user.id, role, true);

    // 6. Log the activity
    await activityRepository.logActivity(room.id, user.id, 'JOIN_ROOM', {
      username: user.username,
      role
    });

    // 7. Update in-memory room
    const inMemRoom = await roomManager.getOrCreateRoom(room.id);
    if (inMemRoom) {
      inMemRoom.addParticipant({
        userId: user.id,
        username: user.username,
        role: role,
        socketId: null
      });
    }

    return res.status(200).json({
      roomId: room.id,
      userId: user.id,
      username: user.username,
      role
    });
  } catch (error) {
    console.error('Error joining room:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
