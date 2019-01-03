const http = require("http");
const nodeStatic = require("node-static");
const SocketIO = require("socket.io");

const EventHandlers = require("./websockets");

const fileServer = new nodeStatic.Server();
const app = http
  .createServer((req, res) => {
    fileServer.serve(req, res);
  })
  .listen(8080);

const io = SocketIO.listen(app);

io.on("connection", socket => {

  const { sockets } = io;

  socket.on("message", EventHandlers.onMessage);

  socket.on("create-or-join", EventHandlers.createOrJoin(sockets)(socket));

  socket.on("ipaddr", EventHandlers.onIPAddr(socket));

  socket.on("hang-up", EventHandlers.onHangUp(socket));

  socket.on("offer", EventHandlers.onOffer(sockets));

  socket.on("answer", EventHandlers.onAnswer(sockets));

  socket.on("candidate", EventHandlers.onCandidate(sockets))

  socket.on("success", EventHandlers.onSuccess(sockets));

  socket.on("disconnecting", EventHandlers.onDisconnecting(sockets)(socket));
});
