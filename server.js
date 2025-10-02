require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser')
// const db = require('./Models');
const authRoutes = require('./Routes/auth');
const doctorRoutes = require('./Routes/doctor');
// const WSBroadcaster = require('./ws/ws-server');
const { createWSServer } = require('./ws/ws-server');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true}))
app.use(cookieParser())

// routes
app.use('/auth', authRoutes); // /auth/register, /auth/login
app.use('/doctors', doctorRoutes); // /doctors/status, /doctors/

// health
app.get('/', (req, res) => res.send('Telemed backend running'));

// sync DB and start server
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const { wss, wsBroadcaster } = createWSServer(server, app);
app.locals.wsBroadcaster = wsBroadcaster;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`WS endpoint: ws://localhost:${PORT}/ws?token=<JWT>`)
    //console.log(`WebSocket endpoint: ws://<host>:${PORT}/ws?token=<JWT>`);
});


/*
(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('DB connected');
    await db.sequelize.sync({ alter: true });
    console.log('DB synced');

    // create broadcaster and attach to app.locals so routes can call broadcastUsers()
    // const broadcaster = new WSBroadcaster(server, app);
    // app.locals.wsBroadcaster = broadcaster;

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    //   console.log(`WebSocket endpoint: ws://<host>:${PORT}/ws?token=<JWT>`);
    });
  } catch (err) {
    console.error('Failed to start', err);
    process.exit(1);
  }
})();
*/

