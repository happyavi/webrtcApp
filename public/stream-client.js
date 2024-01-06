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
