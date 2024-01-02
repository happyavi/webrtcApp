var dashboard = document.querySelector("#dashboard"),
  stream = document.querySelector("#stream"),
  client = document.querySelector("#client"),
  connect = document.querySelector("#connect"),
  guest = document.querySelector("#guest"),
  hangUp = document.querySelector("#hang-up");

const stunServers = [
  "stun.l.google.com:19302",
  "stun1.l.google.com:19302",
  "stun2.l.google.com:19302",
  "stun3.l.google.com:19302",
  "stun4.l.google.com:19302",
  "stun01.sipphone.com",
  "stun.ekiga.net",
  "stun.fwdnet.net",
  "stun.ideasip.com",
  "stun.iptel.org",
  "stun.rixtelecom.se",
  "stun.schlund.de",
  "stunserver.org",
  "stun.softjoys.com",
  "stun.voiparound.com",
  "stun.voipbuster.com",
  "stun.voipstunt.com",
  "stun.voxgratia.org",
  "stun.xten.com"
];

let currentStunServerIndex = 0;

function initializePeerConnection() {
  const iceServers = {
    iceServers: [
      { urls: "stun:" + stunServers[currentStunServerIndex] }
    ]
  };

  const pc = new RTCPeerConnection(iceServers);
  pc.addEventListener('iceconnectionstatechange', () => {
    console.log('ICE connection state:', pc.iceConnectionState);
  });

  pc.addEventListener('signalingstatechange', () => {
    console.log('Signaling state:', pc.signalingState);
  });

  pc.addEventListener('connectionstatechange', () => {
    console.log('Connection state:', pc.connectionState);
  });

  return pc;
}

let pc = initializePeerConnection();
const socket = io("https://webrtcappm-cf49c223a6aa.herokuapp.com");

var localeStream;
var isSource = false;

hangUp.onclick = function (e) {
  location.reload();
};

connect.onclick = function () {
  socket.emit("start-streaming");
  dashboard.style.display = "none";
  stream.style.display = "block";
  isSource = true;
};

guest.onclick = function () {
  socket.emit("receive-streaming");
  dashboard.style.display = "none";
  stream.style.display = "block";
};

socket.on("start-streaming", () => {
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then(async userStream => {
      if (isSource) {
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
  pc = initializePeerConnection();
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

function switchToNextStunServer() {
  currentStunServerIndex = (currentStunServerIndex + 1) % stunServers.length;
  console.log("Switching to the next STUN server:", stunServers[currentStunServerIndex]);
  pc = initializePeerConnection();
}

// Handle connection failures or timeouts
pc.addEventListener('iceconnectionstatechange', () => {
  if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
    console.log('ICE connection failed, switching to the next STUN server.');
    switchToNextStunServer();
  }
});