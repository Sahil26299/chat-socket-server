import { createServer } from "http";
import { Server } from "socket.io";
import "dotenv/config";
import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

const redis = new Redis(REDIS_URL || "");

export const socketEvents = {
  JOIN_USER_ROOM: "join-user-room", // user logs in to dashboard (to listen new chats)
  JOIN_CHAT_ROOM: "join-chat-room", // user opens a chat (to listen messages in that chat)
  SEND_MESSAGE: "send-message",
  RECEIVE_MESSAGES_IN_CHAT: "chat-message", // when user is viewing messages inside a particular chat
  RECEIVE_NEW_CHAT: "user-message", // when user is on dashboard, without any of the chat opened and new message is received
  USER_ONLINE: "user-online", // when user logs in to dashboard
  USER_OFFLINE: "user-offline", // when user logs out from dashboard
  DISCONNECT: "disconnect",
};

export const redisKeys = {
  ONLINE_USERS: "online-users",
  USER_SOCKET_MAP: "user-socket-map",
};

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");

  // join user room (dashboard)
  socket.on(socketEvents.JOIN_USER_ROOM, async (userId: string) => {
    console.log("user joined the user room:", userId);

    // Add user to online users set
    await redis.sadd(redisKeys.ONLINE_USERS, userId);

    // Map online user to socket id, to in turn receive that user based on socket id
    await redis.hset(redisKeys.USER_SOCKET_MAP, socket.id, userId);

    // Emit user online to all users
    socket.broadcast.emit(socketEvents.USER_ONLINE, userId);

    // Join user room
    socket.join(`user-room:${userId}`);
  });

  // join chat room (chat)
  socket.on(socketEvents.JOIN_CHAT_ROOM, (chatId: string) => {
    console.log("user joined the chat:", chatId);
    socket.join(`chat-room:${chatId}`);
  });

  // send a message
  socket.on(
    socketEvents.SEND_MESSAGE,
    (msg: any, toUserId: string, chatId: string) => {
      // emit message to user
      socket.to(`user-room:${toUserId}`).emit(socketEvents.RECEIVE_NEW_CHAT, {
        // lastMessage: msg?.text,
        lastMessage: {
          sentAt: msg?.createdAt,
          text: msg?.text,
          sender: msg?.sender,
        },
        chatId,
        unreadIncrement: 1,
      });
      // emit message to all users in the chat
      socket
        .to(`chat-room:${chatId}`)
        .emit(socketEvents.RECEIVE_MESSAGES_IN_CHAT, msg);
    }
  );

  // rcv chat message
  socket.on(socketEvents.RECEIVE_MESSAGES_IN_CHAT, (msg: string) => {
    console.log("message: ", msg);
  });

  // disconnection
  socket.on(socketEvents.DISCONNECT, async () => {
    console.log("user disconnected");
    const userId = await redis.hget(redisKeys.USER_SOCKET_MAP, socket.id);
    console.log(userId, "disconnecting userId");

    if (userId) {
      // Remove user from online users set
      await redis.srem(redisKeys.ONLINE_USERS, userId);

      // Remove user from user-socket-map
      await redis.hdel(redisKeys.USER_SOCKET_MAP, userId);

      // Emit user offline to all users
      socket.broadcast.emit(socketEvents.USER_OFFLINE, userId);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
