class PermissionService {
  canPerform(role, action, settings = {}) {
    const isHost = role === 'HOST';
    const isMod = role === 'MODERATOR';
    const isHostOrMod = isHost || isMod;

    switch (action) {
      case 'play':
      case 'pause':
        return isHostOrMod;

      case 'seek':
        return isHostOrMod || !!settings.allow_seek;

      case 'change_video':
        return isHostOrMod || !!settings.allow_video_change;

      case 'assign_role':
      case 'remove_participant':
      case 'transfer_host':
        return isHost;

      case 'chat':
        return isHostOrMod || !!settings.allow_chat;

      case 'reaction':
        return isHostOrMod || !!settings.allow_reactions;

      default:
        return false;
    }
  }
}

module.exports = new PermissionService();
