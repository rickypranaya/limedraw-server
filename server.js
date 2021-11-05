require('dotenv').config();
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io")
const cors = require('cors')
app.use(express.json());
app.use(cors())

const io = socket(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }});


const rooms = {}; // all the rooms
const userSnapshot ={}
const socketToRoom = {};
const drawers = {}; // all the current drawers
const words = {}; // all the current draw words
const starts = {}
const answers = {}

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

    socket.on('checkroom', ()=>{
        
    })
    
    socket.on('join room', obj => {

        if (rooms[obj.roomID]) {
            if (rooms[obj.roomID].isStarting){
                socket.emit("room started");
                return;
            }
            const length = rooms[obj.roomID].users.length;

            if (length === 6) {
                socket.emit("room full");
                return;
            }

            rooms[obj.roomID].users.push({id: socket.id, user: obj.user});
            starts[obj.roomID].push({id: socket.id, start: true});
            userSnapshot[obj.roomID].push({id: socket.id, user: obj.user});

        } else {
            userSnapshot[obj.roomID] = [{id: socket.id, user: obj.user}];
            starts[obj.roomID]=[{id: socket.id, start: true}];
            rooms[obj.roomID] = {type: obj.roomType, isStarting: false, users :[{id: socket.id, user: obj.user}]};
            
        }

        socketToRoom[socket.id] = obj.roomID;
        io.emit("welcome", {roomID: obj.roomID, user: obj.user});
        io.emit("all users", {roomID: obj.roomID, usersInThisRoom: rooms[obj.roomID].users, userSnapshot:  userSnapshot[obj.roomID]});
        const usersExcludeinRoom = rooms[obj.roomID].users.filter(obj => obj.id !== socket.id);
        
        // socket.broadcast.emit('user-connected', {roomID: obj.roomID, user: socket.id})
        io.emit("peers",  {roomID: obj.roomID, user: rooms[obj.roomID].users});
    });

    socket.on("canvas-data", data =>{
        socket.broadcast.emit("canvas-data", data)
    })

    socket.on("jumpscare", roomID =>{
        socket.broadcast.emit("jumpscare", roomID)
    })

    socket.on("add point", data =>{
        rooms[data.roomID].users = data.user;

        if (answers[data.roomID]){
            answers[data.roomID].push(data.id)
        } else {
            answers[data.roomID] = [data.id]
        }

        if(answers[data.roomID].length === rooms[data.roomID].users.length - 1){
            answers[data.roomID] = []
            io.emit("all answer", data.roomID)
        }

        if(data.user[0].user.points >= 100){
            
            starts[data.roomID].forEach(function(part, index) {
                part.start = false;
              });
              rooms[data.roomID].isStarting = false
            io.emit("game over", data )
        }
        socket.broadcast.emit("add point", data)
    })

    socket.on("minus point", data =>{
        rooms[data.roomID].users = data.user;
        socket.broadcast.emit("minus point", data)
    })

    socket.on("start", data =>{
        drawers[data.roomID] = data.user;
        var idx = starts[data.roomID].findIndex((obj => obj.start == false));
        if(idx !== -1){
            socket.emit("not ready", data)
        } else {
            rooms[data.roomID].isStarting = true
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
        socket.emit("playagain", {roomID : data.roomID, snapshot : userSnapshot[data.roomID]})

   })

   socket.on("updateRef",data=>{
    socket.emit("updateRef", data)
    })

   socket.on("mute", data=>{
    var idx = rooms[data.roomID].users.findIndex((obj => obj.id == data.id));
    if(idx>-1){
        rooms[data.roomID].users[idx].user.mute = true
    }

    socket.broadcast.emit("mute", data)
    
    
   })

   socket.on("unmute", data=>{
    var idx = rooms[data.roomID].users.findIndex((obj => obj.id == data.id));
    if(idx>-1){
        rooms[data.roomID].users[idx].user.mute = false
    }

    socket.broadcast.emit("unmute", data)
   })

   socket.on('logout', ()=>{
    const roomID = socketToRoom[socket.id];
    let room = rooms[roomID];
    let snapshots = userSnapshot[roomID]
    let start = starts[roomID]
    let answer = answers[roomID]
    if (room) {
        var activeUser = room.users
        var self = room.users
        activeUser = activeUser.filter(obj => obj.id !== socket.id);
        self = self.filter(obj => obj.id == socket.id);
        rooms[roomID].users = activeUser;

        if (activeUser.length < 1){
            delete rooms[roomID]
        }

        snapshots = snapshots.filter(obj => obj.id !== socket.id)
        userSnapshot[roomID] = snapshots
        start = start.filter(obj => obj.id !== socket.id)
        if (answer)  {
            answer= answer.filter(obj => obj !== socket.id)
            answers[roomID] = answer
        }
        starts[roomID] = start
        socket.broadcast.emit("disconnected", {roomID: roomID, usersInThisRoom: activeUser, userdisconnect : self, snapShots: snapshots});
        // socket.broadcast.emit("peers", activeUser );
        }
    });


    socket.on('disconnect', () => {
        const roomID = socketToRoom[socket.id];
        let room = rooms[roomID];
        let snapshots = userSnapshot[roomID]
        let start = starts[roomID]
        let answer = answers[roomID]
        if (room) {
            var activeUser = room.users
            var self = room.users
            activeUser = activeUser.filter(obj => obj.id !== socket.id);
            self = self.filter(obj => obj.id == socket.id);
            rooms[roomID].users = activeUser;

            if (activeUser.length < 1){
                delete rooms[roomID]
            }

            snapshots = snapshots.filter(obj => obj.id !== socket.id)
            userSnapshot[roomID] = snapshots
            start = start.filter(obj => obj.id !== socket.id)
            if (answer)  {
                answer= answer.filter(obj => obj !== socket.id)
                answers[roomID] = answer
            }
            starts[roomID] = start
            socket.broadcast.emit("disconnected", {roomID: roomID, usersInThisRoom: activeUser, userdisconnect : self, snapShots: snapshots});
            // socket.broadcast.emit("peers", activeUser );
        }
    });

    

    

    // socket.emit('welcome', 'Welcome to the party!')
    // socket.broadcast.emit('welcome', 'usera has joined the party')

});


app.post("/available-group",async (req,res, next)=>{
    var roomidTemp = req.body.roomID
    var availRoom = Object.keys(rooms)
                       .filter(roomid => rooms[roomid].type === 'public' && rooms[roomid].users.length <=5 && !rooms[roomid].isStarting)
                       .map(roomid => roomid);
    
    if (availRoom.length !== 0){
        roomidTemp = availRoom[0]
    }

    try{
        res.send(roomidTemp);

    }catch(e){
        console.log(e)
        res.sendStatus(500);
    }
});

server.listen(process.env.PORT || 5000, () => console.log('server is running on port 5000'));
