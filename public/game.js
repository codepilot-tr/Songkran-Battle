let socket = io();
let myPlayerNumber = 0; 
let roomId = ''; 
let myY = 150;
let opponentY = 150; 
let isP1 = true; 
let bullets = []; 
let myHP = 100;
let opponentHP = 100;
let isGameOver = false;
let p1Ready = false;
let p2Ready = false;
let countdownActive = false;
let frameCount = 0; // ประกาศไว้นอกฟังก์ชัน
let lastPlayerCount = 0;
let hasAlertedP2 = false;

let myAmmo = 10;
const maxAmmo = 10;
let ammoRegenTimer = null;
let mobileControls = { up: false, down: false };
const moveSpeed = 6; // ปรับตัวเลขนี้เพื่อให้ความเร็วพอดี (5-7 กำลังสวย)

// ดึงปุ่มมาสร้าง Event
const p1Btn = document.getElementById('p1-ready-btn');
const p2Btn = document.getElementById('p2-ready-btn');

const canvas = document.getElementById('gameCanvas');
canvas.width = 800;  // กำหนดขนาดให้แน่นอนใน JS
canvas.height = 450;
// ดึงปุ่มและหน้าต่างมาใช้งาน
const helpBtn = document.querySelector('.btn-help');
const helpModal = document.getElementById('help-modal');
const closeBtn = document.querySelector('.close-help');

// คลิกเปิด
helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'block';
});

// คลิกปิด (ที่ปุ่ม X)
closeBtn.addEventListener('click', () => {
    helpModal.style.display = 'none';
});

// คลิกปิด (เมื่อคลิกข้างนอกหน้าต่าง)
window.addEventListener('click', (event) => {
    if (event.target == helpModal) {
        helpModal.style.display = 'none';
    }
});

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2; // ขนาดสุ่ม
        this.speedX = (Math.random() - 0.5) * 10; // กระจายซ้ายขวา
        this.speedY = (Math.random() - 0.5) * 10; // กระจายบนล่าง
        this.life = 1.0; // ค่าความโปร่งใส (ค่อยๆ จาง)
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.05; // จางลงเรื่อยๆ
    }
    draw(ctx) {
        ctx.fillStyle = `rgba(173, 216, 230, ${this.life})`; // สีฟ้าน้ำแข็งจางๆ
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

let particles = []; // ถังเก็บจุดน้ำ

if (!canvas) {
    console.error("❌ หา Canvas ไม่เจอในหน้าเว็บ!");
}
const ctx = canvas ? canvas.getContext('2d') : null;

document.getElementById('createRoomBtn').addEventListener('click', () => {
    console.log("🖱️ ปุ่มถูกกด 1 ครั้ง (ของจริง!)");
    
    // 1. ดึงชื่อผู้เล่น
    const nameField = document.getElementById('nameInput'); 
    const playerName = nameField ? nameField.value : "Player " + Math.floor(Math.random() * 1000);

    // 2. ส่งคำสั่งไปหา Server (ให้ Server เป็นคนคิดเลขห้อง)
    console.log("📡 ส่งคำสั่งสร้างห้องไปยัง Server...");
    socket.emit('create-room', { name: playerName });
    
    // ⚠️ ห้ามสั่ง showScene หรือสุ่ม roomId เองตรงนี้ 
    // เพราะเราจะรอให้ Server ตอบกลับมาใน socket.on('room-created') แทน
});

// รอรับเลขห้องที่ Server ส่งกลับมา
socket.on('room-created', (data) => {
    myPlayerNumber = 1;
    roomId = data.roomId;
    isP1 = true;

    console.log("[CREATE] ได้เลขห้องจาก Server:", data.roomId);
    
    const displayRoomId = document.getElementById('displayRoomId');
    if (displayRoomId) displayRoomId.innerText = `ROOM: ${roomId}`;
    // ย้ายไปหน้า Lobby
    showScene('lobby-scene');

    setupLobbyUI();
});

socket.on('update-lobby', (data) => {
    console.log("👥 ข้อมูล Lobby ล่าสุด:", data.players);
    
    // --- ส่วนใหม่: เช็คการเข้าห้องแบบแม่นยำ ---
    const playerIds = Object.keys(data.players);
    const playerCount = playerIds.length;

    // ถ้าเราเป็น P1 และในห้องมี 2 คน และเรายังไม่เคยแจ้งเตือนในรอบนี้
    if (isP1 && playerCount === 2 && !hasAlertedP2) {
        const toast = document.getElementById('join-toast');
        if (toast) {
            console.log("🎯 [ACTION] กำลังโชว์แจ้งเตือน P2 เข้าห้อง...");
            
            // ใช้คำสั่งที่แรงที่สุดเพื่อให้มั่นใจว่ามันจะโผล่มา
            toast.style.setProperty('display', 'block', 'important');
            toast.style.opacity = '1';

            hasAlertedP2 = true; // ล็อคไว้ไม่ให้เด้งซ้ำตอนกด Ready

            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => { 
                    toast.style.display = 'none'; 
                }, 500);
            }, 1000);
        } else {
            console.error("❌ [ERROR] หา Element #join-toast ไม่เจอใน HTML!");
        }
    }

    // ถ้าคนเหลือน้อยกว่า 2 (เพื่อนออก) ให้รีเซ็ตตัวล็อค เผื่อคนใหม่เข้ามา
    if (playerCount < 2) {
        hasAlertedP2 = false;
    }

    // ล้างค่าเก่าก่อนเช็คใหม่
    p1Ready = false;
    p2Ready = false;

    // 2. วนลูปเพื่ออัปเดตผู้เล่นทุกคน (ใช้ข้อมูลจาก 'p' ที่แม่นยำที่สุด)
    Object.values(data.players).forEach(p => {
        // ดึงค่าจากตัวแปร p (ซึ่งมาจาก data.players)
        // ถ้า server ส่งชื่อไหนมา ลีโอเช็คตรงนี้ให้ตรงกับ server.js นะครับ
        let pNum = p.pNumber;
        let pName = p.name || p.playerName || "Unknown";
        let pReady = (p.ready !== undefined) ? p.ready : p.isReady;

        console.log(`🔍 แปลงข้อมูลได้เป็น: P${pNum}, Ready: ${pReady}`);

        // ส่งเข้า UI แค่รอบเดียวในลูปนี้พอครับ
        updatePlayerUI(pNum, pName, pReady);

        // เก็บสถานะไว้เช็คเริ่มเกม
        if (pNum === 1) p1Ready = pReady;
        if (pNum === 2) p2Ready = pReady;
    });

    checkAllReady();
});

// 3. เมื่อกดปุ่ม "เข้าห้อง" (กรณีเพื่อนพิมพ์เลขมาจอย)
document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const inputVal = document.getElementById('roomInput').value;
    const isNumeric = /^\d+$/.test(inputVal);
    
    if (inputVal.length === 4 && isNumeric) {
        roomId = inputVal;
        console.log(`🔍 กำลังตรวจสอบห้อง: ${roomId}`);
        socket.emit('join-room', roomId);
    } else {
        // ✅ เปลี่ยนจาก alert เป็นการเรียกฟังก์ชันโชว์ Modal
        showErrorModal("กรุณากรอกรหัสห้องให้ครบ 4 หลักครับ!");
    }
        // ✅ เพิ่ม Event รอรับข้อความ "ไม่พบห้อง" จาก Server
    socket.on('error-message', (msg) => {
        showErrorModal(msg);
    });
});

// ✅ ฟังก์ชันสำหรับแสดง Modal แจ้งเตือน
function showErrorModal(message) {
    const modal = document.getElementById('error-modal');
    const text = document.getElementById('error-message-text');
    // เช็คว่า message มีค่าจริงๆ ไม่ใช่ค่าว่าง, null หรือ undefined
    if (!message || message.trim() === "") return;

    if (modal && text) {
        text.innerText = message;
        modal.style.display = 'block';
    }
}

// 4. ฟังก์ชันส่งคำขอเข้าห้องไปที่ Server
function startGame() {
    socket = io("http://localhost:3000")
    socket.emit('join-room', roomId);
    console.log("📡 [SYSTEM] เชื่อมต่อสำเร็จ!");
}
function getPlayerNames() {
    const p1Input = document.getElementById('p1-name-input').value.trim();
    const p2Input = document.getElementById('p2-name-input').value.trim();

    // ดักไว้ว่าถ้าไม่ใส่ให้ขึ้น Player 1 / Player 2
    const p1Name = p1Input || "Player 1";
    const p2Name = p2Input || "Player 2";

    return { p1Name, p2Name };
}
socket.on('update-room-info', (data) => {
    // data ควรจะมีข้อมูลชื่อที่ส่งมาจาก Lobby
    const name1 = data.p1Name || "Player 1";
    const name2 = data.p2Name || "Player 2";

    // อัปเดตลงในหน้า Game Scene
    const p1Display = document.querySelector('.p1-name-take');
    const p2Display = document.querySelector('.p2-name-take');

    if (p1Display) p1Display.innerText = name1;
    if (p2Display) p2Display.innerText = name2;
});

function sendReady() {
    // 1. ดึงชื่อจาก input ตาม id ที่ลีโอตั้งไว้
    const p1Input = document.getElementById('p1-name-input').value.trim();
    const p2Input = document.getElementById('p2-name-input').value.trim();

    // 2. เลือกชื่อตาม Player Number ของเรา (ถ้าไม่ใส่ให้เป็น Player 1/2)
    let myName = "";
    if (isP1) {
        myName = p1Input || "Player 1";
    } else {
        myName = p2Input || "Player 2";
    }

    // 3. ส่งไปให้ Server
    socket.emit('player-ready', {
        roomId: roomId,
        pNumber: myPlayerNumber,
        ready: true,
        name: myName // ✅ ส่งชื่อนี้ไปให้ server.js รับไปเก็บ
    });
}

socket.on('connect', () => {
    console.log("🌐 เชื่อมต่อกับ Server สำเร็จแล้ว!");
});

socket.on('room-joined-success', (data) => {
    console.log("📩 [P2] Server ยืนยันการเข้าห้องสำเร็จ:", data);

    roomId = data.roomId;
    myPlayerNumber = data.myNumber;
    isP1 = (data.myNumber === 1);       // เราไม่ใช่ P1

    console.log(`🆔 ตัวตนยืนยันแล้ว: คุณคือ P${myPlayerNumber}`)

    document.querySelectorAll('.room-info, #displayRoomId').forEach(el => {
        el.innerText = `ROOM: ${roomId}`;
    });
    
    // 2. เอาเลขไปโชว์ที่ ROOM: ----
    const displayRoomId = document.getElementById('displayRoomId');
    if (displayRoomId) {
        displayRoomId.innerText = roomId;
    }
    console.log(`✅ [JOIN] เข้าห้องสำเร็จ: ${roomId} | คุณคือ P${myPlayerNumber}`); // บรรทัดนี้จะบอกว่าเป็น P2
    showScene('lobby-scene');
    setupLobbyUI();
});

    // --- 1. Socket Events ---
socket.on('connect', () => {
    socket.emit('join-room', roomId);
    
});


// ใน socket.on('player-assigned', (num) => { ... })
socket.on('player-assigned', (num) => {
    myPlayerNumber = num;
    isP1 = (num === 1);
    
    console.log(`%c คุณเข้าห้องในฐานะ: P${num}`, "background: #222; color: #bada55; padding: 5px;");

    // ถ้าเป็น P2 ให้ขยับตัวไปฝั่งขวาทันที
    if (num === 2) {
        myY = 150; // พิกัดเริ่มกลางจอ
        // แจ้งเตือนบนหน้าจอว่า "เชื่อมต่อสำเร็จ"
        document.getElementById('statusText').innerText = "เชื่อมต่อสำเร็จ! คุณคือผู้เล่นคนที่ 2";
    } else {
        document.getElementById('statusText').innerText = "สร้างห้องสำเร็จ! รอเพื่อนเข้าห้อง...";
    }
});
// เมื่อมีคนอื่นเข้ามาในห้อง (สำหรับ P1 เป็นคนฟัง)
socket.on('player-joined', (data) => {
    console.log("👥 มีผู้เล่นใหม่เข้ามา!");
    
    // ✅ เพิ่มส่วนนี้เข้าไปครับ
    const toast = document.getElementById('join-toast');
    if (toast) {
        toast.style.setProperty('display', 'block', 'important');
        toast.style.opacity = '1';

        // ตั้งเวลา 2 วินาทีให้หายไปเอง
        setTimeout(() => {
            toast.style.opacity = '0';
            // รอให้จางเสร็จค่อยใส่ display: none
            setTimeout(() => {
                toast.style.display = 'none';
            }, 500);
        }, 2000);
    }

    const p2Card = document.getElementById('p2-ready-btn');
    if (p2Card) {
        // 1. เปลี่ยนสีให้ชัดเจน
        p2Card.classList.remove('player-slot-empty');
        p2Card.classList.add('player-slot-active-p2');
        
        // 2. เคลียร์ตัวหนังสือออกตามที่ลีโอต้องการ
        p2Card.innerText = ""; 
        
        // (แถม) ถ้าอยากให้ P1 รู้ตัวจริงๆ ให้ทำหน้าจอสั่นนิดนึงก็ได้
        p2Card.style.animation = "popIn 0.3s ease-out";
    }
});
// ระบบเพื่อนหลุด
socket.on('player-left', () => {
    // ✅ เงื่อนไข: จะโชว์แจ้งเตือน "เพื่อนหลุด" ก็ต่อเมื่อ 
    // 1. ยังอยู่ในห้อง (roomId มีค่า)
    // 2. เกมยังไม่จบ (isGameOver ต้องเป็น false)
    
    if (roomId && !isGameOver) { 
        console.warn("⚠️ เพื่อนหลุดระหว่างการแข่งขัน");
        
        const overlay = document.getElementById('disconnectOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    } else {
        // ถ้า isGameOver เป็น true อยู่แล้ว (คือมีคนแพ้/ชนะไปแล้ว) 
        // หรือไม่มี roomId แล้ว ให้เงียบไว้ ไม่ต้องโชว์อะไร
        console.log("ℹ️ เพื่อนกดออกจากหน้าสรุปผล (ปกติ)");
    }
});

socket.on('update-move', (data) => {
    opponentY = data.y;
});

socket.on('update-opponent-hp', (data) => {
    // data.pNumber คือเลขของผู้เล่นที่ "เลือดลด"
    
    if (data.pNumber === myPlayerNumber) {
        // ✅ ถ้าเลขที่ส่งมาตรงกับเรา แปลว่าเราคือคนโดนยิงจริงๆ
        myHP = data.hp; 
        updateAmmoUI(); // อัปเดต UI เลือดฝั่งเรา
        if (myHP <= 0) {
            showResult('lose'); // เราเลือดหมด เราแพ้
        }
    } else {
        // ✅ ถ้าเลขไม่ตรงกับเรา แปลว่า "ศัตรู" ต่างหากที่เลือดลด
        opponentHP = data.hp;
        // (วาด Effect น้ำกระจายที่จอเรา เพราะเราเป็นคนยิงโดนเขา)
        // ✅ เพิ่มเช็คตรงนี้ครับ: ถ้าเลือดศัตรูที่เราเพิ่งยิงไปมันหมด
        if (opponentHP <= 0) {
            showResult('win'); // เราชนะแล้ว!
        }
        if (data.hitX && data.hitY) {
            createWaterSplash(data.hitX, data.hitY);
            triggerHitEffect();
        }
    }
    // // ✅ ลบเฉพาะนัดที่ตรงกับพิกัดที่ส่งมา
    // bullets = bullets.filter(b => {
    //     const isHit = Math.abs(b.x - data.hitX) < 15 && Math.abs(b.y - data.hitY) < 15;
    //     return !isHit;
    // });
});

socket.on('update-shoot', (bulletData) => {
    bullets.push(bulletData);
});
socket.on('set-game-names', (data) => {
    console.log("🚀 ได้รับชื่อผู้เล่นมาแล้ว:", data);

    // ดึง span ที่ลีโอสร้างไว้มาใส่ชื่อ
    const p1NameSpan = document.querySelector('.p1-name-take');
    const p2NameSpan = document.querySelector('.p2-name-take');

    if (p1NameSpan) p1NameSpan.innerText = data.p1Name;
    if (p2NameSpan) p2NameSpan.innerText = data.p2Name;
});

// ฟังก์ชันสำหรับตั้งค่าเมื่อเข้า Lobby
function setupLobbyUI() {
    console.log("🆔 ตรวจสอบตัวตน - คุณคือ PNumber:", myPlayerNumber, "ประเภท:", typeof myPlayerNumber);
    console.log(`🛠️ [UI] ตั้งค่าหน้า Lobby สำหรับคุณคือ P${myPlayerNumber}`);
    
    const roomIdElement = document.getElementById('displayRoomId');
    if (roomIdElement) roomIdElement.innerText = roomId;

    [1, 2].forEach((pNum) => {
        const btn = document.getElementById(`p${pNum}-ready-btn`);
        const input = document.getElementById(`p${pNum}-name-input`);
        
        if (btn) {
            // เช็คให้ขาด: เราคือ P อะไร และนี่คือปุ่มของ P อะไร
            const isMe = (Number(myPlayerNumber) === pNum); 
            
            btn.disabled = !isMe; // ถ้าไม่ใช่ปุ่มเรา ให้กดไม่ได้
            if (input) input.disabled = !isMe;
            btn.style.opacity = isMe ? "1" : "0.5";
            btn.style.pointerEvents = isMe ? "auto" : "none"; // ป้องกันการคลิกปุ่มคนอื่นแบบเด็ดขาด

                if (input && isMe) {
                    input.oninput = () => {
                        console.log(`📡 [P${myPlayerNumber}] กำลังอัปเดตชื่อเป็น: ${input.value}`);
                        
                        // ส่งข้อมูลไปหา Server โดยใช้โครงสร้างเดิมที่ Server รอรับ
                        socket.emit('player-ready', {
                            roomId: roomId,
                            pNumber: myPlayerNumber,
                            ready: (document.getElementById(`p${myPlayerNumber}-ready-btn`).dataset.ready === 'true'), // ใช้สถานะเดิม
                            name: input.value // ส่งชื่อใหม่ไป
                        });
                    };
                }

            btn.onclick = () => {
                if (!isMe) return;

                // สลับสถานะ (Toggle)
                const isCurrentlyReady = (btn.dataset.ready === 'true');
                const nextReadyState = !isCurrentlyReady;

                console.log(`📡 [P${pNum}] ส่งสถานะใหม่: ${nextReadyState}`);

                socket.emit('player-ready', {
                    roomId: roomId,
                    pNumber: myPlayerNumber,
                    ready: nextReadyState,
                    name: input ? input.value : `Player ${pNum}`
                });
            };
        }
    });
}

function moveMyPlayer(direction) {
    if (isGameOver || roomId === '') return;
    console.log(`🕹️ [STEP 1] มีการกดปุ่ม: ${direction}`); // <-- กับดักที่ 1

    if (direction === 'up') {
        myY -= 10;
        if (myY < 0) myY = 0;
    } else if (direction === 'down') {
        myY += 10;
        if (myY > canvas.height - 50) myY = canvas.height - 50;
    }

    // 📡 [หัวใจสำคัญ] ดักดูว่าเราส่งอะไรออกไป
    console.log(`📡 [STEP 2] กำลังส่ง Socket: room=${roomId}, y=${myY}`);
    // ส่งค่าที่เปลี่ยนไปให้เพื่อนในห้องรับรู้ทันที
    socket.emit('move', { roomId: roomId, y: myY });
}

function triggerHitEffect() {
    const scene = document.getElementById('game-scene');
    if (!scene) return;

    // 🌊 1. แวบสีฟ้าเบาๆ
    scene.style.backgroundColor = "rgba(173, 216, 230, 0.15)";
    
    // 📳 2. สั่นเบาๆ (Shake) - ลดองศาลงเหลือแค่ 1 องศา และสั่นแค่ 3px
    const offset = 3; 
    const angle = Math.random() * 2 - 1; // สั่นแค่ -1 ถึง 1 องศา
    
    // ใช้เครื่องหมาย ` เพื่อครอบ String
    scene.style.transform = `translate(calc(-50% + ${offset}px), calc(-50% + ${offset}px)) rotate(${angle}deg)`;

    setTimeout(() => {
        scene.style.backgroundColor = "transparent";
        scene.style.transform = "translate(-50%, -50%) rotate(0deg)";
    }, 80); // สั่นสั้นลงด้วย จะได้ดูคมๆ
}

function createWaterSplash(x, y) {
    for (let i = 0; i < 15; i++) { // สุ่มสร้าง 15 จุด
        particles.push(new Particle(x, y));
    }
}

function updatePlayerUI(pNum, name, isReady) {
    const btn = document.getElementById(`p${pNum}-ready-btn`);
    const statusText = document.getElementById(`p${pNum}-status`);
    const nameInput = document.getElementById(`p${pNum}-name-input`);

    if (!btn) return;

    if (btn) {
        btn.dataset.ready = isReady.toString();
        // ... (Logic เปลี่ยนสีปุ่มเดิมของลีโอ) ...
    }

    // ✅ อัปเดตชื่อในช่อง Input (ถ้าไม่ใช่ตัวเรา)
    if (nameInput && Number(pNum) !== Number(myPlayerNumber)) {
        nameInput.value = name || `Player ${pNum}`;
    }
    // อัปเดตสถานะ Dataset
    btn.dataset.ready = isReady;

    btn.dataset.ready = isReady.toString();
    // การแสดงผลตามสถานะ Ready
    if (isReady) {
        btn.classList.add('active');
        // ถ้าเป็นปุ่มของเรา ให้ขึ้นว่า "ยกเลิก" ถ้าปุ่มเพื่อน ให้ขึ้นว่า "พร้อมแล้ว"
        btn.innerText = (myPlayerNumber === pNum) ? "ยกเลิกพร้อม" : "พร้อมแล้ว";
        
        if (statusText) {
            statusText.innerText = "พร้อมแล้ว!";
            statusText.style.color = "#4caf50";
        }
    } else {
        btn.classList.remove('active');
        btn.innerText = "พร้อมแล้ว!";
        
        if (statusText) {
            statusText.innerText = "ยังไม่พร้อม";
            statusText.style.color = "#ff5722";
        }
    }
    console.log(`อัปเดตสถานะ P${pNum} เป็น: ${isReady}`);
}

function startMatchCountdown() {
    countdownActive = true;
    let count = 3;
    const overlay = document.getElementById('countdown-overlay');
    overlay.style.display = 'block';

    const timer = setInterval(() => {
        count--;
        overlay.innerText = count;
        
        if (count <= 0) {
            clearInterval(timer);
            overlay.style.display = 'none';
            showScene('game-scene'); // ไปหน้าเกม
        }
    }, 1000);
}

function showResult(status) {
    isGameOver = true;
    const overlay = document.getElementById('resultOverlay');
    const text = document.getElementById('resultText');
    
    overlay.style.display = 'flex'; // ใช้ CSS ที่เราเขียนแยกไว้ควบคุมต่อ
    
    if (status === 'win') {
        text.innerText = "ยินดีด้วย! คุณชนะแล้ว 🎉";
        text.style.color = "#4CAF50"; // สีเขียว
    } else {
        text.innerText = "เสียใจด้วย! คุณแพ้แล้ว 💀";
        text.style.color = "#f44336"; // สีแดง
    }
}

// --- [คนวาด] อัปเดตตัวเลขบนจอ ---
function updateAmmoUI() {
    const ammoValText = document.getElementById('my-ammo-val');
    const container = document.getElementById('my-ammo-container');
    
    if (ammoValText) {
        ammoValText.innerText = myAmmo;
        ammoValText.style.color = (myAmmo === 0) ? "#ff4757" : "#a2edff";
    }

    if (container) {
        if (isP1) {
            // ถ้าเป็น P1 ให้ชิดซ้าย
            container.style.left = "150px";
            container.style.right = "auto";
        } else {
            // ✅ ถ้าเป็น P2 (isP1 === false) ให้ชิดขวา
            container.style.right = "150px";
            container.style.left = "auto";
        }
    } else {
        console.warn("⚠️ หา #my-ammo-container ไม่เจอในหน้าเว็บ!");
    }
}

// ฟังก์ชันเริ่มฟื้นฟูกระสุน (เรียกใช้ตอนเริ่มเกม)
function startAmmoSystem() {
    myAmmo = maxAmmo; // Reset กระสุน
    updateAmmoUI();

    // 2. เคลียร์ Timer เก่าทิ้งทุกครั้ง (ป้องกันการเกิด Loop ซ้อน)
    if (ammoRegenTimer) {
        clearInterval(ammoRegenTimer);
        ammoRegenTimer = null;
    }
    
    // 3. เริ่มนับใหม่ วินาทีละ 1 นัด
    ammoRegenTimer = setInterval(() => {
        if (!isGameOver && myAmmo < maxAmmo) {
            myAmmo = Math.min(maxAmmo, myAmmo + 1); 
            updateAmmoUI();
            console.log("💧 กระสุนฟื้นฟูเป็น:", myAmmo); // ใส่ไว้เช็คใน Console
        }
    }, 1000);
}

// ปุ่ม Restart
document.getElementById('restartBtn').addEventListener('click', () => {
    console.log("🔄 Restarting game...");
    window.location.reload(); 
});

function setupMobileControls() {
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    const btnShoot = document.getElementById('btn-shoot'); // ดึงมาไว้ด้านบนด้วยกันเลย

    console.log("🔍 กำลังตรวจสอบปุ่ม...", { btnUp, btnDown, btnShoot });

    if (btnUp && btnDown && btnShoot) {
        // --- ฟังก์ชันช่วยผูก Event แบบพิเศษ ---
        const bindEvent = (el, actionFn, direction = null) => {
            ['touchstart', 'mousedown'].forEach(eventType => {
                el.addEventListener(eventType, (e) => {
                    e.preventDefault(); 
                    if (isGameOver) return; // ถ้าเกมจบ ไม่ต้องทำอะไร

                    if (direction) {
                        console.log(`🚀 [MOVE] ${direction}`);
                        moveMyPlayer(direction);
                    } else {
                        console.log(`💦 [SHOOT]`);
                        actionFn();
                    }
                }, { passive: false });
            });
        };

        // ผูกปุ่มเดิน
        bindEvent(btnUp, null, 'up');
        bindEvent(btnDown, null, 'down');
        
        // ผูกปุ่มยิง (เรียกฟังก์ชัน shootBullet โดยตรง)
        bindEvent(btnShoot, shootBullet);

        console.log("✅ ผูกคำสั่งปุ่ม iPad ทั้งหมดเรียบร้อย!");
    } else {
        console.error("❌ หาปุ่มไม่เจอ! เช็ค ID ใน HTML อีกครั้ง");
    }
}

function shootBullet() {
    const ammoText = document.getElementById('my-ammo-val');
    // 1. เช็คเงื่อนไขก่อนยิง
    if (isGameOver) return;

    // 2. ถ้ากระสุนหมดแล้วจริงๆ
    if (myAmmo <= 0) {
        if(ammoText) {
            // ทำให้ตัวหนังสือเป็นสีแดง (เผื่อกรณีมันยังไม่เป็น)
            ammoText.style.color = "red";
            // เอฟเฟกต์ขยายตัวเล็กน้อยเมื่อกดซ้ำตอนกระสุนหมด
            ammoText.style.display = "inline-block"; // มั่นใจว่าเป็น block เพื่อใช้ transform ได้
            ammoText.style.transition = "transform 0.1s";
            ammoText.style.transform = "scale(1.3)";
            setTimeout(() => ammoText.style.transform = "scale(1)", 100);
        }
        playEmptySound(); 
        console.log("🚫 กระสุนหมด!");
        return; // หยุดการยิงกระสุนจริง
    }

    // 3. ลดจำนวนกระสุนในเครื่องเรา
    myAmmo--;

    // 4. อัปเดต UI ทันทีหลังจากลดค่า
    if (ammoText) {
        ammoText.innerText = myAmmo; // แสดงเลข 0 ได้แน่นอน

        // ถ้าลดจนเหลือ 0 ให้เปลี่ยนเป็นสีแดงทันที
        if (myAmmo === 0) {
            ammoText.style.color = "red";
            ammoText.style.fontWeight = "bold";
        }
    }

    // 3. กำหนดจุดกำเนิดและทิศทางกระสุนตามฝั่งผู้เล่น
    const bulletX = isP1 ? 100 : 700; 
    const bulletSpeed = isP1 ? 7 : -7;
    
    const newBullet = { 
        x: bulletX, 
        y: myY + 25, // ปรับให้กระสุนออกตรงกลางตัวละคร
        speed: bulletSpeed, 
        owner: myPlayerNumber 
    };

    // 4. เพิ่มกระสุนเข้าอาเรย์เพื่อวาดบนจอ
    bullets.push(newBullet);

    // 5. ส่งข้อมูลบอก Server ให้เพื่อนเห็นกระสุน
    socket.emit('shoot', { 
        roomId: roomId, 
        bullet: newBullet 
    });

    console.log("💦 สาดน้ำออกไปแล้ว! กระสุนคงเหลือ:", myAmmo);
}
// --- 2. Input ---
window.addEventListener('keydown', (e) => {
    // ✅ 1. ถ้ากำลังพิมพ์ในช่อง Input (เช่น ใส่ชื่อ) ให้พิมพ์ได้ปกติ ไม่ต้องรันโค้ดเกม
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 

    // ✅ 1. ถ้าเกมจบแล้ว (isGameOver เป็น true) ไม่ต้องทำอะไรทั้งสิ้น
    if (isGameOver) return;
    if([" ", "w", "s", "W", "S", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();

    // ขยับ
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') moveMyPlayer('up');
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') moveMyPlayer('down');

    // ดักขอบบน-ล่าง (จอสูง 450 ตัวละครสูง 50)
    if (myY < 0) myY = 0;
    if (myY > 400) myY = 400; 

    // ส่งพิกัด
    if (['w','s','W','S','ArrowUp','ArrowDown'].includes(e.key)) {
        socket.emit('move', { roomId: roomId, y: myY });
    }

    // ยิง (แก้ไขจากของเดิมที่มีอยู่)
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (myAmmo > 0) { // ✅ เช็คกระสุนก่อน
            myAmmo--;      // ✅ ลดกระสุนทันที
            updateAmmoUI(); // ✅ อัปเดตหน้าจอทันที

            const bullet = {
                x: isP1 ? 100 : 650, 
                y: myY + 20,         
                owner: myPlayerNumber,
                speed: isP1 ? 7 : -7 
            };
            bullets.push(bullet);
            socket.emit('shoot', { roomId: roomId, bullet: bullet });
        } else {
            // 🔊 เรียกใช้เสียงสังเคราะห์ที่สร้างไว้
            playEmptySound();

            // (Optional) ทำ Effect สั่นที่ตัวเลขกระสุนให้รู้ว่าหมดจริงๆ
            const ammoText = document.getElementById('my-ammo-val');
            if(ammoText) {
                ammoText.style.transform = "scale(1.2)";
                setTimeout(() => ammoText.style.transform = "scale(1)", 100);
            }
            console.log("🚫 กระสุนหมด!");
        }
    }
});

function drawPlayer(x, y, hp, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 50, 50);
    
    // แถบเลือด
    ctx.fillStyle = "red";
    ctx.fillRect(x, y - 20, 50, 5);
    ctx.fillStyle = "green";
    ctx.fillRect(x, y - 20, (hp / 100) * 50, 5);
    
    // ตัวเลขเลือด
    ctx.fillStyle = "black";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`HP: ${hp}`, x, y - 25);
}

// --- 3. Draw Loop ---
function draw() {
    if (!ctx) {
        console.error("❌ วิกฤต! หา Context ของ Canvas ไม่เจอ");
        return;
    }
    // ล้างจอ
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. ปรับเงื่อนไขการวาดให้ "ปลอดภัย"
    // ถ้ายังไม่มีเลขผู้เล่น หรือเลขห้องยังว่าง ให้โชว์ Loading
    if (!myPlayerNumber || myPlayerNumber === 0) {
        ctx.fillStyle = "black";
        ctx.font = "20px Arial";
        ctx.fillText("กำลังเชื่อมต่อ/รอข้อมูลจาก Server...", 10, 50);
    } else {
        let myX = isP1 ? 50 : 700;
        let oppX = isP1 ? 700 : 50;

        drawPlayer(myX, myY, myHP, isP1 ? 'blue' : 'red');
        drawPlayer(oppX, opponentY, opponentHP, isP1 ? 'red' : 'blue');

        // --- แสดงพิกัดเรียลไทม์ไว้ที่มุมจอ ---
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.font = "12px Monospace";
        // เช็คว่าถ้าเราเป็น P1 ข้อความ "MY" ต้องอยู่ซ้าย (10) "OPP" อยู่ขวา (680)
        // แต่ถ้าเราเป็น P2 ข้อความ "OPP" ต้องอยู่ซ้าย (10) "MY" อยู่ขวา (680)
        if (isP1) {
            ctx.fillText(`MY POS Y: ${myY}`, 10, 20);
            ctx.fillText(`OPP POS Y: ${opponentY}`, 680, 20);
        } else {
            ctx.fillText(`OPP POS Y: ${opponentY}`, 10, 20);
            ctx.fillText(`MY POS Y: ${myY}`, 680, 20);
        }

        // กระสุนและการเช็คชน
        if (!isGameOver) {
            
            for (let i = bullets.length - 1; i >= 0; i--) {
                let b = bullets[i];
                
                // 1. ขยับกระสุน
                b.x += b.speed;
                
                // 2. วาดกระสุน
                ctx.fillStyle = 'cyan';
                ctx.beginPath();
                ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
                ctx.fill();

                // 3. เช็คชน (ใช้ลอจิกเดิมของลีโอ)
                if (!isGameOver && b.owner !== myPlayerNumber) {
                    if (b.x > myX && b.x < myX + 50 && b.y > myY && b.y < myY + 50) {
                        myHP -= 10;
                        
                        // ✅ ลบกระสุน (ใช้ i แทน index)
                        bullets.splice(i, 1); 

                        // เรียก Effect
                        if (typeof createWaterSplash === 'function') createWaterSplash(b.x, b.y);
                        if (typeof triggerHitEffect === 'function') triggerHitEffect();

                        socket.emit('update-hp', { 
                            roomId: roomId, 
                            hp: myHP, 
                            pNumber: myPlayerNumber,
                            bulletIndex: i, // ส่ง i ไป
                            hitX: b.x,
                            hitY: b.y 
                        });

                        if (myHP <= 0) showResult('lose');
                        
                        continue; // ชนแล้วข้ามไปตรวจนัดถัดไปเลย
                    }
                }

                // 4. ลบกระสุนหลุดจอ
                if (b.x < 0 || b.x > canvas.width) {
                    bullets.splice(i, 1);
                }
            }
        }
        // ย้ายมาไว้ข้างล่างสุด เพื่อไม่ให้ Index ของมันไปกวนการลบกระสุน
        for (let j = particles.length - 1; j >= 0; j--) {
            let p = particles[j];
            p.update();
            p.draw(ctx);
            if (p.life <= 0) {
                particles.splice(j, 1);
            }
        }
    }
    requestAnimationFrame(draw); 
}

function showScene(sceneId) {
    // 1. หาหน้าจอทั้งหมดที่มี class="scene" แล้วซ่อนให้หมด
    const scenes = document.querySelectorAll('.scene');
    scenes.forEach(scene => {
        scene.style.display = 'none';
    });

    // 2. เปิดเฉพาะหน้าจอที่เราต้องการ (โดยระบุ ID)
    const targetScene = document.getElementById(sceneId);
    if (targetScene) { 
        // ถ้าเป็น game-scene ให้ใช้ flex เพื่อจัดตำแหน่ง แต่ถ้าหน้าอื่นใช้ block ก็ได้ครับ
        targetScene.style.display = (sceneId === 'game-scene') ? 'flex' : 'block';
        console.log(`🎬 [SCENE] เปลี่ยนหน้าจอไปที่: ${sceneId}`);
    } else {
        console.error(`❌ [ERROR] ไม่พบ ID หน้าจอ: ${sceneId}`);
    }

    // ✅ เพิ่มบรรทัดนี้เข้าไปในฟังก์ชัน showScene เลย
    if (sceneId === 'game-scene' || sceneId === 'lobby-scene') {
        const displayElement = document.getElementById('gameRoomDisplay');
        if (displayElement && roomId) {
            displayElement.innerText = `ROOM: ${roomId}`;
        }
        // draw();
    }
}

function checkAllReady() {
    // ตรวจสอบว่ามีตัวแปร p1Ready และ p2Ready หรือยัง (ถ้าไม่มีให้ประกาศไว้บนสุดของไฟล์ด้วย)
    if (typeof p1Ready !== 'undefined' && typeof p2Ready !== 'undefined') {
        if (p1Ready && p2Ready) {
            console.log("🎮 [GAME] พร้อมทั้งคู่แล้ว! กำลังจะเริ่มเกม...");
            // ลีโอสามารถเพิ่มคำสั่งเริ่มนับถอยหลังตรงนี้ได้ครับ เช่น startCountdown();
        }
    }
}
function applyPlayerTheme() {
    // ล้างสีเก่าออกก่อน
    document.body.classList.remove('is-p1', 'is-p2');

    if (myPlayerNumber === 1) {
        document.body.classList.add('is-p1');
        // ถ้าลีโอมีชื่อผู้เล่น อยากให้เน้นสีเขียวเฉพาะจุดก็ได้
        console.log("🎨 ย้อมหน้าจอเป็นธีม P1 (เขียว)");
    } else if (myPlayerNumber === 2) {
        document.body.classList.add('is-p2');
        console.log("🎨 ย้อมหน้าจอเป็นธีม P2 (ฟ้า)");
    }
}
socket.on('start-countdown-signal', () => {
    const overlay = document.getElementById('countdown-overlay');
    if (!overlay || countdownActive) return; // ถ้ากำลังนับอยู่ ไม่ต้องนับซ้อน

    countdownActive = true;
    overlay.style.display = 'block'; // แสดงตัวเลขขึ้นมา
    let count = 3;
    overlay.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            overlay.innerText = count;
        } else {
            clearInterval(timer);
            overlay.innerText = "เริ่ม!";
            
            // รออีกนิดนึงให้คนเห็นคำว่า "เริ่ม!" แล้วค่อยเข้าเกม
            setTimeout(() => {
                overlay.style.display = 'none';
                countdownActive = false;
                
                // เรียกใช้ฟังก์ชันเริ่มเกมที่มีอยู่เดิม (ลีโอน่าจะมี showScene('game-scene'))
                startGameLogic(); 
            }, 500);
        }
    }, 1000);
});

// ฟังก์ชันสร้างเสียงสังเคราะห์ "แกร๊ก" (Mechanical Click)
function playEmptySound() {
    // สร้างเครื่องเสียงจำลองในเบราว์เซอร์
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // ตั้งค่าเสียงให้มีความถี่ต่ำและสั้น (เหมือนเสียงกลไก)
    oscillator.type = 'square'; 
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); 
    
    // ตั้งค่าความดังให้ค่อยๆ หายไปอย่างรวดเร็ว (0.1 วินาที)
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function startGameLogic() {
    // 2. ถ้าลีโอมีคำสั่งเริ่มวาด Canvas หรือเริ่ม Loop เกม ให้ใส่ตรงนี้
    console.log("💦 [SYSTEM] กำลังเข้าสู่สมรภูมิสาดน้ำ!");
    showScene('game-scene');
    
    // เช็คค่าสำคัญก่อนเริ่มวาด
    console.table({
        "Player Number": myPlayerNumber,
        "Is P1?": isP1,
        "My Y": myY,
        "Opponent Y": opponentY,
        "Room ID": roomId
    });

    // 3. เซตค่าสถานะเกม
    isGameOver = false;
    myHP = 100;
    opponentHP = 100;
    bullets = []
    setupMobileControls(); // ✅ ย้ายมาเรียกตรงนี้เพื่อให้มั่นใจว่า roomId มีค่าแล้ว

    // ✅ เพิ่มบรรทัดนี้เพื่อเริ่มระบบกระสุน
    startAmmoSystem();
}
draw();