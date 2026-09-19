const socket = io();


// ===============================
// DOM ELEMENTS
// ===============================

const startButton =
    document.getElementById("startButton");

const joinButton =
    document.getElementById("joinButton");

const leaveButton =
    document.getElementById("leaveButton");

const roomInput =
    document.getElementById("roomInput");

const status =
    document.getElementById("status");

const localVideo =
    document.getElementById("localVideo");

const remoteVideo =
    document.getElementById("remoteVideo");


// ===============================
// VARIABLES
// ===============================

let localStream = null;

let remoteStream = null;

let peerConnection = null;

let roomId = null;


// ICE candidates can sometimes arrive
// before setRemoteDescription().
// Store them temporarily.
let pendingCandidates = [];


// ===============================
// WEBRTC CONFIGURATION
// ===============================

const rtcConfiguration = {

    iceServers: [

        {
            urls: "stun:stun.l.google.com:19302"
        }

    ]

};


// ===============================
// STATUS
// ===============================

function setStatus(message) {

    status.textContent =
        "Status: " + message;

    console.log(message);
}


// ===============================
// START CAMERA
// ===============================

async function startCamera() {

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia({

                video: true,

                audio: true

            });


        localVideo.srcObject =
            localStream;


        startButton.disabled = true;

        joinButton.disabled = false;


        setStatus(
            "Camera and microphone ready"
        );


    } catch (error) {

        console.error(error);

        setStatus(
            "Could not access camera/microphone"
        );

    }

}


// ===============================
// CREATE PEER CONNECTION
// ===============================

function createPeerConnection() {

    if (peerConnection) {

        return peerConnection;

    }


    console.log(
        "Creating RTCPeerConnection"
    );


    peerConnection =
        new RTCPeerConnection(
            rtcConfiguration
        );


    // ===========================
    // REMOTE STREAM
    // ===========================

    remoteStream =
        new MediaStream();

    remoteVideo.srcObject =
        remoteStream;


    // ===========================
    // ADD LOCAL TRACKS
    // ===========================

    localStream
        .getTracks()
        .forEach((track) => {

            peerConnection.addTrack(
                track,
                localStream
            );

        });


    // ===========================
    // RECEIVE REMOTE TRACK
    // ===========================

    peerConnection.ontrack =
        (event) => {

            console.log(
                "Remote track received"
            );


            event.streams[0]
                .getTracks()
                .forEach((track) => {

                    remoteStream.addTrack(
                        track
                    );

                });

        };


    // ===========================
    // ICE CANDIDATE
    // ===========================

    peerConnection.onicecandidate =
        (event) => {

            if (
                event.candidate &&
                roomId
            ) {

                socket.emit(
                    "ice-candidate",
                    {

                        roomId,

                        candidate:
                            event.candidate

                    }
                );

            }

        };


    // ===========================
    // CONNECTION STATE
    // ===========================

    peerConnection.onconnectionstatechange =
        () => {

            console.log(
                "Connection state:",
                peerConnection.connectionState
            );


            if (
                peerConnection.connectionState ===
                "connected"
            ) {

                setStatus(
                    "Video call connected"
                );

            }


            if (
                peerConnection.connectionState ===
                "disconnected"
            ) {

                setStatus(
                    "Peer disconnected"
                );

            }


            if (
                peerConnection.connectionState ===
                "failed"
            ) {

                setStatus(
                    "WebRTC connection failed"
                );

            }

        };


    return peerConnection;

}


// ===============================
// CREATE OFFER
// ===============================

async function createOffer() {

    try {

        const pc =
            createPeerConnection();


        console.log(
            "Creating offer..."
        );


        const offer =
            await pc.createOffer();


        await pc.setLocalDescription(
            offer
        );


        socket.emit(
            "offer",
            {

                roomId,

                offer:
                    pc.localDescription

            }
        );


        setStatus(
            "Offer sent"
        );


    } catch (error) {

        console.error(
            "Offer error:",
            error
        );

    }

}


// ===============================
// HANDLE OFFER
// ===============================

async function handleOffer(offer) {

    try {

        const pc =
            createPeerConnection();


        console.log(
            "Received offer"
        );


        await pc.setRemoteDescription(
            new RTCSessionDescription(
                offer
            )
        );


        // Add ICE candidates that
        // arrived early.
        await addPendingCandidates();


        const answer =
            await pc.createAnswer();


        await pc.setLocalDescription(
            answer
        );


        socket.emit(
            "answer",
            {

                roomId,

                answer:
                    pc.localDescription

            }
        );


        setStatus(
            "Answer sent"
        );


    } catch (error) {

        console.error(
            "Offer handling error:",
            error
        );

    }

}


// ===============================
// HANDLE ANSWER
// ===============================

async function handleAnswer(answer) {

    try {

        if (!peerConnection) {

            return;

        }


        console.log(
            "Received answer"
        );


        await peerConnection
            .setRemoteDescription(

                new RTCSessionDescription(
                    answer
                )

            );


        await addPendingCandidates();


        setStatus(
            "Remote description set"
        );


    } catch (error) {

        console.error(
            "Answer error:",
            error
        );

    }

}


// ===============================
// HANDLE ICE
// ===============================

async function handleIceCandidate(
    candidate
) {

    try {

        if (!peerConnection) {

            return;

        }


        // Remote description must exist
        // before adding candidate.
        if (
            !peerConnection.remoteDescription
        ) {

            pendingCandidates.push(
                candidate
            );

            return;

        }


        await peerConnection
            .addIceCandidate(

                new RTCIceCandidate(
                    candidate
                )

            );


    } catch (error) {

        console.error(
            "ICE candidate error:",
            error
        );

    }

}


// ===============================
// ADD PENDING ICE CANDIDATES
// ===============================

async function addPendingCandidates() {

    if (!peerConnection) {

        return;

    }


    for (
        const candidate
        of pendingCandidates
    ) {

        try {

            await peerConnection
                .addIceCandidate(

                    new RTCIceCandidate(
                        candidate
                    )

                );

        } catch (error) {

            console.error(
                error
            );

        }

    }


    pendingCandidates = [];

}


// ===============================
// JOIN ROOM
// ===============================

function joinRoom() {

    const room =
        roomInput.value.trim();


    if (!room) {

        setStatus(
            "Enter a room name"
        );

        return;

    }


    if (!localStream) {

        setStatus(
            "Start your camera first"
        );

        return;

    }


    roomId = room;


    socket.emit(
        "join-room",
        roomId
    );


    roomInput.disabled = true;

    joinButton.disabled = true;

    leaveButton.disabled = false;


    setStatus(
        `Joining room "${roomId}"`
    );

}


// ===============================
// LEAVE ROOM
// ===============================

function leaveRoom() {

    closePeerConnection();


    roomId = null;


    roomInput.disabled = false;

    joinButton.disabled = false;

    leaveButton.disabled = true;


    setStatus(
        "You left the room"
    );

}


// ===============================
// CLOSE CONNECTION
// ===============================

function closePeerConnection() {

    if (peerConnection) {

        peerConnection.close();

        peerConnection = null;

    }


    remoteVideo.srcObject = null;

    remoteStream = null;

    pendingCandidates = [];

}


// ===============================
// BUTTON EVENTS
// ===============================

startButton.addEventListener(
    "click",
    startCamera
);

joinButton.addEventListener(
    "click",
    joinRoom
);

leaveButton.addEventListener(
    "click",
    leaveRoom
);


// ===============================
// SOCKET EVENTS
// ===============================

socket.on(
    "room-joined",
    (data) => {

        console.log(
            "Room joined:",
            data
        );


        setStatus(
            `Joined room "${data.roomId}"`
        );

    }
);


socket.on(
    "peer-joined",
    async () => {

        console.log(
            "Another user joined"
        );


        setStatus(
            "Another user joined. Creating offer..."
        );


        await createOffer();

    }
);


socket.on(
    "offer",
    async (offer) => {

        await handleOffer(
            offer
        );

    }
);


socket.on(
    "answer",
    async (answer) => {

        await handleAnswer(
            answer
        );

    }
);


socket.on(
    "ice-candidate",
    async (candidate) => {

        await handleIceCandidate(
            candidate
        );

    }
);


socket.on(
    "peer-left",
    () => {

        closePeerConnection();


        setStatus(
            "The other user left"
        );

    }
);


socket.on(
    "room-full",
    () => {

        setStatus(
            "Room is full. Only 2 users are allowed."
        );


        roomInput.disabled = false;

        joinButton.disabled = false;

        leaveButton.disabled = true;

    }
);