// client.js
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
const socket = io();

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

socket.on("start-streaming", () => {
  // get user media
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then(async userStream => {
      if (isSource) {
        // If the user is the source, display their own stream
        client.srcObject = userStream;

        // Add the OBS virtual camera capture logic
        const canvas = document.createElement('canvas');
        canvas.width = 640; // Set the width as needed
        canvas.height = 480; // Set the height as needed
        const ctx = canvas.getContext('2d');
        const virtualCameraStream = canvas.captureStream(30); // Set the frame rate as needed

        // Connect the virtual camera stream with the user's media stream
        userStream.addTrack(virtualCameraStream.getVideoTracks()[0]);
        localeStream = userStream;

        try {
          client.play();
        } catch (err) {
          console.error(err);
        }
      }
    });
});

socket.on("receive-streaming", () => {
  // Set up the PC for receiving streaming
  pc.ontrack = addRemoteMediaStream;
  pc.onicecandidate = generateIceCandidate;
  pc.addTrack(localeStream.getTracks()[0], localeStream);
  pc.addTrack(localeStream.getTracks()[1], localeStream);

  if (pc.signalingState === "stable") {
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        console.log("Setting local description:", pc.localDescription);
        socket.emit("offer", pc.localDescription);
      })
      .catch(err => {
        console.error("Error creating or setting local description:", err);
      });
  }
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

function addRemoteMediaStream(event) {
  if (!isSource) {
    // If the user is the receiver, display the remote stream
    client.srcObject = event.streams[0];

    // Get the video track from the remote stream
    const remoteVideoTrack = event.streams[0].getVideoTracks()[0];

    // Set up the OBS virtual camera connection
    const obsWebSocket = new OBSWebSocket();
    obsWebSocket.connect({ address: '2405:201:c409:984e:49:9614:c6c3:3de1:4455', password: 'happy1234' })
      .then(() => {
        // Set up an interval to capture and send video frames to OBS
        setInterval(async () => {
          const frame = await getVideoFrame(remoteVideoTrack);
          obsWebSocket.send('SetCurrentScene', { 'scene-name': 'Scene' });
          obsWebSocket.send('StartVirtualCamera', { 'scene-name': 'Scene' });
          obsWebSocket.send('SubmitVideoFrame', { format: 'rgba', width: frame.width, height: frame.height, pixels: frame.data });
        }, 33); // Adjust the interval as needed
      })
      .catch(error => console.error('OBS WebSocket connection failed:', error));
  }
}

// Function to capture a video frame from the video track
async function getVideoFrame(videoTrack) {
  const imageCapture = new ImageCapture(videoTrack);
  const bitmap = await imageCapture.grabFrame();
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imageData;
}