const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now, refine in production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
    });

    // WebRTC signaling
    socket.on('offer', (offer) => {
      socket.to(roomId).emit('offer', offer);
    });

    socket.on('answer', (answer) => {
      socket.to(roomId).emit('answer', answer);
    });

    socket.on('candidate', (candidate) => {
      socket.to(roomId).emit('candidate', candidate);
    });

    // Chat messages
    socket.on('chat-message', (message) => {
      io.to(roomId).emit('chat-message', message);
    });
  });
});

app.get('/', (req, res) => {
  res.send('Live Classes Service is running');
});

app.post('/classes/schedule', (req, res) => {
  // Placeholder for class scheduling logic
  console.log('Class scheduling requested');
  res.status(200).send('Class scheduled (placeholder)');
});

app.post('/classes/:classId/record/start', (req, res) => {
  // Placeholder for starting recording logic
  console.log(`Recording started for class ${req.params.classId} (placeholder)`);
  res.status(200).send('Recording started (placeholder)');
});

app.post('/classes/:classId/record/stop', (req, res) => {
  // Placeholder for stopping recording logic
  console.log(`Recording stopped for class ${req.params.classId} (placeholder)`);
  res.status(200).send('Recording stopped (placeholder)');
});

server.listen(PORT, () => {
  console.log(`Live Classes Service listening on port ${PORT}`);
});
