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
    const remoteStream = new MediaStream(event.streams);
    client.srcObject = remoteStream;
    
    // Add the following code to send the remote stream to the virtual camera
    const remoteVideoTrack = remoteStream.getVideoTracks()[0];
    const remoteSender = pc.getSenders().find(sender => sender.track === remoteVideoTrack);
    const remoteStreamClone = remoteStream.clone();
    remoteSender.replaceTrack(remoteStreamClone.getVideoTracks()[0]);
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