const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');



const rooms = {};
const playerRoom = {}; // ✅ เพิ่มบรรทัดนี้เพื่อจดว่า "ใครอยู่ห้องไหน"
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '../public/index.html')); });

function generateRoomID() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    const newRoomId = generateRoomID(); 
    
    const transport = socket.conn.transport.name; // 'websocket' หรือ 'polling'
    console.log(`NEW CONNECTION: ${socket.id} (Type: ${transport})`);

    socket.on('create-room', (data) => {
    
        playerRoom[socket.id] = newRoomId;
        socket.join(newRoomId);
        rooms[newRoomId] = {
            players: {
                [socket.id]: { pNumber: 1, name: "Player 1", ready: false }
            }
        };
    
    // ✅ Server ทำหน้าที่แค่ "ส่งจดหมาย" บอก Client ว่าสร้างห้องสำเร็จแล้ว
    socket.emit('room-created', { roomId: newRoomId });
    });

    socket.on('join-room', (roomId) => {
        const room = rooms[roomId];

        // 1. เช็คว่ามีห้องนี้ในระบบไหม
        if (!room) {
            socket.emit('error-message', '❌ ไม่พบรหัสห้องนี้ในระบบครับ');
            return;
        }
        // 2. เช็คว่าห้องเต็มหรือยัง (ถ้ามี 2 คนแล้วเข้าไม่ได้)
        const playerCount = Object.keys(room.players).length;
        if (playerCount >= 2) {
            socket.emit('error-message', '⚠️ ห้องนี้เต็มแล้วครับ');
            return;
        }

        // 3. ถ้าผ่านเงื่อนไข ให้เข้าห้องได้ตามปกติ
        socket.join(roomId);
        playerRoom[socket.id] = roomId;
        
        rooms[roomId].players[socket.id] = { 
            pNumber: 2, 
            name: "Player 2", 
            ready: false 
        };

        socket.emit('room-joined-success', { roomId: roomId, myNumber: 2 });
        io.to(roomId).emit('update-lobby', { players: rooms[roomId].players });
        
        console.log(`👤 P2 เข้าห้อง ${roomId} สำเร็จ`);
    });

    socket.on('player-ready', (data) => {
        const { roomId, pNumber, ready, name } = data;

        const currentRoom = rooms[roomId];
        const playersArray = Object.values(currentRoom.players);

        
        if (rooms[roomId] && rooms[roomId].players) {
            // ✅ 1. สั่งให้ Server จำค่าที่ผู้เล่นส่งมาลงในตัวแปร rooms
            // เราจะหาว่า socket.id ไหนที่มี pNumber ตรงกับที่ส่งมา
            Object.keys(rooms[roomId].players).forEach(id => {
                if (rooms[roomId].players[id].pNumber === pNumber) {
                    rooms[roomId].players[id].ready = ready; // บันทึกค่าจริงลงไป
                    rooms[roomId].players[id].name = name; // ✅ บันทึกชื่อใหม่ลงถังข้อมูล
                }
            });
            
            // ✅ 2. พอจำค่าใหม่แล้ว ค่อยตะโกนบอกทุกคนในห้อง
            io.to(roomId).emit('update-lobby', {
                players: rooms[roomId].players
            });

            // 3. เตรียมชื่อ P1 และ P2 เพื่อส่งให้หน้าจอ Game (เพิ่มตรงนี้)
            const playersArray = Object.values(currentRoom.players);
            let n1 = "Player 1", n2 = "Player 2";
            
            playersArray.forEach(p => {
                if (p.pNumber === 1) n1 = p.name || "Player 1";
                if (p.pNumber === 2) n2 = p.name || "Player 2";
            });

            // ✅ ส่ง Event 'set-game-names' ให้ตรงกับที่เขียนไว้ใน game.js
            io.to(roomId).emit('set-game-names', {
                p1Name: n1,
                p2Name: n2
            });
            // ถ้ามี 2 คน และทุกคน ready === true
            if (playersArray.length === 2 && playersArray.every(p => p.ready === true)) {
                console.log(`⏰ ห้อง ${roomId} พร้อมแล้ว! สั่งนับถอยหลัง`);
                io.to(roomId).emit('start-countdown-signal'); 
            }
            
            console.log(`✅ บันทึกสถานะ P${pNumber} เป็น ${ready} และส่งอัปเดตแล้ว`);
        }
    });

    socket.on('move', (data) => {
        socket.to(data.roomId).emit('update-move', { y: data.y });
    });

    socket.on('shoot', (data) => {
        socket.to(data.roomId).emit('update-shoot', data.bullet);
    });

    socket.on('update-hp', (data) => {
        io.to(data.roomId).emit('update-opponent-hp', data);
    });
    // server.js
socket.on('disconnect', () => {
    // 1. หาเลขห้องจากสมุดจด (ใช้ชื่อตัวแปร 'room' ตามที่ลีโอตั้งไว้บรรทัดบน)
        const room = playerRoom[socket.id]; 
        
        if (room) {
            // 2. บอกคนที่เหลือในห้อง
            socket.to(room).emit('player-left'); 
            
            // 3. ลบชื่อเราออกจากสมุดจด
            delete playerRoom[socket.id];

            // 4. เช็คว่าห้องนั้นยังอยู่ในระบบไหม และเหลือคนไหม
            if (rooms[room]) {
                // ลบ player นี้ออกจากห้องในฐานข้อมูลหลัก
                delete rooms[room].players[socket.id];

                // 5. ถ้าห้องว่างเปล่าจริงๆ ให้ลบห้องทิ้ง (ใช้ 'room' ไม่ใช่ 'roomId')
                if (Object.keys(rooms[room].players).length === 0) {
                    delete rooms[room];
                    console.log(`🗑️ ลบห้อง ${room} เนื่องจากไม่มีคนอยู่แล้ว`);
                }
            }
        }
        console.log(`🔌 DISCONNECTED: ${socket.id}`);
    });
});

// ค้นหาบรรทัดที่สั่ง http.listen หรือ server.listen
const PORT = process.env.PORT || 3000; 

http.listen(PORT, () => {
    console.log(`🚀 Server is flying on port ${PORT}`);
});
