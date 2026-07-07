const supabase = require('./SupabaseClient');

class UserRepository {
  async createUser(username) {
    const { data, error } = await supabase
      .from('users')
      .insert({ username })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserById(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  async updateUserSocket(userId, socketId, isOnline) {
    const { data, error } = await supabase
      .from('users')
      .update({ socket_id: socketId, is_online: isOnline })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createUserSession({ userId, roomId, socketId, ipAddress, userAgent }) {
    // If ipAddress is IPv6 loopback (::1) or similar, handle it cleanly for postgres inet type.
    let cleanIp = ipAddress;
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
      cleanIp = '127.0.0.1';
    }

    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        room_id: roomId,
        socket_id: socketId,
        ip_address: cleanIp || null,
        user_agent: userAgent || null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async closeUserSession(socketId) {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        disconnected_at: new Date().toISOString()
      })
      .eq('socket_id', socketId)
      .eq('is_active', true)
      .select();

    if (error) throw error;
    return data;
  }

  async upsertDeviceInfo(userId, { browser, os, device }) {
    const { data: existing } = await supabase
      .from('device_info')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('device_info')
        .update({ browser, os, device, last_seen: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('device_info')
        .insert({ user_id: userId, browser, os, device })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }
}

module.exports = new UserRepository();
