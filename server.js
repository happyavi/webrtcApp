const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid"); // Add this line to generate unique IDs
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

// Add a new route for handling video streaming
app.get("/stream/:streamId", (req, res) => {
  const streamId = req.params.streamId;
  res.sendFile(path.join(__dirname, "public", "stream.html")); // Create a stream.html file in the "public" folder
});

io.on("connection", socket => {
  console.log("user connected to the socket");

  socket.on("start-streaming", () => {
    // Broadcast that the source PC is starting streaming
    io.emit("start-streaming");
  });

  socket.on("receive-streaming", () => {
    const streamId = uuidv4(); // Generate a unique ID for the stream
    io.emit("receive-streaming", streamId);

    // Redirect the user to the streaming route with the unique ID
    io.to(socket.id).emit("redirect", `/stream/${streamId}`);
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