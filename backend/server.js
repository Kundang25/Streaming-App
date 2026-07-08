const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup
// const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
// app.use(cors({
//   origin: allowedOrigin,
//   methods: ['GET', 'POST'],
//   credentials: true
// }));
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// REST Routes
const roomsRouter = require('./routes/rooms');
app.use('/api', roomsRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Express Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// HTTP Server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO Handlers
require('./sockets/SocketHandler')(io);

// Start listening
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`YouTube Watch Party Backend is running!`);
  console.log(`Server Port: ${PORT}`);
  console.log(`Allowed Origin: ${allowedOrigin}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=========================================`);
});
