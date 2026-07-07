const supabase = require('./SupabaseClient');

class RoomRepository {
  async createRoom(roomCode, roomName, hostId) {
    // 1. Insert room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        room_name: roomName,
        host_id: hostId,
        created_by: hostId,
        is_active: true
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // 2. Insert default settings
    const { error: settingsError } = await supabase
      .from('room_settings')
      .insert({ room_id: room.id });

    if (settingsError) throw settingsError;

    // 3. Insert default state
    const { error: stateError } = await supabase
      .from('room_state')
      .insert({ room_id: room.id });

    if (stateError) throw stateError;

    // 4. Insert host participant
    const { error: participantError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.id,
        user_id: hostId,
        role: 'HOST',
        is_online: true
      });

    if (participantError) throw participantError;

    return room;
  }

  async getRoomByCode(roomCode) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, room_settings(*)')
      .eq('room_code', roomCode)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getRoomById(roomId) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, room_settings(*)')
      .eq('id', roomId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getParticipantCount(roomId) {
    const { data, error, count } = await supabase
      .from('room_participants')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .is('left_at', null);

    if (error) throw error;
    return count || 0;
  }

  async addParticipant(roomId, userId, role = 'PARTICIPANT', isOnline = true) {
    const { data, error } = await supabase
      .from('room_participants')
      .upsert(
        {
          room_id: roomId,
          user_id: userId,
          role: role,
          is_online: isOnline,
          left_at: null,
          joined_at: new Date().toISOString()
        },
        { onConflict: 'room_id,user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateParticipantStatus(roomId, userId, updates) {
    const { data, error } = await supabase
      .from('room_participants')
      .update(updates)
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getRoomParticipants(roomId) {
    const { data, error } = await supabase
      .from('v_active_room_participants')
      .select('*')
      .eq('room_id', roomId);

    if (error) throw error;
    return data;
  }

  async getRoomState(roomId) {
    const { data, error } = await supabase
      .from('room_state')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateRoomState(roomId, updates) {
    const { data, error } = await supabase
      .from('room_state')
      .update(updates)
      .eq('room_id', roomId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getRoomSettings(roomId) {
    const { data, error } = await supabase
      .from('room_settings')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async isUserBanned(roomId, userId) {
    const { data, error } = await supabase
      .from('banned_users')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async banUser(roomId, userId, bannedBy, reason) {
    const { data, error } = await supabase
      .from('banned_users')
      .upsert(
        {
          room_id: roomId,
          user_id: userId,
          banned_by: bannedBy,
          reason: reason,
          created_at: new Date().toISOString()
        },
        { onConflict: 'room_id,user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addPlaybackHistory(roomId, videoId, changedBy) {
    // 1. Close current active playback history row
    await supabase
      .from('playback_history')
      .update({ ended_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .is('ended_at', null);

    // 2. Insert new playback history row
    const { data, error } = await supabase
      .from('playback_history')
      .insert({
        room_id: roomId,
        video_id: videoId,
        changed_by: changedBy
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addRoleHistory(roomId, userId, oldRole, newRole, changedBy) {
    const { data, error } = await supabase
      .from('role_history')
      .insert({
        room_id: roomId,
        user_id: userId,
        old_role: oldRole,
        new_role: newRole,
        changed_by: changedBy
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async insertChatMessage(roomId, senderId, message) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: senderId,
        message: message
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async insertReaction(roomId, userId, emoji) {
    const { data, error } = await supabase
      .from('emoji_reactions')
      .insert({
        room_id: roomId,
        user_id: userId,
        emoji: emoji
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateRoomHost(roomId, newHostId) {
    const { data, error } = await supabase
      .from('rooms')
      .update({ host_id: newHostId })
      .eq('id', roomId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deactivateRoom(roomId) {
    const { data, error } = await supabase
      .from('rooms')
      .update({ is_active: false })
      .eq('id', roomId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new RoomRepository();
