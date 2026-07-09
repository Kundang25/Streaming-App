# WatchParty

Watch YouTube videos together, perfectly in sync. Create a room, share the code, and everyone's play/pause/seek/video changes happen for the whole party at once — over real WebSockets, with host-controlled roles.

**Live app:** https://streaming-app-wine.vercel.app
**Backend:** https://streaming-app-kn0a.onrender.com
**Repo:** https://github.com/Kundang25/Streaming-App

---

## What it does

Multiple users join a shared room via a link or room code and watch a YouTube video together. When the Host or a Moderator plays, pauses, seeks, or changes the video, every participant in the room sees the same action within moments. Access inside each room is role-based (Host, Moderator, Participant/Viewer), enforced entirely on the backend so a client can never grant itself extra permissions.

## Features

- **Room management** — create a room, join by code, unique room codes, room validation (exists / active / not full / not banned)
- **Real-time sync** — play, pause, seek, and change video all sync across every participant; new joiners land in sync immediately via the current room state
- **Role-based access control**
  - **Host** (auto-assigned to the room creator) — full control: play/pause/seek/change video, assign roles, remove participants, transfer host
  - **Moderator** (host-assigned) — play/pause/seek/change video
  - **Participant / Viewer** — watch only
- **Backend-enforced permissions** — every privileged event is checked against the caller's role in the database before anything is written or broadcast; unauthorized attempts are rejected with an `action_error` event and nothing else happens
- **Live participant list** — join/leave/role changes broadcast instantly to everyone in the room
- **Chat and emoji reactions** (bonus)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, React Router, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL via Supabase (Row Level Security enabled, all writes via the backend's service role) |
| Video | YouTube IFrame Player API |
| Deployment | Vercel (frontend), Render (backend), Supabase (database) |

## Architecture

```
User
  │
  ▼
React frontend (Vite)
  │   REST API (create/join room)  +  Socket.IO (real-time sync)
  ▼
Express + Socket.IO server
  │
  ▼
PostgreSQL (Supabase)
```

The REST API handles one-time setup — creating a room or joining an existing one by code — and returns a `userId`, `roomId`, and `role`. Everything after that flows over the WebSocket connection. The backend is the single source of truth: every incoming socket event is permission-checked against the caller's stored role before it's written to the database and broadcast back to the room.

## WebSocket events

| Event | Direction | Purpose |
|---|---|---|
| `join_room` | Client → Server | Join a room; server resolves the caller's role |
| `leave_room` | Client → Server | Leave a room; server updates status and broadcasts the departure |
| `play` / `pause` / `seek` | Client → Server | Host/Moderator playback control; server updates room state and broadcasts |
| `change_video` | Client → Server | Host/Moderator changes the active video |
| `assign_role` | Client → Server | Host assigns a new role to a participant |
| `remove_participant` | Client → Server | Host removes a participant |
| `transfer_host` | Client → Server | Host hands off the Host role to another participant |
| `sync_state` | Server → Clients | Current `playState`, `currentTime`, and `videoId` for the room |
| `user_joined` / `user_left` | Server → Clients | Updated participant list |
| `role_assigned` | Server → Clients | A participant's role changed, with the updated participant list |
| `participant_removed` | Server → Clients | A participant was removed by the host |

## Database

Core tables: `users`, `rooms`, `room_participants`, plus supporting tables for synchronized playback (`room_state`), room settings, activity/role history, chat, emoji reactions, and bans. Every table has Row Level Security enabled; reads/writes happen through the backend using the Supabase service role key, never directly from the browser.

## Project structure

```
frontend/
  src/components/   ChatPanel, JoinGate, ParticipantList, PlaybackControls, ReactionBar, YoutubePlayer
  src/context/      RoomContext — socket connection, room state, all emit/listen wiring
  src/pages/        Home, RoomPage
  src/services/     api.ts — REST calls to the backend

backend/
  domain/           Room, Participant, RoomManager, PermissionService
  repositories/     Supabase query modules — UserRepository, RoomRepository, ActivityRepository
  sockets/          Socket.IO event handler registration
  routes/           REST endpoints for room create/join
```

## Getting started

Clone the repo and set up each side separately.

```bash
git clone https://github.com/Kundang25/Streaming-App.git
cd Streaming-App
```

### Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
PORT=5001
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
CORS_ORIGIN=http://localhost:5173
```

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

> **Never commit real `.env` values.** The service role key has full database access — keep it out of version control and rotate it if it's ever exposed.

## Deployment

| Part | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | Supabase |

For production, set `CORS_ORIGIN` on the backend to the deployed frontend's URL (not `localhost`), and set `VITE_API_URL` / `VITE_SOCKET_URL` on the frontend to the deployed backend's URL.

## Challenges faced

- Keeping WebSocket playback state in sync across clients without feedback loops between the YouTube player's own state events and incoming server broadcasts
- Avoiding stale closures in React effects holding the YouTube player instance, which silently broke permission and state checks inside player event callbacks
- Enforcing role checks strictly on the backend so a modified client could never grant itself Host/Moderator powers
- Reconciling REST-created room/participant state with the Socket.IO connection that follows it

## Future improvements

- Full authentication (Google + email via Supabase Auth) for hosts and joiners
- Persistent rooms and reconnect-after-refresh support
- Redis adapter for horizontal scaling across multiple Socket.IO instances
- Screen sharing

## License

MIT
