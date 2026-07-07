const permissionService = require('./PermissionService');

class Participant {
  constructor({ userId, username, role, socketId }) {
    this.userId = userId;
    this.username = username;
    this.role = role;
    this.socketId = socketId;
  }

  hasPermission(action, settings = {}) {
    return permissionService.canPerform(this.role, action, settings);
  }

  toJSON() {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
      socketId: this.socketId
    };
  }
}

module.exports = Participant;
