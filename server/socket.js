import { Server as SocketIoServer } from "socket.io";
import Message from "./models/MeessgesModel.js";

const setupSocket = (server) => {
  const io = new SocketIoServer(server, {
    cors: {
      origin: process.env.ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const userSocketMap = new Map(); // userId -> Set of socketIds

  const disconnect = (socket) => {
    console.log(`Client Disconnected: ${socket.id}`);
    const userId = socket.handshake.query.userId;
    
    if (userId && userSocketMap.has(userId)) {
      const socketSet = userSocketMap.get(userId);
      socketSet.delete(socket.id);
      
      // If no more sockets for this user, remove the user entry
      if (socketSet.size === 0) {
        userSocketMap.delete(userId);
      }
    }
  };

  const sendMessage = async (message) => {
    const createdMessage = await Message.create(message);

    const messageData = await Message.findById(createdMessage._id).populate(
      "sender",
      "id email firstName lastName image color"
    ).populate(
      "recipient",
      "id email firstName lastName image color"
    );

    // Send to all sender's sockets
    if (userSocketMap.has(message.sender)) {
      const senderSockets = userSocketMap.get(message.sender);
      senderSockets.forEach(socketId => {
        io.to(socketId).emit("receiveMessage", messageData);
      });
    }

    // Send to all recipient's sockets
    if (userSocketMap.has(message.recipient)) {
      const recipientSockets = userSocketMap.get(message.recipient);
      recipientSockets.forEach(socketId => {
        io.to(socketId).emit("receiveMessage", messageData);
      });
    }
  };

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
      // Add this socket to the user's set of sockets
      if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
      }
      userSocketMap.get(userId).add(socket.id);
      console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    } else {
      console.log("User ID not provided during connection");
    }
    
    socket.on("sendMessage", sendMessage);
    socket.on("disconnect", () => disconnect(socket));
  });
};

export default setupSocket;
