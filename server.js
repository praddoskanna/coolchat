const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const { Server } = require("socket.io")
const io = new Server(server);

const path = require('path');

const mongoose = require('mongoose');

mongoose.connect(
    `mongodb+srv://superstarpunks:kdAAmboEDv9Y7ahu@superstarpunks.wn9k3h6.mongodb.net/test?retryWrites=true&w=majority`,{
        useNewUrlParser: true,
        useUnifiedTopology: true
    }
);

const messageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  });

const Message = mongoose.model('Message', messageSchema);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/chat', (req, res) => {
    res.sendFile(__dirname + '/chat.html');
})

let users = {};
let typingUsers = {};
let onlineUsers = {};
const privateRooms = {};

function generatePrivateRoomName(user1, user2) {
    // Sort usernames to ensure consistency in room naming
    const sortedUsernames = [user1, user2].sort();
    return sortedUsernames.join('_');
}

io.on('connection', async(socket) => {

    socket.emit('welcome', 'You are now Connected. Start Typing');

    const messages = await Message.find();
    socket.emit('load messages', messages);
        

    socket.on('disconnect', () => {
        const disconnectedUsername = users[socket.id];
        delete onlineUsers[socket.id];
        delete users[socket.id];
        if (disconnectedUsername) {
            io.emit('user left', disconnectedUsername);
            io.emit('online users', onlineUsers);
        }
    });

    socket.on('setUsername', (username) => {
        console.log("New User Joined",username)
        users[socket.id] = username;
        onlineUsers[socket.id] = username;
        socket.username = username;
        console.log(users);
        io.emit('user joined', username);
        io.emit('online users', onlineUsers);
    });

    socket.on('chat message', async(msg) => {
        const newMessage = new Message({
            sender: msg.nickname,
            text: msg.text
          });
        await newMessage.save();
        const messages = await Message.find();
        io.emit('chat message', messages);
        delete typingUsers[socket.id];
        socket.broadcast.emit('user stopped typing');
    });

    socket.on('typing', (typingUser) => {
        typingUsers[socket.id] = typingUser;
        socket.broadcast.emit('user typing', typingUser);
    })

    socket.on('stopped typing', () => {
        delete typingUsers[socket.id];
        socket.broadcast.emit('user stopped typing');
    });

    socket.on('start private chat', (targetUser) => {
        const roomName = generatePrivateRoomName(socket.username, targetUser);
        
        if (!privateRooms[roomName]) {
            privateRooms[roomName] = [socket.id];
        } else {
            privateRooms[roomName].push(socket.id);
        }

        socket.join(roomName);
    });

    socket.on('private message', (data) => {
        console.log("private message ",data);
        const roomName = generatePrivateRoomName(socket.username, data.targetUser);
        console.log("Room Name",roomName)
        io.to(roomName).emit('private message', {
            sender: socket.username,
            text: data.text
        });
    });

});


server.listen(3000, () => {
    console.log("Server Started on : 3000");
})