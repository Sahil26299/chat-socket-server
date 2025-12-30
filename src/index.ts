import { createServer } from "http";
import { Server } from "socket.io";

const socketEvents = {
  JOIN_USER_ROOM: "join-user-room",
  JOIN_CHAT_ROOM: "join-chat-room",
  SEND_MESSAGE: "send-message",
  CHAT_MESSAGE: "chat-message",
  USER_MESSAGE: "user-message",
  DISCONNECT: "disconnect",
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

  // join user room
  socket.on(socketEvents.JOIN_USER_ROOM, (userId: string) => {
    console.log("user joined the user room:", userId);
    socket.join(`user-room:${userId}`);
  });

  // join chat
  socket.on(socketEvents.JOIN_CHAT_ROOM, (chatId: string) => {
    console.log("user joined the chat:", chatId);
    socket.join(`chat-room:${chatId}`);
  });

  // send a message
  socket.on(
    socketEvents.SEND_MESSAGE,
    (msg: any, toUserId: string, chatId: string) => {
      console.log(msg, "toUserId:", toUserId, "chatId:", chatId, "msg");

      // emit message to user
      socket.to(`user-room:${toUserId}`).emit(socketEvents.USER_MESSAGE, {
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
      socket.to(`chat-room:${chatId}`).emit(socketEvents.CHAT_MESSAGE, msg);
    }
  );

  // rcv chat message
  socket.on(socketEvents.CHAT_MESSAGE, (msg: string) => {
    console.log("message: ", msg);
  });

  // disconnection
  socket.on(socketEvents.DISCONNECT, () => {
    console.log("user disconnected");
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
