//server.js:
const express = require("express");
const app = express();
const fs = require("fs");
const PORT = process.env.PORT || 3000;

// const options = {
//   key: fs.readFileSync("key.pem"),
//   cert: fs.readFileSync("cert.pem")
// };
// const server = require("https").createServer(options, app);
const server = require("http").createServer(app);

const io = require("socket.io")(server);

app.use(express.static("public"));

// Default route for Heroku
app.get("/", (req, res) => {
  res.send("WebRTC application running on Heroku!");
});

io.on("connection", socket => {
  console.log("user connected to the socket");

  socket.on("start-streaming", () => {
    // Broadcast that the source PC is starting streaming
    io.emit("start-streaming");
  });

  socket.on("receive-streaming", () => {
    // Broadcast that the second PC is ready to receive streaming
    io.emit("receive-streaming");
  });

  socket.on("offer", offer => {
    // Broadcast the offer to all connected clients
    io.emit("offer", offer);
  });

  socket.on("answer", answer => {
    // Broadcast the answer to all connected clients
    io.emit("answer", answer);
  });

  socket.on("candidate", candidate => {
    // Broadcast the candidate to all connected clients
    io.emit("candidate", candidate);
  });
});

server.listen(PORT, () => {
  console.log("Server is listening on port:", PORT);
});