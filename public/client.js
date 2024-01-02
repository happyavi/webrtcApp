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

const pc = new RTCPeerConnection();
const socket = io("https://webrtcappm-cf49c223a6aa.herokuapp.com");

var localeStream;
var isSource = false;

// Log RTCPeerConnection state changes
pc.addEventListener("iceconnectionstatechange", () => {
  console.log("ICE connection state:", pc.iceConnectionState);
});

pc.addEventListener("signalingstatechange", () => {
  console.log("Signaling state:", pc.signalingState);
});

pc.addEventListener("connectionstatechange", () => {
  console.log("Connection state:", pc.connectionState);
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

function initializeConnectionWithStunServers(index) {
  if (index >= stunServers.length) {
    console.error("Unable to connect to any STUN server.");
    return;
  }

  const currentStunServer = stunServers[index];

  const iceServers = [{ urls: `stun:${currentStunServer}` }];
  
  pc.iceServers = iceServers;
}

socket.on("start-streaming", () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(async (userStream) => {
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

  const remoteDescription = new RTCSessionDescription(offer);

  if (pc.signalingState === "have-remote-offer" || pc.signalingState === "stable") {
    pc.setRemoteDescription(remoteDescription)
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
  }
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

initializeConnectionWithStunServers(0); // Call the function to initialize with the first STUN server