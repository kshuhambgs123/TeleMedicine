# Telemed Backend (Node.js + Sequelize + Postgres ( for now javascript maps (Use in-memory data structure as per requiremet) ) + ws)

## Summary
Backend for a mini real-time telemedicine app.
 Features:
- User register/login (PATIENT / DOCTOR) with JWT auth
- POST /doctors/status protected endpoint for doctors to set status
- Single WebSocket endpoint `/ws?token=JWT` that:
  - authenticates users via JWT
  - broadcasts updated user lists on connect/disconnect and status changes
  - relays direct chat messages
  - relays WebRTC signaling (offer/answer/ice-candidate)
  - supports `call_start` and `call_end` messages which set/reset doctor status

## Tech
- Node.js (Express)
- Sequelize + PostgreSQL
- ws (WebSocket)
- JWT auth
- bcrypt for password hashing

## Setup
1. Clone repo
2. `cp .env.example .env` and edit `.env` (DATABASE_URL, JWT_SECRET, PORT)
3. `npm install`
4. `npm run start`

## API Endpoints
- `POST /auth/register`  
  body: `{ name, email, password, role }` role = 'PATIENT'|'DOCTOR'

- `POST /auth/login`  
  body: `{ email, password }`  
  returns `{ token, user }`

- `POST /doctors/status` (protected)  
  header: `Authorization: Bearer <token>`  
  body: `{ status: 'ONLINE'|'BUSY'|'OFFLINE' }`  
  (only for users with role DOCTOR)

- `GET /doctors` (protected) - list doctors

## WebSocket
Connect to: `ws://<host>:<port>/ws?token=<JWT>`

Message types (JSON):
- `chat`: `{ type: 'chat', to: <userId?>, data: { message } }`  
  if `to` omitted => broadcast
- `signal`: `{ type: 'signal', to: <userId>, data: { signalType, sdpOrIce } }`
- `call_start`: `{ type: 'call_start', to: <doctorId>, data: { callId } }`
- `call_end`: `{ type: 'call_end', to: <userId> }`
- `set_status`: `{ type: 'set_status', data: { status: 'ONLINE'|'BUSY'|'OFFLINE' } }`

Server messages examples:
- `users` — list of users with roles and statuses
- `incoming_call` — doctor receives this when patient starts a call
- `chat` — delivered chat message
- `signal` — delivered WebRTC signaling payload
- `call_end` — delivered when a call ends

WebSocket / Call Flow : 

Patient                         Server                          Doctor
   |                               |                               |
   |--connect ws with JWT--------->|                               |
   |                               |                               |
   |<------user list-------------->|                               |
   |                               |                               |
   |--chat / broadcast------------>|                               |
   |                               |--relays chat----------------->|
   |                               |<--relays chat-----------------|
   |                               |                               |
   |--call_start(to doctor)------->|                               |
   |                               |--check doctor status----------|
   |                               |--mark doctor BUSY------------>|
   |                               |--broadcast updated users---->|
   |                               |--notify doctor incoming_call->|
   |<-----call_response(ok)--------|                               |
   |                               |                               |
   |--signal(offer)--------------->|                               |
   |                               |--relay signal---------------->|
   |<--signal(answer / ice)--------|                               |
   |                               |                               |
   |   (WebRTC P2P connection: audio/video)                       |
   |                               |                               |
   |--call_end-------------------->|                               |
   |                               |--relay call_end-------------->|
   |                               |--mark doctor ONLINE---------->|


This diagram shows the sequence of events between a Patient, the Server, and a Doctor when using the WebSocket for real-time chat and calls:

Connection & Presence:

Patient and Doctor connect via WebSocket using their JWT.

Server authenticates and broadcasts the current user list.

Chat Messages:

Users can send direct messages or broadcast messages.

Server relays the messages to the intended recipient(s).

Call Initiation:

Patient sends call_start to a Doctor.

Server checks the Doctor’s status, marks them BUSY, broadcasts updated user lists, and notifies the Doctor.

Patient receives a call_response indicating if the call can proceed.

WebRTC Signaling:

offer, answer, and ice-candidate messages are exchanged via the server to establish a peer-to-peer audio/video connection.

Call End:

Either participant sends call_end.

Server relays the message to the other peer and resets the Doctor’s status to ONLINE.

## Next steps / Improvements
- Add migrations (sequelize-cli) for production schema management.
- Add better error & event logging.
- Rate limiting and input validation (e.g., Joi).
- Implement tests.
