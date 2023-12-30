const express = require("express");
const app = express();
const fs = require("fs");
const http = require("http");
const socketIO = require("socket.io");
const fileUpload = require("express-fileupload");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static("public"));
app.use(fileUpload());

app.get("/", (req, res) => {
  res.send("WebRTC application running on Heroku!");
});

io.on("connection", socket => {
  console.log("user connected to the socket");

  socket.on("start-streaming", () => {
    io.emit("start-streaming");
  });

  socket.on("receive-streaming", () => {
    io.emit("receive-streaming");
  });

  socket.on("offer", offer => {
    io.emit("offer", offer);
  });

  socket.on("answer", answer => {
    io.emit("answer", answer);
  });

  socket.on("candidate", candidate => {
    io.emit("candidate", candidate);
  });

  socket.on("local-file", fileData => {
    io.emit("local-file", fileData);
  });
});

server.listen(PORT, () => {
  console.log("Server is listening on port:", PORT);
});
