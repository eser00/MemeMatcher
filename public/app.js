// Global variables
let video;
let canvas;
let ctx;
let net;
let hands;
let faceMesh;
let isModelLoaded = false;
let isCameraActive = false;
let animationFrame;

// Memes, keyed by id (each id has a detector in matchPoseToMeme)
const memeFeatures = {
    thumbsup: {
        name: "Thumbs Up",
        filename: "thumbsup.png"
    },
    cheer: {
        name: "Cheer",
        filename: "cheer.webp"
    },
    lipa: {
        name: "Lipa",
        filename: "lipa.png"
    },
    middle: {
        name: "Middle Fingers",
        filename: "middle.gif"
    },
    shush: {
        name: "Shush",
        filename: "shush.jpg"
    },
    yawn: {
        name: "Yawn",
        filename: "yawn.jpg"
    },
    shaq: {
        name: "Shaq",
        filename: "shaq.png"
    },
    rock: {
        name: "The Rock",
        filename: "rock-eyebrow.jpg"
    },
    takel: {
        name: "Take the L",
        filename: "take-the-l.gif"
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    // Load PoseNet model
    await loadModel();
    
    // Setup event listeners
    document.getElementById('startBtn').addEventListener('click', startCamera);
    document.getElementById('stopBtn').addEventListener('click', stopCamera);
});

// Load TensorFlow.js PoseNet model and MediaPipe Hands
async function loadModel() {
    try {
        console.log('Loading models...');
        
        // Load PoseNet
        net = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        
        // Load MediaPipe Hands
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onHandsResults);

        // Load MediaPipe Face Mesh
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        faceMesh.onResults(onFaceResults);
        
        isModelLoaded = true;
        setCameraState('idle');
        document.getElementById('status').textContent = 'Models loaded! Ready to start.';
        document.getElementById('status').className = 'status success';
        document.getElementById('startBtn').disabled = false;
        console.log('Models loaded successfully');
    } catch (error) {
        console.error('Error loading models:', error);
        setCameraState('idle');
        document.getElementById('status').textContent = 'Error loading models. Please refresh the page.';
        document.getElementById('status').className = 'status error';
    }
}

// Viewfinder state drives the loading / idle / live visuals in CSS:
// 'loading' (models, on page load) → 'idle' → 'live'
function setCameraState(state) {
    document.getElementById('videoContainer').dataset.state = state;
}

// Start and Stop swap places in the dock; keep keyboard focus on whichever is showing
function handOffFocus(fromId, toId) {
    const active = document.activeElement;
    if (active && (active.id === fromId || active === document.body)) {
        document.getElementById(toId).focus();
    }
}

function goLive() {
    setCameraState('live');
    startTimecode();
    document.getElementById('stopBtn').disabled = false;
    handOffFocus('startBtn', 'stopBtn');
    document.getElementById('status').textContent = 'Camera active. Strike a pose!';
    document.getElementById('status').className = 'status success';
}

// Store hand results
let handResults = null;

function onHandsResults(results) {
    handResults = results;
}

// Store face results
let faceResults = null;

function onFaceResults(results) {
    faceResults = results;
}

// Start camera
async function startCamera() {
    document.getElementById('startBtn').disabled = true;
    document.getElementById('status').textContent = 'Starting camera…';
    document.getElementById('status').className = 'status';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            }
        });

        video.srcObject = stream;
        isCameraActive = true;
        goLive();

        // Wait for video metadata to load
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Start pose detection
            detectPose();
        };
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        document.getElementById('startBtn').disabled = false;
        document.getElementById('status').textContent = 'Error accessing camera. Please check permissions.';
        document.getElementById('status').className = 'status error';
    }
}

// Stop camera
function stopCamera() {
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    isCameraActive = false;
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    setCameraState('idle');
    stopTimecode();
    document.getElementById('startBtn').disabled = false;
    handOffFocus('stopBtn', 'startBtn');
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = 'Camera stopped.';
    document.getElementById('status').className = 'status';

    // Reset matched meme display
    displayMatchedMeme(null);
    document.getElementById('matchedMeme').innerHTML = '<p class="placeholder">No match yet. Start your camera to begin!</p>';
    shownMemeId = null;
    currentMemeId = null;
    Object.keys(smoothedScores).forEach(id => { smoothedScores[id] = 0; });
}

// REC timecode in the viewfinder HUD (HH:MM:SS since the camera started)
let timecodeInterval;

function startTimecode() {
    const startedAt = Date.now();
    const el = document.getElementById('timecode');
    const pad = n => String(n).padStart(2, '0');
    clearInterval(timecodeInterval);
    timecodeInterval = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        el.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    }, 250);
}

function stopTimecode() {
    clearInterval(timecodeInterval);
    document.getElementById('timecode').textContent = '00:00:00';
}

// Pose detection loop
async function detectPose() {
    if (!isCameraActive || !isModelLoaded) return;
    
    try {
        // Detect pose with horizontal flip for mirror effect
        const pose = await net.estimateSinglePose(video, {
            flipHorizontal: true,  // Mirror the video for natural feel
            decodingMethod: 'single-person'
        });
        
        // Process hand and face detection
        if (hands) {
            await hands.send({ image: video });
        }
        if (faceMesh) {
            await faceMesh.send({ image: video });
        }
        
        // Draw pose skeleton
        drawPose(pose, handResults);
        
        // Match with meme (will check both arms and hands for better matching)
        const match = matchPoseToMeme(pose, handResults, faceResults);
        
        // Display matched meme
        displayMatchedMeme(match);

    } catch (error) {
        console.error('Error detecting pose:', error);
    }
    
    // Continue detection loop
    animationFrame = requestAnimationFrame(detectPose);
}

// Draw pose skeleton and hands on canvas
function drawPose(pose, handResults) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw hands if available (mirrored)
    if (handResults && handResults.multiHandLandmarks) {
        handResults.multiHandLandmarks.forEach(landmarks => {
            // Draw hand landmarks (mirrored horizontally)
            landmarks.forEach(landmark => {
                const x = canvas.width - (landmark.x * canvas.width); // Mirror horizontally
                const y = landmark.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#ff3b30';
                ctx.fill();
            });
            
            // Draw hand connections (mirrored)
            ctx.strokeStyle = 'rgba(255, 59, 48, 0.7)';
            ctx.lineWidth = 1.5;
            
            // Hand connections (simplified - draw key connections)
            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
                [0, 5], [5, 6], [6, 7], [7, 8], // Index finger
                [0, 9], [9, 10], [10, 11], [11, 12], // Middle finger
                [0, 13], [13, 14], [14, 15], [15, 16], // Ring finger
                [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
            ];
            
            connections.forEach(([i1, i2]) => {
                const p1 = landmarks[i1];
                const p2 = landmarks[i2];
                ctx.beginPath();
                // Mirror the x coordinates
                ctx.moveTo(canvas.width - (p1.x * canvas.width), p1.y * canvas.height);
                ctx.lineTo(canvas.width - (p2.x * canvas.width), p2.y * canvas.height);
                ctx.stroke();
            });
        });
    }
    
    // Draw pose skeleton
    
    // Draw keypoints
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#f4efe8';
            ctx.fill();
        }
    });
    
    // Draw skeleton connections
    const connections = [
        ['nose', 'leftEye'],
        ['nose', 'rightEye'],
        ['leftEye', 'leftEar'],
        ['rightEye', 'rightEar'],
        ['leftShoulder', 'rightShoulder'],
        ['leftShoulder', 'leftElbow'],
        ['rightShoulder', 'rightElbow'],
        ['leftElbow', 'leftWrist'],
        ['rightElbow', 'rightWrist'],
        ['leftShoulder', 'leftHip'],
        ['rightShoulder', 'rightHip'],
        ['leftHip', 'rightHip'],
        ['leftHip', 'leftKnee'],
        ['rightHip', 'rightKnee'],
        ['leftKnee', 'leftAnkle'],
        ['rightKnee', 'rightAnkle']
    ];
    
    ctx.strokeStyle = 'rgba(244, 239, 232, 0.6)';
    ctx.lineWidth = 2;
    
    connections.forEach(([point1, point2]) => {
        const kp1 = pose.keypoints.find(kp => kp.part === point1);
        const kp2 = pose.keypoints.find(kp => kp.part === point2);
        
        if (kp1 && kp2 && kp1.score > 0.5 && kp2.score > 0.5) {
            ctx.beginPath();
            ctx.moveTo(kp1.position.x, kp1.position.y);
            ctx.lineTo(kp2.position.x, kp2.position.y);
            ctx.stroke();
        }
    });
}

// ── Gesture detection ─────────────────────────────────────────
// Hand and face landmarks are normalized (0..1) to the un-mirrored video frame.
// Distances scale x by the frame's aspect ratio so they aren't squashed horizontally.

const SMOOTHING = 0.35;      // weight of the newest frame in each meme's moving average
const STICKY_BONUS = 0.05;   // the meme on screen keeps winning near-ties, so it doesn't flicker
const smoothedScores = {};
let currentMemeId = null;

function frameAspect() {
    return (canvas && canvas.height) ? canvas.width / canvas.height : 4 / 3;
}

function dist(a, b) {
    const dx = (a.x - b.x) * frameAspect();
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function centerOf(points) {
    return {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length
    };
}

function boundingBox(lm) {
    const xs = lm.map(p => p.x);
    const ys = lm.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// Finger joints: [MCP, PIP, TIP]
const FINGERS = {
    index: [5, 6, 8],
    middle: [9, 10, 12],
    ring: [13, 14, 16],
    pinky: [17, 18, 20]
};

// Rotation-independent finger state: a straight finger's tip is much farther from
// the wrist than its PIP joint; a curled finger's tip folds back toward the palm.
function fingerState(lm, [, pip, tip]) {
    const ratio = dist(lm[tip], lm[0]) / (dist(lm[pip], lm[0]) || 1e-6);
    if (ratio > 1.15) return 'ext';
    if (ratio < 0.95) return 'curl';
    return '?';
}

// Describe one hand once per frame; every detector works from this.
function analyzeHand(lm) {
    const fingers = {};
    Object.keys(FINGERS).forEach(name => { fingers[name] = fingerState(lm, FINGERS[name]); });

    const states = Object.values(fingers);
    const extCount = states.filter(s => s === 'ext').length;
    const curlCount = states.filter(s => s === 'curl').length;
    const palmSize = dist(lm[0], lm[9]) || 1e-6;
    const box = boundingBox(lm);

    // Thumb pointing up: tip well above its base and above every other fingertip
    const thumbUp = lm[4].y < lm[3].y && lm[3].y < lm[2].y &&
        (lm[2].y - lm[4].y) > palmSize * 0.5 &&
        [8, 12, 16, 20].every(i => lm[4].y < lm[i].y);

    // Thumb stuck out at roughly a right angle to the index finger (the "L")
    const thumbOut = dist(lm[4], lm[5]) > palmSize * 0.6;
    const thumbIndexAngle = angleBetween(lm[2], lm[4], lm[5], lm[8]);

    // Direction the hand points (wrist -> middle fingertip), in aspect-corrected units
    const dirX = (lm[12].x - lm[0].x) * frameAspect();
    const dirY = lm[12].y - lm[0].y;

    return {
        lm,
        fingers,
        extCount,
        curlCount,
        palmSize,
        box,
        size: Math.max((box.maxX - box.minX) * frameAspect(), box.maxY - box.minY),
        palm: centerOf([0, 5, 9, 13, 17].map(i => lm[i])),
        pointsUp: -dirY > Math.abs(dirX) * 1.2,
        pointsSideways: Math.abs(dirX) > Math.abs(dirY) * 1.5,
        isOpen: extCount === 4 || (extCount === 3 && curlCount === 0),
        isThumbsUp: thumbUp && curlCount >= 3 && extCount === 0,
        isMiddle: fingers.middle === 'ext' && fingers.index !== 'ext' && fingers.ring !== 'ext' &&
            fingers.pinky !== 'ext' && curlCount >= 2,
        isLipa: fingers.index === 'ext' && fingers.pinky === 'ext' &&
            (fingers.middle === 'curl' || fingers.ring === 'curl'),
        isPointing: fingers.index === 'ext' && fingers.middle === 'curl' && fingers.ring === 'curl' &&
            fingers.pinky !== 'ext',
        isL: fingers.index === 'ext' && fingers.middle === 'curl' && fingers.ring === 'curl' &&
            fingers.pinky !== 'ext' && thumbOut && thumbIndexAngle > 55 && thumbIndexAngle < 125,
        isClosed: extCount <= 1 && curlCount >= 2
    };
}

// Angle in degrees between segments a1->a2 and b1->b2 (aspect-corrected)
function angleBetween(a1, a2, b1, b2) {
    const ax = (a2.x - a1.x) * frameAspect(), ay = a2.y - a1.y;
    const bx = (b2.x - b1.x) * frameAspect(), by = b2.y - b1.y;
    const cos = (ax * bx + ay * by) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1e-6);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

// Face reference points from Face Mesh, or null when no face is visible
function analyzeFace(faceResults) {
    if (!faceResults || !faceResults.multiFaceLandmarks || faceResults.multiFaceLandmarks.length === 0) {
        return null;
    }
    const f = faceResults.multiFaceLandmarks[0];
    const mouthWidth = dist(f[61], f[291]) || 1e-6;
    // Brow-to-upper-eyelid gap, relative to mouth width (higher = brows raised)
    const browGap = ((f[159].y - f[105].y) + (f[386].y - f[334].y)) / 2 / mouthWidth;
    // Each brow's height above its eye's center (between the eye corners). Corners don't
    // move when blinking, and distances don't change when the head tilts.
    const leftBrowLift = dist(f[105], centerOf([f[33], f[133]]));
    const rightBrowLift = dist(f[334], centerOf([f[362], f[263]]));
    return {
        nose: f[1],
        lips: centerOf([f[13], f[14]]),
        mouthWidth,
        mouthOpen: dist(f[13], f[14]) / mouthWidth,
        faceWidth: dist(f[234], f[454]) || 1e-6,
        forehead: f[10],
        browGap,
        // 1.0 = brows level; higher = one brow raised above the other
        browAsymmetry: Math.max(leftBrowLift, rightBrowLift) / (Math.min(leftBrowLift, rightBrowLift) || 1e-6)
    };
}

// Match the current frame to the best meme
function matchPoseToMeme(pose, handResults, faceResults) {
    const handList = (handResults && handResults.multiHandLandmarks || []).map(analyzeHand);
    const face = analyzeFace(faceResults);

    // Head height (normalized y) for "hands above head"; fall back to PoseNet's nose
    let headY = face ? face.nose.y : null;
    if (headY === null) {
        const nose = pose.keypoints.find(kp => kp.part === 'nose' && kp.score > 0.5);
        if (nose && canvas.height) headY = nose.position.y / canvas.height;
    }

    const scene = { hands: handList, face, headY };
    const raw = {
        thumbsup: detectThumbsUp(scene),
        cheer: detectCheer(scene),
        lipa: detectLipa(scene),
        middle: detectMiddle(scene),
        shush: detectShush(scene),
        yawn: detectYawn(scene),
        shaq: detectShaq(scene),
        rock: detectRock(scene),
        takel: detectTakeL(scene)
    };

    let bestMatch = null;
    let bestScore = 0;
    Object.keys(memeFeatures).forEach(memeId => {
        const prev = smoothedScores[memeId] || 0;
        const score = prev + (raw[memeId] - prev) * SMOOTHING;
        smoothedScores[memeId] = score;

        const ranked = score + (memeId === currentMemeId ? STICKY_BONUS : 0);
        if (ranked > bestScore) {
            bestScore = ranked;
            bestMatch = memeId;
        }
    });

    currentMemeId = bestMatch;
    const confidence = bestMatch ? smoothedScores[bestMatch] : 0;
    return {
        memeId: bestMatch,
        meme: memeFeatures[bestMatch],
        confidence: Math.round(confidence * 100)
    };
}

// Thumbs Up: fist with the thumb pointing up (the meme has two)
function detectThumbsUp({ hands }) {
    const count = hands.filter(h => h.isThumbsUp).length;
    if (count >= 2) return 0.95;
    if (count === 1) return 0.75;
    return 0;
}

// Cheer: two open palms raised above the head, held apart
function detectCheer({ hands, headY }) {
    const open = hands.filter(h => h.isOpen);
    if (open.length < 2) return 0;

    const [a, b] = open;
    const apart = dist(a.palm, b.palm) > (a.size + b.size) / 2;
    if (!apart) return 0;

    const limit = headY !== null ? headY : 0.4;
    const raised = open.filter(h => h.lm[0].y < limit).length;
    if (raised >= 2) return 0.95;
    if (raised === 1) return 0.45;
    return 0.3;
}

// Lipa: index and pinky up, middle (or ring) folded
function detectLipa({ hands }) {
    return hands.some(h => h.isLipa) ? 0.9 : 0;
}

// Middle Fingers: middle finger up, the others folded (the meme has two)
function detectMiddle({ hands }) {
    const count = hands.filter(h => h.isMiddle).length;
    if (count >= 2) return 0.97;
    if (count === 1) return 0.88;
    return 0;
}

// Shush: index finger raised against the lips; raised brows push it higher
function detectShush({ hands, face }) {
    if (!face) return 0;

    let fingerScore = 0;
    hands.forEach(h => {
        const tip = h.lm[8];
        const fingerUp = tip.y < h.lm[5].y;
        if (!fingerUp || h.fingers.index !== 'ext' || h.extCount > 2) return;
        const proximity = dist(tip, face.lips) / face.mouthWidth;
        if (proximity < 0.7) fingerScore = Math.max(fingerScore, h.isPointing ? 0.88 : 0.8);
        else if (proximity < 1.1) fingerScore = Math.max(fingerScore, 0.5);
    });

    if (fingerScore === 0) return 0;
    const browBonus = face.browGap > 0.22 ? 0.07 : 0;
    return Math.min(0.97, fingerScore + browBonus);
}

// Yawn: mouth wide open (inner-lip gap vs mouth width)
function detectYawn({ face }) {
    if (!face) return 0;
    if (face.mouthOpen > 0.5) return 0.95;
    if (face.mouthOpen > 0.38) return 0.75;
    return 0;
}

// Shaq: timeout "T" — one flat hand sideways on top, the other upright with
// its fingertips touching the underside
function detectShaq({ hands }) {
    if (hands.length < 2) return 0;
    const [a, b] = hands;
    const flat = h => h.extCount >= 3;

    let top = null;
    let stem = null;
    if (a.pointsSideways && b.pointsUp) { top = a; stem = b; }
    else if (b.pointsSideways && a.pointsUp) { top = b; stem = a; }
    if (!top || !flat(top) || !flat(stem)) return 0;

    const stemTipY = Math.min(stem.lm[8].y, stem.lm[12].y, stem.lm[16].y);
    const stemX = (stem.box.minX + stem.box.maxX) / 2;
    const marginY = top.palmSize * 0.6;
    const marginX = (top.box.maxX - top.box.minX) * 0.2;

    const tipTouchesTop = stemTipY > top.box.minY - marginY && stemTipY < top.box.maxY + marginY;
    const underTop = stemX > top.box.minX - marginX && stemX < top.box.maxX + marginX;
    const stemBelow = stem.lm[0].y > top.box.maxY;

    if (tipTouchesTop && underTop && stemBelow) return 0.95;
    if (dist(top.palm, stem.palm) < (top.size + stem.size) * 0.75) return 0.6;
    return 0;
}

// The Rock: one eyebrow raised, the other level or lowered
function detectRock({ face }) {
    if (!face) return 0;
    if (face.browAsymmetry > 1.25) return 0.92;
    if (face.browAsymmetry > 1.15) return 0.65;
    return 0;
}

// Take the L: index up and thumb out in an L, best held against the forehead
function detectTakeL({ hands, face }) {
    let score = 0;
    hands.forEach(h => {
        if (!h.isL) return;
        // An L with the fingertip at the lips is Shush with the thumb sticking out
        if (face && dist(h.lm[8], face.lips) < face.mouthWidth * 0.9) return;
        const onForehead = face && dist(h.palm, face.forehead) < face.faceWidth;
        score = Math.max(score, onForehead ? 0.95 : 0.85);
    });
    return score;
}


// Display matched meme
// Last shown meme id; '' = "try a pose" placeholder. Avoids rebuilding the image every frame.
let shownMemeId = null;

function displayMatchedMeme(match) {
    const matchedMemeDiv = document.getElementById('matchedMeme');
    const confidence = match ? match.confidence : null;
    const isMatch = match && match.confidence > 50;
    const memeId = isMatch ? match.memeId : '';

    document.getElementById('confidence').textContent = confidence ?? '--';
    document.getElementById('confidenceBar').style.width = `${Math.min(100, confidence || 0)}%`;

    if (memeId === shownMemeId) return;
    shownMemeId = memeId;

    const matchPanel = document.getElementById('matchPanel');
    matchPanel.classList.toggle('is-matched', Boolean(isMatch));

    if (isMatch) {
        matchedMemeDiv.innerHTML = `<img src="memes/${match.meme.filename}" alt="${match.meme.name}">`;
        document.getElementById('matchName').textContent = match.meme.name;

        // Shutter flash: restart the animation on every new match
        matchPanel.classList.remove('is-flash');
        void matchPanel.offsetWidth;
        matchPanel.classList.add('is-flash');
    } else {
        matchedMemeDiv.innerHTML = '<p class="placeholder">Try to match a pose!</p>';
        document.getElementById('matchName').textContent = '—';
    }

    // Update active state in meme grid
    document.querySelectorAll('.meme-card').forEach(card => {
        card.classList.toggle('active', card.dataset.meme === memeId);
    });
}

