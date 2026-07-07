const supabase = require('./SupabaseClient');

class ActivityRepository {
  async logActivity(roomId, userId, action, details = {}) {
    const { data, error } = await supabase
      .from('room_activity_logs')
      .insert({
        room_id: roomId,
        user_id: userId,
        action: action,
        details: details
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async logParticipantAction(roomId, userId, action, actionData = {}) {
    const { data, error } = await supabase
      .from('participant_actions')
      .insert({
        room_id: roomId,
        user_id: userId,
        action: action,
        action_data: actionData
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new ActivityRepository();
