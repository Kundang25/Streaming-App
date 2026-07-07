const roomManager = require('../domain/RoomManager');
const userRepository = require('../repositories/UserRepository');
const roomRepository = require('../repositories/RoomRepository');
const activityRepository = require('../repositories/ActivityRepository');
const Participant = require('../domain/Participant');

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connection established: ${socket.id}`);

    // Helper to validate and retrieve socket state
    const getSocketContext = async (eventName) => {
      const { userId, roomId } = socket;
      if (!userId || !roomId) {
        throw new Error(`Socket not authenticated or not in a room for event: ${eventName}`);
      }

      const room = await roomManager.getOrCreateRoom(roomId);
      if (!room) {
        throw new Error(`Room not found: ${roomId}`);
      }

      const participant = room.getParticipant(userId);
      if (!participant) {
        throw new Error(`Participant not found in memory: ${userId}`);
      }

      return { room, participant, userId, roomId };
    };

    // Helper to send permission errors
    const sendPermissionError = (event, message) => {
      socket.emit('action_error', { event, message });
      console.warn(`[Socket] Permission denied on socket ${socket.id} for event ${event}: ${message}`);
    };

    // Helper to send generic errors
    const sendGenericError = (event, message) => {
      socket.emit('action_error', { event, message });
      console.error(`[Socket] Error on socket ${socket.id} for event ${event}: ${message}`);
    };

    // Event: join_room
    socket.on('join_room', async (payload) => {
      try {
        const { roomId, username } = payload || {};
        let { userId } = payload || {};

        if (!roomId || (!username && !userId)) {
          return sendGenericError('join_room', 'roomId and username/userId are required');
        }

        // 1. Retrieve or create Room object in memory
        const room = await roomManager.getOrCreateRoom(roomId);
        if (!room) {
          return sendGenericError('join_room', 'Room not found or inactive');
        }

        // 2. Resolve userId if not provided
        if (!userId) {
          // Look up active participant in room by username
          const list = room.getParticipantList();
          const match = list.find(p => p.username.toLowerCase() === username.toLowerCase());
          if (match) {
            userId = match.userId;
          } else {
            // Check in db
            const dbParticipants = await roomRepository.getRoomParticipants(roomId);
            const dbMatch = dbParticipants.find(p => p.username.toLowerCase() === username.toLowerCase());
            if (dbMatch) {
              userId = dbMatch.user_id;
            } else {
              return sendGenericError('join_room', 'Participant session not initialized via REST API');
            }
          }
        }

        // 3. Check ban status
        const isBanned = await roomRepository.isUserBanned(roomId, userId);
        if (isBanned) {
          socket.emit('action_error', { event: 'join_room', message: 'You are banned from this room' });
          socket.disconnect(true);
          return;
        }

        // 4. Fetch user details from DB to get the official username
        const user = await userRepository.getUserById(userId);
        if (!user) {
          return sendGenericError('join_room', 'User profile not found');
        }

        // 5. Update user and room participant status to online in database
        await userRepository.updateUserSocket(userId, socket.id, true);
        const participantRecord = await roomRepository.updateParticipantStatus(roomId, userId, {
          is_online: true,
          left_at: null
        });

        // 6. Instantiate or update Participant in-memory
        let participant = room.getParticipant(userId);
        if (participant) {
          participant.socketId = socket.id;
          participant.role = participantRecord.role;
        } else {
          participant = new Participant({
            userId: user.id,
            username: user.username,
            role: participantRecord.role,
            socketId: socket.id
          });
          room.addParticipant(participant);
        }

        // 7. Initialize/log session details
        const ipAddress = socket.handshake.address;
        const userAgent = socket.handshake.headers['user-agent'];
        await userRepository.createUserSession({
          userId: user.id,
          roomId,
          socketId: socket.id,
          ipAddress,
          userAgent
        });

        // Parse user agent to store device info if possible
        let browser = 'Unknown', os = 'Unknown', device = 'Unknown';
        if (userAgent) {
          if (userAgent.includes('Firefox')) browser = 'Firefox';
          else if (userAgent.includes('Chrome')) browser = 'Chrome';
          else if (userAgent.includes('Safari')) browser = 'Safari';
          
          if (userAgent.includes('Windows')) os = 'Windows';
          else if (userAgent.includes('Macintosh')) os = 'Mac OS';
          else if (userAgent.includes('Linux')) os = 'Linux';
          
          if (userAgent.includes('Mobile')) device = 'Mobile';
          else device = 'Desktop';
        }
        await userRepository.upsertDeviceInfo(user.id, { browser, os, device });

        // 8. Log join activity
        await activityRepository.logActivity(roomId, userId, 'JOIN_ROOM', {
          username: user.username,
          socketId: socket.id
        });

        // 9. Attach socket parameters
        socket.userId = userId;
        socket.roomId = roomId;
        socket.join(roomId);

        console.log(`[Socket] User ${user.username} (${userId}) joined room ${roomId}`);

        // 10. Broadcast user_joined
        room.broadcast(io, 'user_joined', {
          username: user.username,
          userId: user.id,
          role: participant.role,
          participants: room.getParticipantList()
        });

        // 11. Emit initial player sync state to the new client
        socket.emit('sync_state', {
          playState: room.state.is_playing || false,
          currentTime: Number(room.state.current_time_seconds || 0),
          videoId: room.state.video_id || null,
          queue: room.queue || []
        });

      } catch (error) {
        console.error('Error in join_room:', error);
        sendGenericError('join_room', 'Internal server error');
      }
    });

    // Event: leave_room
    socket.on('leave_room', async () => {
      try {
        const { room, participant, userId, roomId } = await getSocketContext('leave_room');

        // 1. Update database status
        await roomRepository.updateParticipantStatus(roomId, userId, {
          is_online: false,
          left_at: new Date().toISOString()
        });
        await userRepository.updateUserSocket(userId, null, false);
        await userRepository.closeUserSession(socket.id);

        // 2. Log activity
        await activityRepository.logActivity(roomId, userId, 'LEAVE_ROOM', {
          username: participant.username
        });

        // 3. Mutate in-memory Room
        room.removeParticipant(userId);

        console.log(`[Socket] User ${participant.username} left room ${roomId}`);

        // 4. Broadcast user_left
        room.broadcast(io, 'user_left', {
          userId,
          username: participant.username,
          participants: room.getParticipantList()
        });

        // 5. Clean up socket associations
        socket.leave(roomId);
        socket.userId = null;
        socket.roomId = null;

      } catch (error) {
        console.error('Error in leave_room:', error.message);
        sendGenericError('leave_room', error.message);
      }
    });

    // Event: play
    socket.on('play', async () => {
      try {
        const { room, participant, userId, roomId } = await getSocketContext('play');

        // 1. Check permissions
        if (!participant.hasPermission('play', room.settings)) {
          return sendPermissionError('play', 'You do not have permission to play video');
        }

        // 2. Persist to DB
        await roomRepository.updateRoomState(roomId, {
          is_playing: true,
          updated_by: userId
        });

        // 3. Log actions/activities
        await activityRepository.logActivity(roomId, userId, 'PLAY');
        await activityRepository.logParticipantAction(roomId, userId, 'PLAY');

        // 4. Mutate in-memory Room state
        room.updatePlaybackState({
          is_playing: true,
          updated_by: userId
        });

        // 5. Broadcast updated sync_state
        room.broadcast(io, 'sync_state', {
          playState: true,
          currentTime: Number(room.state.current_time_seconds || 0),
          videoId: room.state.video_id || null
        });

      } catch (error) {
        console.error('Error in play:', error.message);
        sendGenericError('play', error.message);
      }
    });

    // Event: pause
    socket.on('pause', async () => {
      try {
        const { room, participant, userId, roomId } = await getSocketContext('pause');

        // 1. Check permissions
        if (!participant.hasPermission('pause', room.settings)) {
          return sendPermissionError('pause', 'You do not have permission to pause video');
        }

        // 2. Persist to DB
        await roomRepository.updateRoomState(roomId, {
          is_playing: false,
          updated_by: userId
        });

        // 3. Log actions/activities
        await activityRepository.logActivity(roomId, userId, 'PAUSE');
        await activityRepository.logParticipantAction(roomId, userId, 'PAUSE');

        // 4. Mutate in-memory Room state
        room.updatePlaybackState({
          is_playing: false,
          updated_by: userId
        });

        // 5. Broadcast updated sync_state
        room.broadcast(io, 'sync_state', {
          playState: false,
          currentTime: Number(room.state.current_time_seconds || 0),
          videoId: room.state.video_id || null
        });

      } catch (error) {
        console.error('Error in pause:', error.message);
        sendGenericError('pause', error.message);
      }
    });

    // Event: seek
    socket.on('seek', async (payload) => {
      try {
        const { time } = payload || {};
        if (typeof time !== 'number') {
          return sendGenericError('seek', 'Invalid time payload');
        }

        const { room, participant, userId, roomId } = await getSocketContext('seek');

        // 1. Check permissions
        if (!participant.hasPermission('seek', room.settings)) {
          return sendPermissionError('seek', 'You do not have permission to seek video');
        }

        // 2. Persist to DB
        await roomRepository.updateRoomState(roomId, {
          current_time_seconds: time,
          updated_by: userId
        });

        // 3. Log actions/activities
        await activityRepository.logActivity(roomId, userId, 'SEEK', { time });
        await activityRepository.logParticipantAction(roomId, userId, 'SEEK', { time });

        // 4. Mutate in-memory Room state
        room.updatePlaybackState({
          current_time_seconds: time,
          updated_by: userId
        });

        // 5. Broadcast updated sync_state
        room.broadcast(io, 'sync_state', {
          playState: room.state.is_playing || false,
          currentTime: time,
          videoId: room.state.video_id || null
        });

      } catch (error) {
        console.error('Error in seek:', error.message);
        sendGenericError('seek', error.message);
      }
    });

    // Event: change_video
    socket.on('change_video', async (payload) => {
      try {
        const { videoId } = payload || {};
        if (!videoId || typeof videoId !== 'string') {
          return sendGenericError('change_video', 'Invalid videoId');
        }

        const { room, participant, userId, roomId } = await getSocketContext('change_video');

        // 1. Check permissions
        if (!participant.hasPermission('change_video', room.settings)) {
          return sendPermissionError('change_video', 'You do not have permission to change the video');
        }

        // 2. Persist to DB (playback history + room state updates)
        await roomRepository.addPlaybackHistory(roomId, videoId, userId);
        await roomRepository.updateRoomState(roomId, {
          video_id: videoId,
          current_time_seconds: 0,
          updated_by: userId
        });

        // 3. Log activity
        await activityRepository.logActivity(roomId, userId, 'CHANGE_VIDEO', { videoId });

        // 4. Mutate in-memory Room state
        room.updatePlaybackState({
          video_id: videoId,
          current_time_seconds: 0,
          updated_by: userId
        });

        // 5. Broadcast updated sync_state
        room.broadcast(io, 'sync_state', {
          playState: room.state.is_playing || false,
          currentTime: 0,
          videoId: videoId
        });

      } catch (error) {
        console.error('Error in change_video:', error.message);
        sendGenericError('change_video', error.message);
      }
    });

    // Event: assign_role
    socket.on('assign_role', async (payload) => {
      try {
        const { userId: targetUserId, role: newRole } = payload || {};
        const validRoles = ['HOST', 'MODERATOR', 'PARTICIPANT', 'VIEWER'];
        if (!targetUserId || !validRoles.includes(newRole)) {
          return sendGenericError('assign_role', 'Invalid userId or role');
        }

        const { room, participant, userId, roomId } = await getSocketContext('assign_role');

        // 1. Check permissions (Caller must be HOST)
        if (!participant.hasPermission('assign_role', room.settings)) {
          return sendPermissionError('assign_role', 'Only the Host can assign roles');
        }

        const targetParticipant = room.getParticipant(targetUserId);
        const oldRole = targetParticipant ? targetParticipant.role : 'PARTICIPANT';

        // 2. Persist to DB
        await roomRepository.updateParticipantStatus(roomId, targetUserId, { role: newRole });
        await roomRepository.addRoleHistory(roomId, targetUserId, oldRole, newRole, userId);
        await activityRepository.logActivity(roomId, userId, 'ASSIGN_ROLE', {
          targetUserId,
          oldRole,
          newRole
        });

        // 3. Mutate in-memory Room participant
        if (targetParticipant) {
          targetParticipant.role = newRole;
        }

        // 4. Broadcast role_assigned
        room.broadcast(io, 'role_assigned', {
          userId: targetUserId,
          username: targetParticipant ? targetParticipant.username : 'Unknown',
          role: newRole,
          participants: room.getParticipantList()
        });

      } catch (error) {
        console.error('Error in assign_role:', error.message);
        sendGenericError('assign_role', error.message);
      }
    });

    // Event: remove_participant
    socket.on('remove_participant', async (payload) => {
      try {
        const { userId: targetUserId } = payload || {};
        if (!targetUserId) {
          return sendGenericError('remove_participant', 'targetUserId is required');
        }

        const { room, participant, userId, roomId } = await getSocketContext('remove_participant');

        // 1. Check permissions (Caller must be HOST)
        if (!participant.hasPermission('remove_participant', room.settings)) {
          return sendPermissionError('remove_participant', 'Only the Host can remove participants');
        }

        if (targetUserId === userId) {
          return sendGenericError('remove_participant', 'You cannot remove yourself');
        }

        const targetParticipant = room.getParticipant(targetUserId);

        // 2. Persist status update to DB (soft delete by marking left_at and offline)
        await roomRepository.updateParticipantStatus(roomId, targetUserId, {
          is_online: false,
          left_at: new Date().toISOString()
        });
        await activityRepository.logActivity(roomId, userId, 'REMOVE_PARTICIPANT', {
          removedUserId: targetUserId,
          username: targetParticipant ? targetParticipant.username : 'Unknown'
        });

        // 3. Mutate in-memory Room
        room.removeParticipant(targetUserId);

        // 4. Broadcast participant_removed
        room.broadcast(io, 'participant_removed', {
          userId: targetUserId,
          participants: room.getParticipantList()
        });

        // 5. Force-disconnect target user's socket
        if (targetParticipant && targetParticipant.socketId) {
          const targetSocket = io.sockets.sockets.get(targetParticipant.socketId);
          if (targetSocket) {
            targetSocket.emit('action_error', { event: 'remove_participant', message: 'You have been removed by the host' });
            targetSocket.disconnect(true);
          }
        }

      } catch (error) {
        console.error('Error in remove_participant:', error.message);
        sendGenericError('remove_participant', error.message);
      }
    });

    // Event: transfer_host
    socket.on('transfer_host', async (payload) => {
      try {
        const { userId: targetUserId } = payload || {};
        if (!targetUserId) {
          return sendGenericError('transfer_host', 'targetUserId is required');
        }

        const { room, participant, userId, roomId } = await getSocketContext('transfer_host');

        // 1. Check permissions (Caller must be current HOST)
        if (!participant.hasPermission('transfer_host', room.settings)) {
          return sendPermissionError('transfer_host', 'Only the Host can transfer host ownership');
        }

        if (targetUserId === userId) {
          return sendGenericError('transfer_host', 'You are already the host');
        }

        const targetParticipant = room.getParticipant(targetUserId);
        if (!targetParticipant) {
          return sendGenericError('transfer_host', 'Target user is not currently in the room');
        }

        // 2. Persist changes to DB
        // Transfer rooms host_id
        await roomRepository.updateRoomHost(roomId, targetUserId);
        // Update roles: old host -> MODERATOR, new host -> HOST
        await roomRepository.updateParticipantStatus(roomId, userId, { role: 'MODERATOR' });
        await roomRepository.updateParticipantStatus(roomId, targetUserId, { role: 'HOST' });

        // Add history rows
        await roomRepository.addRoleHistory(roomId, userId, 'HOST', 'MODERATOR', userId);
        await roomRepository.addRoleHistory(roomId, targetUserId, targetParticipant.role, 'HOST', userId);

        // Log activity
        await activityRepository.logActivity(roomId, userId, 'TRANSFER_HOST', {
          oldHostId: userId,
          newHostId: targetUserId
        });

        // 3. Mutate in-memory Room
        room.hostId = targetUserId;
        participant.role = 'MODERATOR';
        targetParticipant.role = 'HOST';

        console.log(`[Socket] Host transferred from ${participant.username} to ${targetParticipant.username}`);

        // 4. Broadcast role updates
        room.broadcast(io, 'role_assigned', {
          userId: userId,
          username: participant.username,
          role: 'MODERATOR',
          participants: room.getParticipantList()
        });

        room.broadcast(io, 'role_assigned', {
          userId: targetUserId,
          username: targetParticipant.username,
          role: 'HOST',
          participants: room.getParticipantList()
        });

      } catch (error) {
        console.error('Error in transfer_host:', error.message);
        sendGenericError('transfer_host', error.message);
      }
    });

    // Event: send_message (chat message)
    socket.on('send_message', async (payload) => {
      try {
        const { message } = payload || {};
        if (!message || typeof message !== 'string' || !message.trim()) {
          return sendGenericError('send_message', 'Invalid message content');
        }

        const { room, participant, userId, roomId } = await getSocketContext('send_message');

        // 1. Check settings and permissions
        if (!participant.hasPermission('chat', room.settings)) {
          return sendPermissionError('send_message', 'Chat is disabled or you do not have permission to chat');
        }

        // 2. Persist to DB
        const msgRecord = await roomRepository.insertChatMessage(roomId, userId, message.trim());

        // 3. Broadcast to room
        room.broadcast(io, 'chat_message', {
          id: msgRecord.id,
          roomId: roomId,
          senderId: userId,
          senderUsername: participant.username,
          message: msgRecord.message,
          sentAt: msgRecord.sent_at
        });

      } catch (error) {
        console.error('Error in send_message:', error.message);
        sendGenericError('send_message', error.message);
      }
    });

    // Event: send_reaction
    socket.on('send_reaction', async (payload) => {
      try {
        const { emoji } = payload || {};
        if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
          return sendGenericError('send_reaction', 'Invalid emoji reaction');
        }

        const { room, participant, userId, roomId } = await getSocketContext('send_reaction');

        // 1. Check settings and permissions
        if (!participant.hasPermission('reaction', room.settings)) {
          return sendPermissionError('send_reaction', 'Reactions are disabled or you do not have permission');
        }

        // 2. Persist to DB
        const rxnRecord = await roomRepository.insertReaction(roomId, userId, emoji.trim());

        // 3. Broadcast to room
        room.broadcast(io, 'emoji_reaction', {
          userId: userId,
          username: participant.username,
          emoji: rxnRecord.emoji,
          timestamp: rxnRecord.timestamp
        });

      } catch (error) {
        console.error('Error in send_reaction:', error.message);
        sendGenericError('send_reaction', error.message);
      }
    });
    // Event: end_room
    socket.on('end_room', async () => {
      try {
        const { room, participant, userId, roomId } = await getSocketContext('end_room');

        // 1. Verify permissions (HOST only)
        if (participant.role !== 'HOST') {
          return sendPermissionError('end_room', 'Only the Host can end the meeting for all');
        }

        // 2. Persist to DB: deactivate the room
        await roomRepository.deactivateRoom(roomId);

        // 3. Log activities
        await activityRepository.logActivity(roomId, userId, 'LEAVE_ROOM', {
          username: participant.username,
          endedRoom: true
        });

        // 4. Broadcast room_ended
        room.broadcast(io, 'room_ended', {
          message: 'The watch party has been ended by the Host.'
        });

        // 5. Force all sockets in the room to disconnect/leave
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          s.leave(roomId);
          s.userId = null;
          s.roomId = null;
        }

        // 6. Delete room from RoomManager cache
        roomManager.rooms.delete(roomId);

        console.log(`[Socket] Room ${roomId} has been ended by Host ${participant.username}`);

      } catch (error) {
        console.error('Error in end_room:', error.message);
        sendGenericError('end_room', error.message);
      }
    });

    // Event: add_to_queue
    socket.on('add_to_queue', async (payload) => {
      try {
        const { videoId, title } = payload || {};
        if (!videoId || typeof videoId !== 'string') {
          return sendGenericError('add_to_queue', 'Invalid videoId');
        }

        const { room, participant, userId, roomId } = await getSocketContext('add_to_queue');

        // 1. Check permissions (Host/Mod, or Participant if allow_video_change is true)
        const canQueue = participant.role === 'HOST' || 
                         participant.role === 'MODERATOR' || 
                         room.settings.allow_video_change;

        if (!canQueue) {
          return sendPermissionError('add_to_queue', 'You do not have permission to add videos to the queue');
        }

        // 2. Add to in-memory queue
        const queueItem = {
          id: Math.random().toString(36).substring(2, 9),
          videoId,
          title: title || `YouTube Video (${videoId})`,
          addedBy: participant.username
        };
        room.addToQueue(queueItem);

        // 3. Log activity
        await activityRepository.logActivity(roomId, userId, 'CHANGE_VIDEO', {
          videoId,
          title: queueItem.title,
          isQueued: true
        });

        console.log(`[Socket] Added to queue: ${videoId} in room ${roomId}`);

        // 4. Broadcast updated queue
        room.broadcast(io, 'queue_updated', room.queue);

      } catch (error) {
        console.error('Error in add_to_queue:', error.message);
        sendGenericError('add_to_queue', error.message);
      }
    });

    // Event: remove_from_queue
    socket.on('remove_from_queue', async (payload) => {
      try {
        const { id } = payload || {};
        if (!id) {
          return sendGenericError('remove_from_queue', 'Invalid item ID');
        }

        const { room, participant, userId, roomId } = await getSocketContext('remove_from_queue');

        // 1. Check permissions (Host/Mod only)
        if (participant.role !== 'HOST' && participant.role !== 'MODERATOR') {
          return sendPermissionError('remove_from_queue', 'You do not have permission to remove items from the queue');
        }

        // 2. Remove from in-memory queue
        room.removeFromQueue(id);

        console.log(`[Socket] Removed from queue: item ${id} in room ${roomId}`);

        // 3. Broadcast updated queue
        room.broadcast(io, 'queue_updated', room.queue);

      } catch (error) {
        console.error('Error in remove_from_queue:', error.message);
        sendGenericError('remove_from_queue', error.message);
      }
    });

    // Event: skip_video
    socket.on('skip_video', async () => {
      try {
        const { room, participant, userId, roomId } = await getSocketContext('skip_video');

        // 1. Check permissions (Host/Mod only)
        if (participant.role !== 'HOST' && participant.role !== 'MODERATOR') {
          return sendPermissionError('skip_video', 'You do not have permission to skip video');
        }

        // 2. Get next video from queue
        const nextVideo = room.getNextVideo();
        if (!nextVideo) {
          return sendGenericError('skip_video', 'Queue is empty');
        }

        const videoId = nextVideo.videoId;

        // 3. Update DB state
        await roomRepository.updateRoomState(roomId, {
          video_id: videoId,
          current_time_seconds: 0,
          is_playing: true,
          updated_by: userId
        });

        // 4. Add playback history row
        await roomRepository.addPlaybackHistory(roomId, videoId, userId);

        // 5. Log activity
        await activityRepository.logActivity(roomId, userId, 'CHANGE_VIDEO', {
          videoId,
          title: nextVideo.title
        });

        // 6. Mutate Room state
        room.updatePlaybackState({
          video_id: videoId,
          current_time_seconds: 0,
          is_playing: true,
          updated_by: userId
        });

        console.log(`[Socket] Skipped/Changed video to ${videoId} from queue in room ${roomId}`);

        // 7. Broadcast updated playback sync_state
        room.broadcast(io, 'sync_state', {
          playState: true,
          currentTime: 0,
          videoId: videoId
        });

        // 8. Broadcast updated queue
        room.broadcast(io, 'queue_updated', room.queue);

      } catch (error) {
        console.error('Error in skip_video:', error.message);
        sendGenericError('skip_video', error.message);
      }
    });

    // Event: disconnect (Socket.IO connection closed)
    socket.on('disconnect', async () => {
      try {
        const { userId, roomId } = socket;
        if (!userId || !roomId) return; // Connection was not joined to any room

        const room = await roomManager.getOrCreateRoom(roomId);
        if (!room) return;

        const participant = room.getParticipant(userId);
        if (!participant) return;

        // 1. Update database status
        await roomRepository.updateParticipantStatus(roomId, userId, {
          is_online: false,
          left_at: new Date().toISOString()
        });
        await userRepository.updateUserSocket(userId, null, false);
        await userRepository.closeUserSession(socket.id);

        // 2. Log activity
        await activityRepository.logActivity(roomId, userId, 'LEAVE_ROOM', {
          username: participant.username,
          reason: 'socket_disconnect'
        });

        // 3. Mutate in-memory Room
        room.removeParticipant(userId);

        console.log(`[Socket] User ${participant.username} disconnected from room ${roomId}`);

        // 4. Broadcast user_left
        room.broadcast(io, 'user_left', {
          userId,
          username: participant.username,
          participants: room.getParticipantList()
        });

      } catch (error) {
        console.error('Error in socket disconnect handling:', error);
      }
    });
  });
};
