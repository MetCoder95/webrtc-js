const os = require("os");

const checkRoom = (sockets, roomName) => {
  const { adapter } = sockets;
  const { rooms } = adapter;

  const room = rooms[roomName];
  const clients = Object.keys(room || {}).length;
  const available = clients - 1 < 2 ? true : false;

  console.log("No. of Clients:", clients);

  return { available, clients };
};

const emitToRoom = sockets => room => (event, ...args) => {
  sockets.in(room).emit(event, ...args);
};

const onMessage = msg => {
  console.log("Message from Client:", msg);
};

const onCandidate = sockets => (room_id, data) => {
  emitToRoom(sockets)(room_id)("candidate", data);
};

const onOffer = sockets => (room_id, offer) => {
  console.log("Offer received by Server");
  emitToRoom(sockets)(room_id)("offer", offer);
};

const onAnswer = sockets => (room_id, answer) => {
  emitToRoom(sockets)(room_id)("answer", answer);
};

const onSuccess = sockets => room_id => {
  emitToRoom(sockets)(room_id)("success");
};

const createOrJoin = sockets => socket => room => {
  const { available, clients } = checkRoom(sockets, room);

  console.log("Is Available:", available);
  if (!available) {
    socket.emit("room-full", room);
    return;
  }

  if (clients === 0) {
    socket.join(room);
    console.log(`Client ${socket.id} has created room ${room}`);
    socket.emit("room-created", room, socket.id);
  } else {
    console.log(`Client ${socket.id} has joined to room ${room}`);
    socket.join(room);
    socket.emit("joined", room, socket.id);
    setTimeout(() => emitToRoom(sockets)(room)("ready"), 1000);
  }
};

const onIPAddr = socket => () => {
  const ifaces = os.networkInterfaces();
  for (let dev in ifaces) {
    ifaces[dev].forEach(details => {
      const { family, address } = details;

      if (family === "IPv4" && address !== "127.0.0.1")
        socket.emit("ipaddr", address);
    });
  }
};

const onHangUp = socket => room => () => {
  console.log(`Client ${socket.id} hang up the call at room ${room}`);

  setTimeout(() => {
    socket.disconnect(true);
  }, 1500);

  emitToRoom(sockets)(room_id)("hang-up");
};

const onDisconnecting = sockets => socket => reason => {
  console.log(`Client ${socket.id}. Reason ${reason}`);
  Object.keys(socket.rooms).forEach(room => {
    sockets.in(room).emit("client-disconnected", socket.id);
  });
};

module.exports = {
  onMessage,
  createOrJoin,
  onIPAddr,
  onHangUp,
  onDisconnecting,
  onSuccess,
  onAnswer,
  onOffer,
  onCandidate
};
