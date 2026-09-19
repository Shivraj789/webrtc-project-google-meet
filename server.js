const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve public folder
app.use(express.static(path.join(__dirname, "public")));

// Simple test route
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Express server is working"
    });
});

// Socket.IO connection
io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    // User joins a room
    socket.on("join-room", (roomId) => {

        if (!roomId) {
            return;
        }

        const room = io.sockets.adapter.rooms.get(roomId);

        const users = room ? room.size : 0;

        // Only allow 2 people
        if (users >= 2) {
            socket.emit("room-full");
            return;
        }

        socket.join(roomId);

        socket.roomId = roomId;

        console.log(`${socket.id} joined room ${roomId}`);

        // Tell user they successfully joined
        socket.emit("room-joined", {
            roomId,
            users: users + 1
        });

        // If another user already exists,
        // tell that user that a new peer joined.
        if (users === 1) {
            socket.to(roomId).emit("peer-joined");
        }
    });

    // WebRTC OFFER
    socket.on("offer", (data) => {

        const { roomId, offer } = data;

        socket.to(roomId).emit("offer", offer);
    });

    // WebRTC ANSWER
    socket.on("answer", (data) => {

        const { roomId, answer } = data;

        socket.to(roomId).emit("answer", answer);
    });

    // ICE candidate
    socket.on("ice-candidate", (data) => {

        const { roomId, candidate } = data;

        socket.to(roomId).emit("ice-candidate", candidate);
    });

    // User disconnects
    socket.on("disconnect", () => {

        console.log("User disconnected:", socket.id);

        if (socket.roomId) {
            socket.to(socket.roomId).emit("peer-left");
        }
    });
});

server.listen(PORT, () => {
    console.log(`WebRTC server running at http://localhost:${PORT}`);
});