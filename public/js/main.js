// TODO: Handle ICE Candidates
// FIX: Only the initiator receives the media
// FIX: Only the response receives the ICE candidates
"use strict";

console.log("Hi from public folder!");

// Tells if is the
let isInitiatior = false;

// Room ID
let room;

// Get the windows to show video
const localVideo = document.querySelector("#localVideo");
const remoteVideo = document.querySelector("#remoteVideo");

// Manage the local streams
let localStream;

// Offer Options
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1,
  voiceActivityDetection: false
};

// RTC Offer or Candidate
let local;

// Local Description
let localDescription;

// Hash a String
const hash = async str => {
  const subtle = window.crypto.subtle;
  const data = new TextEncoder().encode(str);
  const digest = await subtle.digest("SHA-256", data);
  const dataView = new DataView(digest);

  let hex = "";
  let c;
  for (let i = 0; i < dataView.byteLength; i++) {
    c = dataView.getUint8(i).toString(16);

    if (c.length < 2) c = "0" + c;

    hex += c;
  }

  return hex;
};

const onErrorSetLocalDescription = reason =>
  console.log("Local Description Not added, reason:", reason);

const onErrorSetRemoteDescription = reason =>
  console.log("Remote Description Not added, reason:", reason);

const onErrorCreateAnswer = error =>
  console.log("Failed to create an answer:", error);

const onErrorCreateOffer = error =>
  console.log("Failed to create offer:", error);

const onIceCandidateSuccess = candidate =>
  console.log("ICE Candidate connected:", candidate);

const onIceCandidateError = error =>
  console.log("Error adding ICE candidate:", error);

async function setLocalDescription(desc) {
  console.log("Local Description", desc);
  localDescription = desc;

  try {
    await local.setLocalDescription(desc);
    console.log(`Local Description Added: ${localDescription}`);
  } catch (error) {
    onErrorSetLocalDescription(error);
  }
}

async function setRemoteDescription(desc) {
  console.log("Setting remote description:", desc);

  try {
    const rDescription = new RTCSessionDescription(desc);
    await local.setRemoteDescription(rDescription);
    console.log(`Remote Description Added: ${rDescription}`);
  } catch (error) {
    onErrorSetRemoteDescription(error);
  }
}

const onIceCandidate = socket => event => {
  const { candidate } = event;

  if (candidate) {
    const { sdpMlineIndex, sdpMid } = candidate;
    console.log("Sending ICE Candidate");
    socket.emit("candidate", room, {
      label: sdpMlineIndex,
      id: sdpMid,
      candidate: candidate.candidate
    });
  }
};

const onTrack = e => {
  console.log("Receiving media...", e);
  const { track, streams } = e;

  if (track && track.kind === "video" && remoteVideo.srcObject !== streams[0]) {
    remoteVideo.srcObject = streams[0];
    console.log(remoteVideo.srcObject);
  }
};

async function initialize() {
  const rtcConfig = {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302"
        ]
      },
      {
        urls: "turn:numb.viagenie.ca",
        credential: "muazkh",
        username: "webrtc@live.com"
      },
      {
        urls: "turn:192.158.29.39:3478?transport=udp",
        credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
        username: "28224511:1379330808"
      },
      {
        urls: "turn:192.158.29.39:3478?transport=tcp",
        credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
        username: "28224511:1379330808"
      },
      {
        urls: "turn:turn.bistri.com:80",
        credential: "homeo",
        username: "homeo"
      },
      {
        urls: "turn:turn.anyfirewall.com:443?transport=tcp",
        credential: "webrtc",
        username: "webrtc"
      }
    ]
  };

  local = new RTCPeerConnection(isInitiatior ? rtcConfig : null);

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  });

  localVideo.srcObject = localStream;

  console.log("Adding tracks");
  localStream.getTracks().forEach(track => local.addTrack(track, localStream));

  console.log("Adding ontrack listener");
  local.addEventListener("track", onTrack);
}

async function onCandidate(candidate_data) {
  const { label, candidate } = candidate_data;

  const iceCandidate = new RTCIceCandidate({
    sdpMLineIndex: label,
    candidate
  });

  try {
    await local.addIceCandidate(iceCandidate);
    onIceCandidateSuccess(iceCandidate);
  } catch (error) {
    onIceCandidateError(error);
  }
}

const onRoomCreated = socket => async (room_id, id) => {
  console.log(`Room with id ${room_id} created by Client ${id}`);

  isInitiatior = true;

  await initialize();
  try {
    const offer = await local.createOffer(offerOptions);
    await setLocalDescription(offer);
  } catch (error) {
    onErrorCreateOffer(error);
  }
};

async function onJoined(room_id, id) {
  console.log(`This Client with ID ${id} has joined to room ${room_id}`);
  if (!isInitiatior) await initialize();
}

const onReady = socket => () => {
  console.log("Connection ready, it's time to stablish p2p connection");
  if (isInitiatior) {
    console.log("Adding onicecandidate listener");
    local.addEventListener("icecandidate", onIceCandidate(socket));
    socket.emit("offer", room, localDescription);
  }
};

const onOffer = socket => async offer => {
  console.log("Receiving offer");

  if (isInitiatior) {
    console.log("Initiator Profile. Offer rejected");
    return;
  }

  await setRemoteDescription(offer);

  try {
    const answer = await local.createAnswer(offerOptions);

    await setLocalDescription(answer);

    console.log("Adding onicecandidate listener");
    local.addEventListener("icecandidate", onIceCandidate(socket));

    socket.emit("answer", room, answer);
  } catch (error) {
    onErrorCreateAnswer(error);
  }
};

const onAnswer = socket => async answer => {
  console.log("Receiving answer...");

  if (!isInitiatior) {
    console.log("Response Profile. Answer rejected");
    return;
  }

  try {
    await setRemoteDescription(answer);
    socket.emit("success", room);
  } catch (error) {
    console.error(error);
  }
};

const onSuccess = () => {
  console.log("Connection between peers done");
};

const onHangUp = () => {
  console.log("Call Finished");
  local.close();

  remoteAudio.srcObject = undefined;
  remoteVideo.srcObject = undefined;
  // Enable Call Button
  // Disable HangUp Button
};

const onClientDisconnected = id => {
  console.log(`User ${id} left the room`);
  remoteVideo.srcObject = undefined;
  console.log("Trying to reconnect...");
};

const onRoomFull = room => {
  console.log(`Room with ID ${room} is full`);
  return;
};

const finishCall = socket => {
  console.log("Finishing call");

  socket.emit("hang-up", room, socket.id);

  local.close();

  remoteAudio.srcObject = undefined;
  remoteVideo.srcObject = undefined;
  // Enable Call Button
  // Disable HangUp Button
};

const socket = io.connect();
socket.emit("message", "Hello from client!");

socket.on("ipaddr", ipAddr => console.log(`Server IP Address: ${ipAddr}`));
socket.emit("ipaddr");

socket.on("room-full", onRoomFull);

socket.on("joined", onJoined);

socket.on("room-created", onRoomCreated(socket));

socket.on("ready", onReady(socket));

socket.on("offer", onOffer(socket));

socket.on("candidate", onCandidate);

socket.on("answer", onAnswer(socket));

socket.on("success", onSuccess);

socket.on("hang-up", onHangUp);

socket.on("client-disconnected", onClientDisconnected);

hash("this is the merge of student and teacher ids").then(hash => {
  room = hash;
  socket.emit("create-or-join", room);
});
