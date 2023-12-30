const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const fileUpload = require("express-fileupload");

app.use(fileUpload());

const PORT = process.env.PORT || 3000;

const server = require("http").createServer(app);
const io = require("socket.io")(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("WebRTC application running on Heroku!");
});

app.post("/upload", (req, res) => {
  const file = req.files.file;
  const fileName = file.name;
  const filePath = path.join(__dirname, "public", fileName);

  file.mv(filePath, (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.json({ fileName });
  });
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
});

server.listen(PORT, () => {
  console.log("Server is listening on port:", PORT);
});
