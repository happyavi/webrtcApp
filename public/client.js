//client.js:
var dashboard = document.querySelector("#dashboard"),
  stream = document.querySelector("#stream"),
  client = document.querySelector("#client"),
  connect = document.querySelector("#connect"),
  guest = document.querySelector("#guest"),
  hangUp = document.querySelector("#hang-up");

const iceConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

//const iceConfiguration = {
//    iceServers: [
//        {
//            urls: 'turn:openrelay.metered.ca:80',
//            username: 'openrelayproject',
//            credential: 'openrelayproject'
//        }
//    ]
//}

const pc = new RTCPeerConnection(iceConfiguration);
const socket = io();

var localeStream;
var isSource = false;

// Detect network changes
window.addEventListener('online', () => {
  console.log('Network online. Attempting to restart the WebRTC connection.');
  restartWebRTCConnection();
});
window.addEventListener('offline', () => {
  console.log('Network offline. WebRTC connection might be affected.');
});

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
    if (!localeStream) {
        // If localeStream is not set, get the user media first
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(userStream => {
                localeStream = userStream;
                setupPeerConnection();
            }).catch(err => {
                console.error("Error getting user media:", err);
            });
    } else {
        // If localeStream is already set, proceed to set up the connection
        setupPeerConnection();
    }
});

function restartWebRTCConnection() {
  if (pc && pc.iceConnectionState !== 'closed') {
    pc.createOffer({ iceRestart: true })
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        console.log('Restarting ICE process and sending new offer.');
        socket.emit('offer', pc.localDescription);
      })
      .catch(err => console.error('Error during ICE restart:', err));
  }
}

function setupPeerConnection() {
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
	
	// Listen for ICE disconnection or failed states
	pc.addEventListener('iceconnectionstatechange', () => {
		if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
		console.log('ICE connection is disconnected or failed. Attempting to restart.');
		restartWebRTCConnection();
		}
	});
}

socket.on("offer", offer => {
  // Only set remote description if signalingState allows
  if (pc.signalingState === "stable" || pc.signalingState === "have-local-offer") {
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
  } else {
    console.warn("Received offer in unexpected signaling state:", pc.signalingState);
  }
});

socket.on("answer", answer => {
  if (pc.signalingState === "have-remote-offer" || pc.signalingState === "have-local-pranswer") {
    pc.setRemoteDescription(new RTCSessionDescription(answer))
      .catch(err => {
        console.error("Error setting remote description:", err);
      });
  } else {
    console.warn("Received answer in unexpected signaling state:", pc.signalingState);
  }
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

// Function to automatically start receiving the stream
function autoStartReceiving() {
    if (window.location.search.includes("autostart=true")) {
        // Trigger the same actions as when 'Receive Streaming' is clicked
        socket.emit("receive-streaming");  // This should initiate the same process as clicking the button
        dashboard.style.display = "none";
        stream.style.display = "block";
    }
}

// Call this function when the window loads
window.onload = autoStartReceiving;