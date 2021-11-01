require('dotenv').config();
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io")

const io = socket(server, {
    cors: {
      origin: "https://limedrawio.herokuapp.com/",
      methods: ["GET", "POST"]
    }});


const users = {}; // all the users
const userSnapshot ={}
const socketToRoom = {};
const drawers = {}; // all the current drawers
const words = {}; // all the current draw words
const starts = {}


io.on('connection', socket => {

    socket.on("sending signal", payload => {
        io.to(payload.userToSignal).emit('user joined', { signal: payload.signal, callerID: payload.callerID });
    });

    socket.on("returning signal", payload => {
        io.to(payload.callerID).emit('receiving returned signal', { signal: payload.signal, id: socket.id });
    });

    socket.on('add answer', obj => {
        io.emit("add answer replied", {roomID: obj.roomID, answer: obj.answer});
    });
    
    socket.on('join room', obj => {
        io.emit("welcome", {roomID: obj.roomID, user: obj.user});
        
        if (users[obj.roomID]) {
            const length = users[obj.roomID].length;

            if (length === 6) {
                socket.emit("room full");
                return;
            }

            users[obj.roomID].push({id: socket.id, user: obj.user});
            starts[obj.roomID].push({id: socket.id, start: true});
            userSnapshot[obj.roomID].push({id: socket.id, user: obj.user});

        } else {
            userSnapshot[obj.roomID] = [{id: socket.id, user: obj.user}];
            starts[obj.roomID]=[{id: socket.id, start: true}];
            users[obj.roomID] = [{id: socket.id, user: obj.user}];
        }

        socketToRoom[socket.id] = obj.roomID;

        io.emit("all users", {roomID: obj.roomID, usersInThisRoom: users[obj.roomID], userSnapshot:  userSnapshot[obj.roomID]});
        const usersExcludeinRoom = users[obj.roomID].filter(obj => obj.id !== socket.id);
        
        // socket.broadcast.emit('user-connected', {roomID: obj.roomID, user: socket.id})
        io.emit("peers",  {roomID: obj.roomID, user: users[obj.roomID]});
    });

    socket.on("canvas-data", data =>{
        socket.broadcast.emit("canvas-data", data)
    })

    socket.on("jumpscare", roomID =>{
        socket.broadcast.emit("jumpscare", roomID)
    })

    socket.on("add point", data =>{
        users[data.roomID] = data.user;
        if(data.user[0].user.points >= 100){
            
            starts[data.roomID].forEach(function(part, index) {
                part.start = false;
              });
            io.emit("game over", data )
        }
        socket.broadcast.emit("add point", data)
    })

    socket.on("start", data =>{
        drawers[data.roomID] = data.user;
        var idx = starts[data.roomID].findIndex((obj => obj.start == false));
        if(idx !== -1){
            socket.emit("not ready", data)
        } else {
            socket.broadcast.emit("start", data)
        }
    })

    socket.on("draw", data =>{
        words[data.roomID] = data.word;
        socket.broadcast.emit("draw", data)
    })

    socket.on("skip", roomID =>{
        socket.broadcast.emit("skip", roomID)
    })

    socket.on("next drawer", data =>{
         io.emit("next drawer", data)
    })

    socket.on("playagain", data =>{
        idx = starts[data.roomID].findIndex((obj => obj.id == data.id));
        starts[data.roomID][idx].start = true
        io.emit("playagain", {roomID : data.roomID, snapshot : userSnapshot[data.roomID]})

   })


    socket.on('disconnect', () => {
        const roomID = socketToRoom[socket.id];
        let room = users[roomID];
        let snapshots = userSnapshot[roomID]
        let start = starts[roomID]
        if (room) {
            var activeUser = room
            var self = room
            activeUser = activeUser.filter(obj => obj.id !== socket.id);
            self = self.filter(obj => obj.id == socket.id);
            users[roomID] = activeUser;
            snapshots = snapshots.filter(obj => obj.id !== socket.id)
            userSnapshot[roomID] = snapshots
            start = start.filter(obj => obj.id !== socket.id)
            starts[roomID] = start
            socket.broadcast.emit("disconnected", {roomID: roomID, usersInThisRoom: activeUser, userdisconnect : self, snapShots: snapshots});
            // socket.broadcast.emit("peers", activeUser );
        }
    });

    

    

    // socket.emit('welcome', 'Welcome to the party!')
    // socket.broadcast.emit('welcome', 'usera has joined the party')

});

server.listen(process.env.PORT || 5000, () => console.log('server is running on port 5000'));


