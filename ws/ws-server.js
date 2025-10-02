// ws/wsServer.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { getUserById, updateUserStatus, getAllUsersPublic } = require('../storage/user');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

function createWSServer(server, app) {
  const wss = new WebSocket.Server({ noServer: true });

  // Map<userId, ws>
  const clients = new Map();

  // broadcaster utility for other modules
  const wsBroadcaster = {
    broadcastUsers: async () => {
      const users = getAllUsersPublic();
      const payload = JSON.stringify({ type: 'users', payload: users });
      for (const ws of clients.values()) {
        if (ws.readyState === WebSocket.OPEN) ws.send(payload);
      }
    },
    sendToUser: (userId, msgObj) => {
      const ws = clients.get(Number(userId));
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msgObj));
    },
    clients
  };

  // attach broadcaster to express app for controllers to use
  app.locals.wsBroadcaster = wsBroadcaster;

  server.on('upgrade', async function upgrade(request, socket, head) {
    // accept only /ws
    const { url } = request;
    if (!url.startsWith('/ws')) { socket.destroy(); return; }

    // Extract token from query param ?token=...
    const urlObj = new URL(request.url, `http://${request.headers.host}`);
    const token = urlObj.searchParams.get('token');
    if (!token) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }

    // Verify token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return;
    }

    // Complete WebSocket handshake
    wss.handleUpgrade(request, socket, head, function done(ws) {
      ws.user = { id: payload.id, email: payload.email, role: payload.role };
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws) => {
    try {
      const userId = Number(ws.user.id);
      // store
      clients.set(userId, ws);

      // Optionally ensure user exists and mark ONLINE (if doctor)
      const existing = await getUserById(userId);
      if (existing) {
        if (existing.role === 'DOCTOR' && existing.status !== 'BUSY') {
          await updateUserStatus(userId, 'ONLINE');
        }
      }

      // Immediately send full user list
      await wsBroadcaster.broadcastUsers();

      // Handle incoming messages
      ws.on('message', async (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

        const { type, to, payload } = msg;

        switch (type) {
          case 'heartbeat':
            // noop
            break;

          case 'chat':
            // {type:'chat', to:doctorId, payload:{text: 'hi'}}
            if (!to) return;
            wsBroadcaster.sendToUser(to, { type: 'chat', from: ws.user.id, payload });
            break;

          case 'offer':
          case 'answer':
          case 'ice-candidate':
            // relay signaling messages for WebRTC
            if (!to) return;
            wsBroadcaster.sendToUser(to, { type, from: ws.user.id, payload });
            break;

          case 'call-start':
            // patient initiates call to doctor
            // payload may include meta info
            if (!to) return;
            {
              const target = await getUserById(to);
              if (!target) {
                ws.send(JSON.stringify({ type: 'call-response', payload: { ok: false, reason: 'doctor-not-found' }}));
                return;
              }
              if (target.role !== 'DOCTOR') {
                ws.send(JSON.stringify({ type: 'call-response', payload: { ok: false, reason: 'not-a-doctor' }}));
                return;
              }
              if (target.status !== 'ONLINE') {
                ws.send(JSON.stringify({ type: 'call-response', payload: { ok: false, reason: 'doctor-not-available' }}));
                return;
              }

              // mark doctor BUSY
              await updateUserStatus(to, 'BUSY');
              await wsBroadcaster.broadcastUsers();

              // notify doctor
              wsBroadcaster.sendToUser(to, { type: 'call-start', from: ws.user.id, payload });

              // respond to caller with ok
              ws.send(JSON.stringify({ type: 'call-response', payload: { ok: true }}));
            }
            break;

          case 'call-end':
            // end call between two peers; payload.to used
            if (!to) return;
            {
              // If the ended participant is a doctor, reset to ONLINE
              const target = await getUserById(to);
              if (target && target.role === 'DOCTOR') {
                await updateUserStatus(to, 'ONLINE');
                await wsBroadcaster.broadcastUsers();
              }

              // notify other peer
              wsBroadcaster.sendToUser(to, { type: 'call-end', from: ws.user.id, payload });
            }
            break;

          default:
            console.warn('unknown ws message type', type);
        }
      });

      ws.on('close', async () => {
        clients.delete(userId);

        // if the user was a DOCTOR and was BUSY, set them to OFFLINE (or ONLINE? we'll set OFFLINE on disconnect)
        const user = await getUserById(userId);
        if (user && user.role === 'DOCTOR') {
          // safe to mark OFFLINE on disconnect
          await updateUserStatus(userId, 'OFFLINE');
        }
        await wsBroadcaster.broadcastUsers();
      });

    } catch (err) {
      console.error('ws connection error', err);
    }
  });

  return { wss, wsBroadcaster };
}

module.exports = { createWSServer };































































/*
const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
// const { User } = require('../Models');
const { getUserById, updateUserStatus, getAllUsersPublic } = require('../storage/user');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

class WSBroadcaster {
  constructor(server, app) {
    this.wss = new WebSocket.Server({ noServer: true });
    this.app = app;
    this.clients = new Map(); // userId -> ws
    this.setupUpgradeHandler(server);
    this.setupWSS();
  }

  setupUpgradeHandler(server) {
    server.on('upgrade', (req, socket, head) => {
      const parsed = url.parse(req.url, true);
      if (!parsed.pathname.startsWith('/ws')) {
        socket.destroy();
        return;
      }
      // accept upgrade and let wss handle it
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });
  }

  setupWSS() {
    this.wss.on('connection', async (ws, req) => {
      // Authenticate: token via query param ?token=...
      try {
        const parsed = url.parse(req.url, true);
        const token = parsed.query && parsed.query.token;
        if (!token) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing token' }));
          ws.close();
          return;
        }
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(payload.id, { attributes: ['id','name','email','role','status']});
        if (!user) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid user' }));
          ws.close();
          return;
        }

        ws.user = { id: user.id, role: user.role, name: user.name, email: user.email };
        this.clients.set(user.id, ws);

        // For doctors, if status is OFFLINE, set ONLINE on WS connect
        if (user.role === 'DOCTOR' && user.status === 'OFFLINE') {
          user.status = 'ONLINE';
          await user.save();
        }

        // Broadcast user list on connect
        await this.broadcastUsers();

        ws.on('message', (raw) => this._onMessage(ws, raw));
        ws.on('close', async () => {
          this.clients.delete(user.id);
          // When a doctor disconnects, set them OFFLINE
          if (user.role === 'DOCTOR') {
            const u = await User.findByPk(user.id);
            if (u) {
              u.status = 'OFFLINE';
              await u.save();
            }
          }
          await this.broadcastUsers();
        });

      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Auth failed' }));
        ws.close();
      }
    });
  }

  async broadcastUsers() {
    // get all users (or only doctors & signed-in patients) to broadcast
    const users = await User.findAll({ attributes: ['id','name','role','status'] });
    const payload = { type: 'users', users };
    for (const [, ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    }
  }

  // Relay helper
  sendToUser(userId, messageObj) {
    const ws = this.clients.get(userId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(messageObj));
    return true;
  }

  async _onMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
      return;
    }

    const { type, to, data } = msg;

    switch (type) {
      case 'chat': // { to, message }
        if (to) {
          const ok = this.sendToUser(to, { type: 'chat', from: ws.user.id, data: { message: data.message }});
          if (!ok) ws.send(JSON.stringify({ type: 'error', message: 'recipient offline' }));
        } else {
          // broadcast chat to all
          for (const [, c] of this.clients) {
            if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'chat', from: ws.user.id, data }));
          }
        }
        break;

      case 'signal': // WebRTC signaling => { to, signalType: 'offer'|'answer'|'ice', data: {...}}
        if (!to) return ws.send(JSON.stringify({ type: 'error', message: 'signal requires to' }));
        this.sendToUser(to, { type: 'signal', from: ws.user.id, data });
        break;

      case 'call_start': // patient -> doctor to start call
        // data: { to: doctorId, callId }
        if (!to) {
          ws.send(JSON.stringify({ type: 'error', message: 'call_start requires to' }));
          return;
        }
        // set doctor BUSY
        const doc = await User.findByPk(to);
        if (!doc) return ws.send(JSON.stringify({ type: 'error', message: 'doctor not found' }));
        if (doc.status !== 'ONLINE') {
          ws.send(JSON.stringify({ type: 'call_rejected', reason: 'doctor not available' }));
          return;
        }
        doc.status = 'BUSY';
        await doc.save();
        await this.broadcastUsers();

        // notify doctor
        this.sendToUser(to, { type: 'incoming_call', from: ws.user.id, data: { callId: data && data.callId }});
        break;

      case 'call_end':
        // data: { to }
        if (to) {
          // notify peer
          this.sendToUser(to, { type: 'call_end', from: ws.user.id, data });
        }
        // if the `to` is doctor we reset its status to ONLINE
        if (to) {
          const maybeDoc = await User.findByPk(to);
          if (maybeDoc && maybeDoc.role === 'DOCTOR') {
            maybeDoc.status = 'ONLINE';
            await maybeDoc.save();
            await this.broadcastUsers();
          }
        }
        break;

      case 'set_status': // convenience: allow websocket clients to change own status
        // data: { status }
        if (!data || !data.status) return;
        const allowed = ['ONLINE','BUSY','OFFLINE'];
        if (!allowed.includes(data.status)) return;
        const u = await User.findByPk(ws.user.id);
        if (u) {
          u.status = data.status;
          await u.save();
          await this.broadcastUsers();
        }
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'unknown message type' }));
    }
  }
}

module.exports = WSBroadcaster;
*/
