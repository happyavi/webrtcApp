var dashboard = document.querySelector("#dashboard"),
  stream = document.querySelector("#stream"),
  client = document.querySelector("#client"),
  connect = document.querySelector("#connect"),
  guest = document.querySelector("#guest"),
  hangUp = document.querySelector("#hang-up");

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

const pc = new RTCPeerConnection(iceServers);
const socket = io("https://webrtcappm-cf49c223a6aa.herokuapp.com");

var localeStream;
var isSource = false;

// Log RTCPeerConnection state changes
pc.addEventListener('iceconnectionstatechange', () => {
  console.log('ICE connection state:', pc.iceConnectionState);
});

pc.addEventListener('signalingstatechange', () => {
  console.log('Signaling state:', pc.signalingState);
});

pc.addEventListener('connectionstatechange', () => {
  console.log('Connection state:', pc.connectionState);
});

hangUp.onclick = function (e) {
  location.reload();
};

connect.onclick = function () {
  // Trigger "start-streaming" event when the "Start Streaming" button is clicked
  socket.emit("start-streaming");
  dashboard.style.display = "none";
  stream.style.display = "block";
  isSource = true; // Set the user as the source
};

guest.onclick = function () {
  // Trigger "receive-streaming" event when the "Receive Streaming" button is clicked
  socket.emit("receive-streaming");
  dashboard.style.display = "none";
  stream.style.display = "block";
};

let streamUrl;

socket.on("stream-url", (url) => {
  streamUrl = url;
});

socket.on("start-streaming", () => {
  // get user media
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then(async userStream => {
      if (isSource) {
        // If the user is the source, display their own stream
        client.srcObject = userStream;
      }
      localeStream = userStream;
      try {
        client.play();
      } catch (err) {
        console.error(err);
      }
    });
});

socket.on("receive-streaming", () => {
  pc.ontrack = addRemoteMediaStream;
  pc.onicecandidate = generateIceCandidate;
  pc.addTrack(localeStream.getTracks()[0], localeStream);
  pc.addTrack(localeStream.getTracks()[1], localeStream);

  if (pc.signalingState === "stable") {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        console.log("Setting local description:", pc.localDescription);
        socket.emit("offer", pc.localDescription);
      })
      .catch((err) => {
        console.error("Error creating or setting local description:", err);
      });
  }
});

document.querySelector("#guest").addEventListener("click", () => {
  const newWindow = window.open("", "_blank");
  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Streaming</title>
        <style>
          body {
            margin: 0;
            overflow: hidden;
          }
          video {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <video autoplay id="stream"></video>
        <script src="https://cdn.socket.io/4.0.1/socket.io.min.js"></script>
        <script>
          const socket = io();
          const streamVideo = document.getElementById("stream");

          socket.on("offer", async (offer) => {
            const pc = new RTCPeerConnection(iceServers);

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                socket.emit("candidate", {
                  label: event.candidate.sdpMLineIndex,
                  id: event.candidate.sdpMid,
                  candidate: event.candidate.candidate,
                });
              }
            };

            pc.ontrack = (event) => {
              streamVideo.srcObject = event.streams[0];
            };

            await pc.setRemoteDescription(offer);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("answer", pc.localDescription);
          });

          socket.on("candidate", (candidate) => {
            const iceCandidate = new RTCIceCandidate({
              sdpMLineIndex: candidate.label,
              candidate: candidate.candidate,
            });

            pc.addIceCandidate(iceCandidate);
          });
        </script>
      </body>
    </html>
  `);
  window.open(streamUrl, "_blank");
});

socket.on("offer", offer => {
  if (pc.signalingState !== "stable") {
    console.warn("Invalid signaling state for offer:", pc.signalingState);
    return;
  }

  // Set up the PC for receiving streaming
  pc.ontrack = addRemoteMediaStream;
  pc.onicecandidate = generateIceCandidate;

  pc.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => {
      if (pc.signalingState === "have-remote-offer") {
        return pc.createAnswer();
      }
    })
    .then(description => pc.setLocalDescription(description))
    .then(() => {
      if (pc.localDescription) {
        console.log("Setting local description", pc.localDescription);
        socket.emit("answer", pc.localDescription);
      }
    })
    .catch(err => {
      console.error("Error setting remote description or creating local description:", err);
    });
});

socket.on("answer", answer => {
  pc.setRemoteDescription(new RTCSessionDescription(answer))
    .catch(err => {
      console.error("Error setting remote description:", err);
    });
});

socket.on("candidate", event => {
  var iceCandidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate
  });
  pc.addIceCandidate(iceCandidate)
    .catch(err => {
      console.error("Error adding ice candidate:", err);
    });
});

function addRemoteMediaStream(event) {
  if (!isSource) {
    // If the user is the receiver, display the remote stream
    client.srcObject = event.streams[0];
  }
}

function generateIceCandidate(event) {
  if (event.candidate) {
    var candidate = {
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    };
    console.log("Sending a candidate: ", candidate);
    socket.emit("candidate", candidate);
  }
}