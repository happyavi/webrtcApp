const express = require("express");
const app = express();
const fs = require("fs");
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("WebRTC application running on Heroku!");
});

io.on("connection", (socket) => {
  console.log("user connected to the socket");

  socket.on("start-streaming", () => {
    io.emit("start-streaming");
  });

  socket.on("receive-streaming", () => {
    io.emit("receive-streaming");
  });

  socket.on("offer", (offer) => {
    io.emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    io.emit("answer", answer);
  });

  socket.on("candidate", (candidate) => {
    io.emit("candidate", candidate);
  });

  socket.on("get-stream-url", () => {
    const streamUrl = `/stream/${socket.id}`;
    io.to(socket.id).emit("stream-url", streamUrl);
  });
});

app.get("/stream/:id", (req, res) => {
  const socketId = req.params.id;
  res.sendFile(__dirname + "/public/stream.html");
});

server.listen(PORT, () => {
  console.log("Server is listening on port:", PORT);
});
