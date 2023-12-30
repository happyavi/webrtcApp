const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const PORT = process.env.PORT || 3000;

const server = require("http").createServer(app);
const io = require("socket.io")(server);

app.use(express.static("public"));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public"));
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ fileName: req.file.filename });
});

io.on("connection", (socket) => {
  // ... (rest of the code remains unchanged)
});

server.listen(PORT, () => {
  console.log("Server is listening on port:", PORT);
});
