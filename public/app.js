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

// Meme feature points (simplified representations)
const memeFeatures = {
    // monkey_point permanently removed
    thumbsup: {
        name: "Thumbs Up",
        filename: "thumbsup.png",
        keyPoints: ["leftShoulder", "leftElbow", "leftWrist", "rightShoulder", "rightElbow", "rightWrist"],
        specialGesture: "thumbsup" // Thumbs up gesture (either arm)
    },
    cheer: {
        name: "Cheer",
        filename: "cheer.webp",
        keyPoints: ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist"],
        specialGesture: "cheering" // Two hands above head, arms extended, open palms
    },
    lipa: {
        name: "Lipa",
        filename: "lipa.png",
        keyPoints: ["leftWrist", "rightWrist"],
        specialGesture: "lipa" // One hand: all fingers open except middle folded
    },
    middle: {
        name: "Middle Fingers",
        filename: "middle.gif",
        keyPoints: ["leftWrist", "rightWrist"],
        specialGesture: "middle" // One or two hands showing middle finger
    },
    shush: {
        name: "Shush",
        filename: "shush.jpg",
        keyPoints: ["nose"],
        specialGesture: "shush" // Finger over lips + raised brows
    },
    yawn: {
        name: "Yawn",
        filename: "yawn.jpg",
        keyPoints: ["nose"],
        specialGesture: "yawning"
    },
    shaq: {
        name: "Shaq",
        filename: "shaq.png",
        keyPoints: ["leftShoulder", "rightShoulder", "leftWrist", "rightWrist"],
        specialGesture: "shaq" // Two hands forming a T (pause sign)
    },
    sonic: {
        name: "Sonic",
        filename: "sonic.png",
        keyPoints: ["leftShoulder", "rightShoulder", "leftWrist", "rightWrist"],
        specialGesture: "sonic" // Two hands pressed together (prayer emoji)
    },
    cry: {
        name: "Cry",
        filename: "cry.png",
        keyPoints: ["leftShoulder", "rightShoulder", "leftWrist", "rightWrist"],
        specialGesture: "cry" // Two hands with locked/interlaced fingers
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
        document.getElementById('status').textContent = 'Models loaded! Ready to start.';
        document.getElementById('status').className = 'status success';
        document.getElementById('startBtn').disabled = false;
        console.log('Models loaded successfully');
    } catch (error) {
        console.error('Error loading models:', error);
        document.getElementById('status').textContent = 'Error loading models. Please refresh the page.';
        document.getElementById('status').className = 'status error';
    }
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
        
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        document.getElementById('status').textContent = 'Camera active. Strike a pose!';
        document.getElementById('status').className = 'status success';
        
        // Wait for video metadata to load
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Start pose detection
            detectPose();
        };
        
    } catch (error) {
        console.error('Error accessing camera:', error);
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
    
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = 'Camera stopped.';
    document.getElementById('status').className = 'status';
    
    // Reset matched meme display
    document.getElementById('matchedMeme').innerHTML = '<p class="placeholder">No match yet. Start your camera to begin!</p>';
    document.getElementById('confidence').textContent = '--';
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
                ctx.fillStyle = '#ff00ff';
                ctx.fill();
            });
            
            // Draw hand connections (mirrored)
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 1;
            
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
            ctx.fillStyle = '#00ff00';
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
    
    ctx.strokeStyle = '#00ff00';
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

// Match pose to meme (with hand and face detection)
function matchPoseToMeme(pose, handResults, faceResults) {
    let bestMatch = null;
    let bestScore = 0;
    
    // Extract keypoint positions
    const keypointPositions = {};
    pose.keypoints.forEach(kp => {
        if (kp.score > 0.5) {
            keypointPositions[kp.part] = kp.position;
        }
    });
    
    // Check each meme for similarity
    Object.keys(memeFeatures).forEach(memeId => {
        const meme = memeFeatures[memeId];
        let score = 0;
        
        // Check if key points are detected
        let detectedPoints = 0;
        meme.keyPoints.forEach(point => {
            if (keypointPositions[point]) {
                detectedPoints++;
            }
        });
        
        // Calculate score based on detected points
        const baseScore = detectedPoints / meme.keyPoints.length;
        
        // Special gesture detection (with hand detection if available)
        if (meme.specialGesture === 'thumbsup') {
            const thumbsupScore = detectThumbsUpGesture(keypointPositions, handResults);
            // Weight gesture score more heavily (70%) since it's the key differentiator
            score = (baseScore * 0.3) + (thumbsupScore * 0.7);
        
        } else if (meme.specialGesture === 'cheering') {
            const cheerScore = detectCheeringGesture(keypointPositions, handResults);
            score = (baseScore * 0.3) + (cheerScore * 0.7);
        } else if (meme.specialGesture === 'lipa') {
            const lipaScore = detectLipaGesture(handResults);
            score = (baseScore * 0.3) + (lipaScore * 0.7);
        } else if (meme.specialGesture === 'middle') {
            const midScore = detectMiddleSimple(handResults);
            score = (baseScore * 0.3) + (midScore * 0.7);
        } else if (meme.specialGesture === 'shush') {
            const shushScore = detectShushGesture(handResults, faceResults);
            score = (baseScore * 0.3) + (shushScore * 0.7);
        } else if (meme.specialGesture === 'yawning') {
            const yawnScore = detectYawningGesture(keypointPositions, faceResults);
            score = (baseScore * 0.3) + (yawnScore * 0.7);
        } else if (meme.specialGesture === 'shaq') {
            const shaqScore = detectShaqGesture(keypointPositions, handResults);
            score = (baseScore * 0.3) + (shaqScore * 0.7);
        } else if (meme.specialGesture === 'sonic') {
            const sonicScore = detectSonicGesture(keypointPositions, handResults);
            score = (baseScore * 0.3) + (sonicScore * 0.7);
        } else if (meme.specialGesture === 'cry') {
            const cryScore = detectCryGesture(keypointPositions, handResults);
            score = (baseScore * 0.3) + (cryScore * 0.7);
        } else {
            score = baseScore;
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestMatch = memeId;
        }
    });
    
    return {
        memeId: bestMatch,
        meme: memeFeatures[bestMatch],
        confidence: Math.round(bestScore * 100)
    };
}

// Detect pointing gesture (ONE hand pointing to sky with pointer finger)
// Pointing removed

// Detect thinking gesture (either hand near face)
function detectThinkingGesture(keypoints) {
    let bestScore = 0;
    const nose = keypoints['nose'];
    
    if (!nose) return 0;
    
    // Check both hands
    const hands = [keypoints['leftWrist'], keypoints['rightWrist']];
    
    hands.forEach(hand => {
        if (hand) {
            // Check if hand is near face
            const distance = Math.sqrt(
                Math.pow(hand.x - nose.x, 2) + 
                Math.pow(hand.y - nose.y, 2)
            );
            
            // If hand is close to face (within reasonable distance)
            if (distance < 150) {
                bestScore = Math.max(bestScore, 0.8);
            }
        }
    });
    
    return bestScore > 0 ? bestScore : 0.3;
}

// Detect emoji gesture (general pose, but not cheering)
function detectEmojiGesture(keypoints) {
    const leftShoulder = keypoints['leftShoulder'];
    const rightShoulder = keypoints['rightShoulder'];
    const leftWrist = keypoints['leftWrist'];
    const rightWrist = keypoints['rightWrist'];
    
    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return 0.5;
    
    // Check arm positions
    const leftRaised = leftWrist.y < leftShoulder.y;
    const rightRaised = rightWrist.y < rightShoulder.y;
    
    // For emoji (shush gesture), arms should NOT be both raised high
    // Shush is typically one hand in front of face
    if ((leftRaised && !rightRaised) || (!leftRaised && rightRaised)) {
        // Single arm up is okay for emoji
        const raisedArm = leftRaised ? leftWrist : rightWrist;
        const raisedShoulder = leftRaised ? leftShoulder : rightShoulder;
        const height = raisedShoulder.y - raisedArm.y;
        
        if (height < 50) {
            return 0.7; // Single arm moderately raised
        }
        return 0.5;
    } else if (leftRaised && rightRaised) {
        // Both arms raised - check if high (likely cheer, not emoji)
        const leftHeight = leftShoulder.y - leftWrist.y;
        const rightHeight = rightShoulder.y - rightWrist.y;
        const avgHeight = (leftHeight + rightHeight) / 2;
        
        // If BOTH arms are raised significantly, it's likely cheer
        if (avgHeight > 60) {
            return 0.2; // Very low score - definitely not emoji if arms high
        }
        return 0.4; // Both arms raised but not high
    }
    
    // Arms at sides or forward (typical for shush)
    return 0.7; // Good score for neutral position
}

// Cheer removed

// Helper function to check if index finger is extended (for pointing)
function isIndexFingerExtended(landmarks) {
    // MediaPipe hand landmarks: https://google.github.io/mediapipe/solutions/hands.html
    // 4 = index finger tip, 5-8 = index finger joints
    // 9 = middle finger MCP, 10-12 = middle finger joints, 13 = middle finger tip
    
    const indexTip = landmarks[8];
    const indexMCP = landmarks[5];
    const middleTip = landmarks[12];
    const middleMCP = landmarks[9];
    
    // Check if index finger is extended (tip is higher than MCP)
    const indexExtended = indexTip.y < indexMCP.y;
    
    // Check if other fingers are closed (tips below MCPs)
    const middleClosed = middleTip.y > middleMCP.y;
    
    return indexExtended && middleClosed;
}

// Helper function to check if thumb is up
function isThumbUp(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const thumbMCP = landmarks[2];
    
    // Thumb is up if tip is above IP joint
    return thumbTip.y < thumbIP.y && thumbTip.y < thumbMCP.y;
}

// Helper: is middle finger extended and other fingers closed
/* removed: middle gesture helpers */
function isMiddleOnlyExtended(landmarks) {
    // Middle finger: MCP 9, PIP 10, DIP 11, TIP 12
    const middleMCP = landmarks[9];
    const middlePIP = landmarks[10];
    const middleTip = landmarks[12];

    // Other fingers (Index, Ring, Pinky) MCP/TIP
    const indexMCP = landmarks[5], indexTip = landmarks[8];
    const ringMCP = landmarks[13], ringTip = landmarks[16];
    const pinkyMCP = landmarks[17], pinkyTip = landmarks[20];
    const thumbIP = landmarks[3], thumbTip = landmarks[4];

    const yMargin = 0.04; // looser tolerance for real cams

    if (!middleMCP || !middlePIP || !middleTip) return false;

    // Middle strongly extended upward (tip above PIP by margin and PIP above MCP)
    const middleExtended = (middleTip.y < middlePIP.y - Math.max(0.025, yMargin - 0.015)) && (middlePIP.y < middleMCP.y - 0.02);
    // Middle tolerance to rotation: allow larger sideways drift relative to length
    const middleDy = Math.abs(middleMCP.y - middleTip.y);
    const middleDx = Math.abs(middleMCP.x - middleTip.x);
    const middleVertical = middleDx < middleDy * 0.9; // buffer for hand rotation

    // Other fingers closed (use PIP when available to be more tolerant to curl/rotation)
    const indexClosed = !indexMCP || !indexTip || (indexTip.y > (landmarks[6] ? landmarks[6].y : indexMCP.y) - 0.02);
    const ringClosed = !ringMCP || !ringTip || (ringTip.y > (landmarks[14] ? landmarks[14].y : ringMCP.y) - 0.02);
    const pinkyClosed = !pinkyMCP || !pinkyTip || (pinkyTip.y > (landmarks[18] ? landmarks[18].y : pinkyMCP.y) - 0.02);

    // Thumb neutral or down; only reject if clearly up
    const thumbNotUp = !thumbTip || !thumbIP || (thumbTip.y > thumbIP.y - 0.01) || Math.abs(thumbTip.y - thumbIP.y) < 0.02;

    // Middle should be highest among finger tips OR the only extended finger
    const tips = [indexTip, ringTip, pinkyTip].filter(Boolean);
    const middleHighest = tips.every(t => !t || (middleTip.y <= t.y - 0.003));

    // Count extended fingers among index, middle, ring, pinky
    const isExtended = (tip, mcp, pip) => tip && (tip.y < (pip ? pip.y - 0.02 : mcp.y - 0.02));
    const indexExtended = isExtended(indexTip, indexMCP, landmarks[6]);
    const middleOnly = indexExtended === false && isExtended(middleTip, middleMCP, middlePIP) &&
                       (isExtended(ringTip, ringMCP, landmarks[14]) === false) &&
                       (isExtended(pinkyTip, pinkyMCP, landmarks[18]) === false);

    return (middleExtended && middleVertical && (middleHighest || middleOnly)) && indexClosed && ringClosed && pinkyClosed && thumbNotUp;
}

// Helper function to check if all fingers are spread/extended (cheering)
function areFingersSpread(landmarks) {
    const indexTip = landmarks[8];
    const indexMCP = landmarks[5];
    const middleTip = landmarks[12];
    const middleMCP = landmarks[9];
    const ringTip = landmarks[16];
    const ringMCP = landmarks[13];
    const pinkyTip = landmarks[20];
    const pinkyMCP = landmarks[17];
    
    // Check if all fingers are extended (tips above MCPs)
    const indexExtended = indexTip.y < indexMCP.y;
    const middleExtended = middleTip.y < middleMCP.y;
    const ringExtended = ringTip.y < ringMCP.y;
    const pinkyExtended = pinkyTip.y < pinkyMCP.y;
    
    // All fingers spread = cheering gesture
    return indexExtended && middleExtended && ringExtended && pinkyExtended;
}

// Detect thumbs up gesture (BOTH hands with thumbs up, NOT above head)
function detectThumbsUpGesture(keypoints, handResults) {
    const leftShoulder = keypoints['leftShoulder'];
    const rightShoulder = keypoints['rightShoulder'];
    const leftWrist = keypoints['leftWrist'];
    const rightWrist = keypoints['rightWrist'];
    
    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return 0;
    
    // Check if hands are NOT above head (thumbs up should be at chest/shoulder level, not overhead)
    const leftNotAboveHead = leftWrist.y >= leftShoulder.y - 20; // Not significantly above shoulders
    const rightNotAboveHead = rightWrist.y >= rightShoulder.y - 20;
    
    // Check for hand landmarks to verify thumbs up gesture
    // REQUIRE BOTH HANDS with thumbs up
    if (handResults && handResults.multiHandLandmarks) {
        // Guard: if a middle-finger or lipa gesture is present, deprioritize thumbs up
        let middlePresent = false;
        let lipaPresent = false;
        handResults.multiHandLandmarks.forEach(lm => { 
            if (isMiddleOnlyExtended(lm)) middlePresent = true; 
            if (isLipaHand(lm)) lipaPresent = true;
        });
        if (middlePresent || lipaPresent) return 0.2;

        const numHands = handResults.multiHandLandmarks.length;
        
        // Must have exactly 2 hands detected
        if (numHands >= 2) {
            let thumbsUpCount = 0;
            
            handResults.multiHandLandmarks.forEach(landmarks => {
                // Make sure it's NOT a cheering hand (all fingers spread)
                if (areFingersSpread(landmarks)) {
                    return; // Skip - this is cheer, not thumbs up
                }
                
                if (isThumbUp(landmarks)) {
                    thumbsUpCount++;
                }
            });
            
            // BOTH hands must have thumbs up AND not above head
            if (thumbsUpCount >= 2 && leftNotAboveHead && rightNotAboveHead) {
                return 0.95; // Perfect thumbs up - both hands with thumbs up, not above head
            } else if (thumbsUpCount >= 2) {
                return 0.6; // Thumbs up but might be too high
            }
        }
    }
    
    return 0.2; // Low score if requirements not met
}

// Detect cheer: both arms fully extended up and open palms (both hands spread)
function detectCheeringGesture(keypoints, handResults) {
    // Guard: if any middle-finger or lipa gesture is present, do not classify as cheer
    if (handResults && handResults.multiHandLandmarks) {
        for (const lm of handResults.multiHandLandmarks) {
            if (isMiddleOnlyExtended(lm) || isLipaHand(lm)) return 0.2;
        }
    }

    // Rule: Cheer requires TWO open palms (all fingers extended) – no height restriction
    if (!handResults || !handResults.multiHandLandmarks) return 0.2;
    const hands = handResults.multiHandLandmarks;
    if (hands.length < 2) return 0.2;

    let openCount = 0;
    hands.forEach(lm => { if (areFingersSpread(lm)) openCount++; });

    if (openCount >= 2) return 0.98;
    return 0.2;
}

// Detect two middle fingers (both hands)
// middle gesture removed
let middleWindow = [];
const MIDDLE_WINDOW = 5;
function detectMiddleSimple(handResults) {
    if (!handResults || !handResults.multiHandLandmarks) return 0.2;
    const hands = handResults.multiHandLandmarks;
    let count = 0;
    hands.forEach(lm => { if (isMiddleOnlyExtended(lm)) count++; });

    const present = count > 0 ? 1 : 0;
    middleWindow.push(present);
    if (middleWindow.length > MIDDLE_WINDOW) middleWindow.shift();
    const ratio = middleWindow.reduce((a,b)=>a+b,0) / middleWindow.length;

    if (ratio >= 0.6) return count >= 2 ? 0.99 : 0.97;
    if (count === 1) return 0.9;
    return 0.2;
}

// Helper used by both detection and disambiguation
function isLipaHand(lm) {
    const fingerExtended = (lm, tip, pip, mcp) => {
        const tipPt = lm[tip], pipPt = lm[pip], mcpPt = lm[mcp];
        if (!tipPt || !pipPt || !mcpPt) return false;
        return tipPt.y < (pipPt.y - 0.015) && pipPt.y < (mcpPt.y - 0.005);
    };
    const fingerClosed = (lm, tip, mcp) => {
        const tipPt = lm[tip], mcpPt = lm[mcp];
        if (!tipPt || !mcpPt) return true;
        return tipPt.y > (mcpPt.y - 0.02);
    };
    const indexExt = fingerExtended(lm, 8, 6, 5);
    const ringExt = fingerExtended(lm, 16, 14, 13);
    const pinkyExt = fingerExtended(lm, 20, 18, 17);
    const thumbExtOrNeutral = (() => {
        const tip = lm[4], ip = lm[3], mcp = lm[2];
        if (!tip || !ip || !mcp) return true; // accept neutral
        // treat as acceptable if extended or roughly horizontal (neutral)
        return (tip.y < ip.y - 0.01) || Math.abs(tip.y - mcp.y) < 0.02;
    })();
    const middleFolded = fingerClosed(lm, 12, 9);
    const requiredOpenCount = [indexExt, ringExt, pinkyExt, thumbExtOrNeutral].filter(Boolean).length;
    return middleFolded && requiredOpenCount >= 3; // allow one of the four to be uncertain
}

let lipaFrameWindow = [];
const LIPA_WINDOW = 5;
// Detect Lipa: one hand open on all but middle
function detectLipaGesture(handResults) {
    if (!handResults || !handResults.multiHandLandmarks) return 0.2;
    const hands = handResults.multiHandLandmarks;

    let frameHasLipa = false;
    let matchedHands = 0;
    hands.forEach(lm => { if (isLipaHand(lm)) { matchedHands++; frameHasLipa = true; } });

    // Temporal smoothing to increase robustness
    lipaFrameWindow.push(frameHasLipa ? 1 : 0);
    if (lipaFrameWindow.length > LIPA_WINDOW) lipaFrameWindow.shift();
    const ratio = lipaFrameWindow.reduce((a,b)=>a+b,0) / lipaFrameWindow.length;

    if (ratio >= 0.5) return matchedHands >= 2 ? 0.99 : 0.97;
    if (matchedHands >= 1) return 0.9;
    return 0.2;
}

// Detect yawning gesture (hands near mouth/face)
function detectYawningGesture(keypoints, faceResults) {
    // Use MediaPipe Face Mesh landmarks to detect mouth opening ratio
    if (!faceResults || !faceResults.multiFaceLandmarks || faceResults.multiFaceLandmarks.length === 0) {
        return 0.2;
    }
    const landmarks = faceResults.multiFaceLandmarks[0];
    // Landmark indices (MediaPipe Face Mesh):
    // Inner upper lip: 13, inner lower lip: 14, mouth corners: 61 (left), 291 (right)
    const upperInner = landmarks[13];
    const lowerInner = landmarks[14];
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];
    if (!upperInner || !lowerInner || !leftCorner || !rightCorner) return 0.2;

    const dx = (a,b) => a.x - b.x;
    const dy = (a,b) => a.y - b.y;
    const dist = (a,b) => Math.sqrt(dx(a,b)*dx(a,b) + dy(a,b)*dy(a,b));

    const mouthGap = dist(upperInner, lowerInner);
    const mouthWidth = dist(leftCorner, rightCorner);
    if (mouthWidth === 0) return 0.2;
    const ratio = mouthGap / mouthWidth; // Mouth Aspect Ratio

    // Heuristics: >0.35 largely open (yawn), >0.28 moderately open
    if (ratio > 0.35) return 0.95;
    if (ratio > 0.28) return 0.7;
    return 0.2;
}

// Detect shaq gesture: two hands forming a T shape (pause sign)
// One hand vertical, one hand horizontal, close together
function detectShaqGesture(keypoints, handResults) {
    if (!handResults || !handResults.multiHandLandmarks || handResults.multiHandLandmarks.length < 2) {
        return 0.2;
    }
    
    const hands = handResults.multiHandLandmarks;
    
    // Need exactly 2 hands for T shape
    if (hands.length !== 2) return 0.2;
    
    // Get wrist positions for both hands
    const wrist1 = hands[0][0]; // Wrist landmark
    const wrist2 = hands[1][0];
    
    // Calculate hand orientations by comparing vertical and horizontal spans
    function getHandOrientation(landmarks) {
        // Get bounding box of hand landmarks
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        landmarks.forEach(lm => {
            minX = Math.min(minX, lm.x);
            maxX = Math.max(maxX, lm.x);
            minY = Math.min(minY, lm.y);
            maxY = Math.max(maxY, lm.y);
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        // If height is significantly greater than width, hand is vertical
        // If width is significantly greater than height, hand is horizontal
        if (height > width * 1.3) {
            return 'vertical';
        } else if (width > height * 1.3) {
            return 'horizontal';
        }
        return 'neutral';
    }
    
    const orientation1 = getHandOrientation(hands[0]);
    const orientation2 = getHandOrientation(hands[1]);
    
    // One hand should be vertical, one horizontal
    const hasVertical = (orientation1 === 'vertical') || (orientation2 === 'vertical');
    const hasHorizontal = (orientation1 === 'horizontal') || (orientation2 === 'horizontal');
    
    if (!hasVertical || !hasHorizontal) {
        return 0.2;
    }
    
    // Calculate distance between wrists (should be relatively close for T shape)
    const dx = Math.abs(wrist1.x - wrist2.x);
    const dy = Math.abs(wrist1.y - wrist2.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize distance by hand size (use average hand bounding box)
    const hand1Size = Math.max(
        Math.max(...hands[0].map(lm => lm.x)) - Math.min(...hands[0].map(lm => lm.x)),
        Math.max(...hands[0].map(lm => lm.y)) - Math.min(...hands[0].map(lm => lm.y))
    );
    const hand2Size = Math.max(
        Math.max(...hands[1].map(lm => lm.x)) - Math.min(...hands[1].map(lm => lm.x)),
        Math.max(...hands[1].map(lm => lm.y)) - Math.min(...hands[1].map(lm => lm.y))
    );
    const avgHandSize = (hand1Size + hand2Size) / 2;
    
    const normalizedDistance = distance / (avgHandSize || 0.1);
    
    // Hands should be close together (within 2-3 hand widths for good T shape)
    if (normalizedDistance < 3.0 && hasVertical && hasHorizontal) {
        // Check if hands are roughly at the same level (for T shape, vertical hand center should intersect horizontal hand)
        const verticalHand = orientation1 === 'vertical' ? hands[0] : hands[1];
        const horizontalHand = orientation1 === 'horizontal' ? hands[0] : hands[1];
        
        const vWrist = verticalHand[0];
        const hWrist = horizontalHand[0];
        
        // Get horizontal hand's vertical range
        const hMinY = Math.min(...horizontalHand.map(lm => lm.y));
        const hMaxY = Math.max(...horizontalHand.map(lm => lm.y));
        
        // Check if vertical hand's wrist is within horizontal hand's vertical range
        const intersects = vWrist.y >= hMinY && vWrist.y <= hMaxY;
        
        if (intersects && normalizedDistance < 2.5) {
            return 0.95; // Perfect T shape
        } else if (normalizedDistance < 3.0) {
            return 0.85; // Good T shape
        } else {
            return 0.6; // Decent, but hands might be too far
        }
    }
    
    return 0.2;
}

// Detect sonic gesture: two hands pressed together (prayer emoji/high-five)
// Both hands vertical, fingers extended upward, palms pressing together
function detectSonicGesture(keypoints, handResults) {
    if (!handResults || !handResults.multiHandLandmarks || handResults.multiHandLandmarks.length < 2) {
        return 0.2;
    }
    
    const hands = handResults.multiHandLandmarks;
    
    // Need exactly 2 hands for prayer gesture
    if (hands.length !== 2) return 0.2;
    
    // Helper function to check if hand is vertical
    function isHandVertical(landmarks) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        landmarks.forEach(lm => {
            minX = Math.min(minX, lm.x);
            maxX = Math.max(maxX, lm.x);
            minY = Math.min(minY, lm.y);
            maxY = Math.max(maxY, lm.y);
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Hand is vertical if height is significantly greater than width
        return height > width * 1.1;
    }
    
    // Helper function to check if fingers are extended upward (prayer style)
    function areFingersExtendedUpward(landmarks) {
        const indexTip = landmarks[8];
        const indexMCP = landmarks[5];
        const middleTip = landmarks[12];
        const middleMCP = landmarks[9];
        const ringTip = landmarks[16];
        const ringMCP = landmarks[13];
        const pinkyTip = landmarks[20];
        const pinkyMCP = landmarks[17];
        
        // For prayer, at least 3 fingers (index, middle, ring, pinky) should be extended upward
        const indexExtended = indexTip && indexMCP && indexTip.y < indexMCP.y - 0.01;
        const middleExtended = middleTip && middleMCP && middleTip.y < middleMCP.y - 0.01;
        const ringExtended = ringTip && ringMCP && ringTip.y < ringMCP.y - 0.01;
        const pinkyExtended = pinkyTip && pinkyMCP && pinkyTip.y < pinkyMCP.y - 0.01;
        
        const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
        
        // At least 3 fingers extended (allow for thumb which may be different)
        return extendedCount >= 3;
    }
    
    // Helper function to get palm center (average of palm landmarks)
    function getPalmCenter(landmarks) {
        // Use wrist (0) and MCP joints (5, 9, 13, 17) to estimate palm center
        const palmPoints = [
            landmarks[0],  // wrist
            landmarks[5],  // index MCP
            landmarks[9],  // middle MCP
            landmarks[13], // ring MCP
            landmarks[17]  // pinky MCP
        ].filter(Boolean);
        
        if (palmPoints.length === 0) return null;
        
        const sumX = palmPoints.reduce((sum, pt) => sum + pt.x, 0);
        const sumY = palmPoints.reduce((sum, pt) => sum + pt.y, 0);
        
        return {
            x: sumX / palmPoints.length,
            y: sumY / palmPoints.length
        };
    }
    
    // Check both hands are vertical
    const hand1Vertical = isHandVertical(hands[0]);
    const hand2Vertical = isHandVertical(hands[1]);
    
    if (!hand1Vertical || !hand2Vertical) {
        return 0.2;
    }
    
    // Check both hands have fingers extended upward
    const hand1FingersExtended = areFingersExtendedUpward(hands[0]);
    const hand2FingersExtended = areFingersExtendedUpward(hands[1]);
    
    if (!hand1FingersExtended || !hand2FingersExtended) {
        return 0.2;
    }
    
    // Get palm centers and bounding boxes
    const palm1 = getPalmCenter(hands[0]);
    const palm2 = getPalmCenter(hands[1]);
    
    if (!palm1 || !palm2) {
        return 0.2;
    }
    
    // Get bounding boxes for both hands
    function getBoundingBox(landmarks) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        landmarks.forEach(lm => {
            minX = Math.min(minX, lm.x);
            maxX = Math.max(maxX, lm.x);
            minY = Math.min(minY, lm.y);
            maxY = Math.max(maxY, lm.y);
        });
        
        return { minX, maxX, minY, maxY };
    }
    
    const bbox1 = getBoundingBox(hands[0]);
    const bbox2 = getBoundingBox(hands[1]);
    
    // Check for overlap/intersection (indicates one hand might be behind the other)
    const horizontalOverlap = !(bbox1.maxX < bbox2.minX || bbox2.maxX < bbox1.minX);
    const verticalOverlap = !(bbox1.maxY < bbox2.minY || bbox2.maxY < bbox1.minY);
    const hasOverlap = horizontalOverlap && verticalOverlap;
    
    // Calculate overlap area
    let overlapArea = 0;
    if (hasOverlap) {
        const overlapWidth = Math.min(bbox1.maxX, bbox2.maxX) - Math.max(bbox1.minX, bbox2.minX);
        const overlapHeight = Math.min(bbox1.maxY, bbox2.maxY) - Math.max(bbox1.minY, bbox2.minY);
        overlapArea = overlapWidth * overlapHeight;
    }
    
    // Calculate distances
    const dx = Math.abs(palm1.x - palm2.x);
    const dy = Math.abs(palm1.y - palm2.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize by hand size
    const hand1Size = Math.max(
        Math.max(...hands[0].map(lm => lm.x)) - Math.min(...hands[0].map(lm => lm.x)),
        Math.max(...hands[0].map(lm => lm.y)) - Math.min(...hands[0].map(lm => lm.y))
    );
    const hand2Size = Math.max(
        Math.max(...hands[1].map(lm => lm.x)) - Math.min(...hands[1].map(lm => lm.x)),
        Math.max(...hands[1].map(lm => lm.y)) - Math.min(...hands[1].map(lm => lm.y))
    );
    const avgHandSize = (hand1Size + hand2Size) / 2;
    
    const normalizedDistance = distance / (avgHandSize || 0.1);
    const normalizedDX = dx / (avgHandSize || 0.1);
    const normalizedDY = dy / (avgHandSize || 0.1);
    
    // Calculate area of each hand
    const area1 = (bbox1.maxX - bbox1.minX) * (bbox1.maxY - bbox1.minY);
    const area2 = (bbox2.maxX - bbox2.minX) * (bbox2.maxY - bbox2.minY);
    const avgArea = (area1 + area2) / 2;
    const overlapRatio = avgArea > 0 ? overlapArea / avgArea : 0;
    
    // For high-five/prayer: palms pressing together means:
    // 1. Hands should be very close horizontally (X direction) - palms facing each other
    // 2. Hands should be well aligned vertically (Y direction)
    // 3. When one hand is behind the other, there should be significant overlap
    
    // If hands overlap significantly (one behind the other), relax distance requirements
    if (hasOverlap && overlapRatio > 0.3) {
        // One hand is likely behind the other - check vertical alignment and reasonable proximity
        if (normalizedDY < 0.4 && (normalizedDX < 1.2 || normalizedDistance < 1.5)) {
            return 0.95; // High confidence for overlapping hands (one behind other)
        } else if (normalizedDY < 0.5 && (normalizedDX < 1.5 || normalizedDistance < 1.8)) {
            return 0.90;
        } else if (normalizedDY < 0.6 && (normalizedDX < 1.8 || normalizedDistance < 2.0)) {
            return 0.85;
        }
    }
    
    // Standard detection for hands side by side (palms touching)
    // Perfect: palms almost touching, well aligned
    if (normalizedDX < 0.4 && normalizedDY < 0.3 && normalizedDistance < 0.5) {
        return 0.95;
    } else if (normalizedDX < 0.5 && normalizedDY < 0.4 && normalizedDistance < 0.7) {
        return 0.90;
    } else if (normalizedDX < 0.6 && normalizedDY < 0.5 && normalizedDistance < 0.9) {
        return 0.85;
    } else if (normalizedDX < 0.8 && normalizedDY < 0.6 && normalizedDistance < 1.2) {
        return 0.75;
    }
    
    return 0.2;
}

// Detect cry gesture: two hands with locked/interlaced fingers
// Hands close together, fingers interlocked (not fully extended like prayer)
function detectCryGesture(keypoints, handResults) {
    if (!handResults || !handResults.multiHandLandmarks || handResults.multiHandLandmarks.length < 2) {
        return 0.2;
    }
    
    const hands = handResults.multiHandLandmarks;
    
    // Need exactly 2 hands for locked fingers gesture
    if (hands.length !== 2) return 0.2;
    
    // Helper function to get palm center
    function getPalmCenter(landmarks) {
        const palmPoints = [
            landmarks[0],  // wrist
            landmarks[5],  // index MCP
            landmarks[9],  // middle MCP
            landmarks[13], // ring MCP
            landmarks[17]  // pinky MCP
        ].filter(Boolean);
        
        if (palmPoints.length === 0) return null;
        
        const sumX = palmPoints.reduce((sum, pt) => sum + pt.x, 0);
        const sumY = palmPoints.reduce((sum, pt) => sum + pt.y, 0);
        
        return {
            x: sumX / palmPoints.length,
            y: sumY / palmPoints.length
        };
    }
    
    // Helper function to check if fingers are in a locked/interlocked position
    // For locked fingers: fingers are bent/curved (not fully extended upward like prayer)
    // Fingers should be in a curved/interlocked state - tips may be at or below MCP level
    function areFingersInLockedPosition(landmarks) {
        const indexTip = landmarks[8];
        const indexMCP = landmarks[5];
        const indexPIP = landmarks[6];
        const middleTip = landmarks[12];
        const middleMCP = landmarks[9];
        const middlePIP = landmarks[10];
        const ringTip = landmarks[16];
        const ringMCP = landmarks[13];
        const ringPIP = landmarks[14];
        const pinkyTip = landmarks[20];
        const pinkyMCP = landmarks[17];
        
        if (!indexTip || !indexMCP || !middleTip || !middleMCP) return false;
        
        // For interlocked fingers, fingers should be bent/curved, NOT fully extended upward
        // Check that fingers are NOT in a prayer position (fully extended upward)
        const indexFullyExtended = indexTip.y < indexMCP.y - 0.03; // Fully extended (like prayer)
        const middleFullyExtended = middleTip.y < middleMCP.y - 0.03;
        const ringFullyExtended = ringTip && ringMCP && (ringTip.y < ringMCP.y - 0.03);
        const pinkyFullyExtended = pinkyTip && pinkyMCP && (pinkyTip.y < pinkyMCP.y - 0.03);
        
        // Reject if fingers are fully extended upward (that's prayer, not locked)
        const fullyExtendedCount = [indexFullyExtended, middleFullyExtended, ringFullyExtended, pinkyFullyExtended].filter(Boolean).length;
        if (fullyExtendedCount >= 3) return false; // Too many fingers extended = prayer, not locked
        
        // For locked fingers, fingers should be bent/curved
        // Tips should be at or slightly above MCP (not far above), or fingers are curved
        // Check if fingers are bent/curved (tips near or below MCP level, or curved between PIP and MCP)
        const indexBent = indexPIP && (indexTip.y >= indexMCP.y - 0.02 || (indexTip.y > indexPIP.y && indexPIP.y > indexMCP.y - 0.01));
        const middleBent = middlePIP && (middleTip.y >= middleMCP.y - 0.02 || (middleTip.y > middlePIP.y && middlePIP.y > middleMCP.y - 0.01));
        const ringBent = ringPIP && ringTip && (ringTip.y >= ringMCP.y - 0.02 || (ringTip.y > ringPIP.y && ringPIP.y > ringMCP.y - 0.01));
        const pinkyBent = pinkyTip && pinkyMCP && (pinkyTip.y >= pinkyMCP.y - 0.02);
        
        // Also check for intermediate/curved state where tip is above MCP but not far above (bent position)
        const indexCurved = indexTip.y >= indexMCP.y - 0.03 && indexTip.y < indexMCP.y + 0.05;
        const middleCurved = middleTip.y >= middleMCP.y - 0.03 && middleTip.y < middleMCP.y + 0.05;
        const ringCurved = ringTip && ringMCP && (ringTip.y >= ringMCP.y - 0.03 && ringTip.y < ringMCP.y + 0.05);
        const pinkyCurved = pinkyTip && pinkyMCP && (pinkyTip.y >= pinkyMCP.y - 0.03 && pinkyTip.y < pinkyMCP.y + 0.05);
        
        // At least 2-3 fingers should be in bent/curved position (typical for interlocked fingers)
        const bentCount = [indexBent, middleBent, ringBent, pinkyBent].filter(Boolean).length;
        const curvedCount = [indexCurved, middleCurved, ringCurved, pinkyCurved].filter(Boolean).length;
        
        // Accept if at least 2 fingers are bent or curved (interlocked position)
        return bentCount >= 2 || curvedCount >= 2;
    }
    
    // Get palm centers
    const palm1 = getPalmCenter(hands[0]);
    const palm2 = getPalmCenter(hands[1]);
    
    if (!palm1 || !palm2) {
        return 0.2;
    }
    
    // Get bounding boxes
    function getBoundingBox(landmarks) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        landmarks.forEach(lm => {
            minX = Math.min(minX, lm.x);
            maxX = Math.max(maxX, lm.x);
            minY = Math.min(minY, lm.y);
            maxY = Math.max(maxY, lm.y);
        });
        
        return { minX, maxX, minY, maxY };
    }
    
    const bbox1 = getBoundingBox(hands[0]);
    const bbox2 = getBoundingBox(hands[1]);
    
    // Check for overlap (hands might be overlapping when interlocked)
    const horizontalOverlap = !(bbox1.maxX < bbox2.minX || bbox2.maxX < bbox1.minX);
    const verticalOverlap = !(bbox1.maxY < bbox2.minY || bbox2.maxY < bbox1.minY);
    const hasOverlap = horizontalOverlap && verticalOverlap;
    
    // Calculate distances
    const dx = Math.abs(palm1.x - palm2.x);
    const dy = Math.abs(palm1.y - palm2.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize by hand size
    const hand1Size = Math.max(
        Math.max(...hands[0].map(lm => lm.x)) - Math.min(...hands[0].map(lm => lm.x)),
        Math.max(...hands[0].map(lm => lm.y)) - Math.min(...hands[0].map(lm => lm.y))
    );
    const hand2Size = Math.max(
        Math.max(...hands[1].map(lm => lm.x)) - Math.min(...hands[1].map(lm => lm.x)),
        Math.max(...hands[1].map(lm => lm.y)) - Math.min(...hands[1].map(lm => lm.y))
    );
    const avgHandSize = (hand1Size + hand2Size) / 2;
    
    const normalizedDistance = distance / (avgHandSize || 0.1);
    const normalizedDX = dx / (avgHandSize || 0.1);
    const normalizedDY = dy / (avgHandSize || 0.1);
    
    // Check if fingers are in locked position for both hands
    const hand1Locked = areFingersInLockedPosition(hands[0]);
    const hand2Locked = areFingersInLockedPosition(hands[1]);
    
    // For locked fingers: hands should be close together (palms near each other for interlocking)
    // Similar to sonic but fingers don't need to be fully extended upward
    
    // If hands overlap significantly, relax distance requirements
    if (hasOverlap) {
        const area1 = (bbox1.maxX - bbox1.minX) * (bbox1.maxY - bbox1.minY);
        const area2 = (bbox2.maxX - bbox2.minX) * (bbox2.maxY - bbox2.minY);
        const avgArea = (area1 + area2) / 2;
        const overlapWidth = Math.min(bbox1.maxX, bbox2.maxX) - Math.max(bbox1.minX, bbox2.minX);
        const overlapHeight = Math.min(bbox1.maxY, bbox2.maxY) - Math.max(bbox1.minY, bbox2.minY);
        const overlapArea = overlapWidth * overlapHeight;
        const overlapRatio = avgArea > 0 ? overlapArea / avgArea : 0;
        
        if (overlapRatio > 0.25 && hand1Locked && hand2Locked) {
            // Hands overlapping with locked finger positions
            if (normalizedDY < 0.5 && normalizedDistance < 1.5) {
                return 0.95;
            } else if (normalizedDY < 0.6 && normalizedDistance < 1.8) {
                return 0.90;
            }
        }
    }
    
    // Standard detection: hands close together with locked finger positions
    if (hand1Locked && hand2Locked) {
        if (normalizedDX < 0.6 && normalizedDY < 0.4 && normalizedDistance < 0.8) {
            return 0.95; // Perfect locked fingers
        } else if (normalizedDX < 0.8 && normalizedDY < 0.5 && normalizedDistance < 1.0) {
            return 0.90;
        } else if (normalizedDX < 1.0 && normalizedDY < 0.6 && normalizedDistance < 1.2) {
            return 0.85;
        } else if (normalizedDX < 1.2 && normalizedDY < 0.7 && normalizedDistance < 1.5) {
            return 0.75;
        }
    }
    
    return 0.2;
}

// Detect shush: eyebrow raised + index finger near lips vertically
function detectShushGesture(handResults, faceResults) {
    // Face: eyebrow raise
    let browsRaisedScore = 0.0;
    if (faceResults && faceResults.multiFaceLandmarks && faceResults.multiFaceLandmarks.length > 0) {
        const lm = faceResults.multiFaceLandmarks[0];
        // Left brow top ~ 105, right brow top ~ 334; eye top left 159, right 386
        const leftBrow = lm[105];
        const rightBrow = lm[334];
        const leftEyeTop = lm[159];
        const rightEyeTop = lm[386];
        const leftCorner = lm[61];
        const rightCorner = lm[291];
        if (leftBrow && rightBrow && leftEyeTop && rightEyeTop && leftCorner && rightCorner) {
            const dx = (a,b)=>a.x-b.x; const dy=(a,b)=>a.y-b.y; const dist=(a,b)=>Math.sqrt(dx(a,b)*dx(a,b)+dy(a,b)*dy(a,b));
            const mouthWidth = dist(leftCorner, rightCorner) || 1.0;
            const leftGap = (leftEyeTop.y - leftBrow.y); // positive if brow above eye
            const rightGap = (rightEyeTop.y - rightBrow.y);
            const norm = (leftGap + rightGap) / 2; // normalized by mouth width for scale invariance
            const normGap = norm / mouthWidth;
            if (normGap > 0.20) browsRaisedScore = 0.9; // strong raise
            else if (normGap > 0.12) browsRaisedScore = 0.6; // moderate
        }
    }

    // Hand: index finger near lips (landmarks 8 around lips center ~ between 13 and 14)
    let fingerNearLipsScore = 0.0;
    if (handResults && handResults.multiHandLandmarks && faceResults && faceResults.multiFaceLandmarks && faceResults.multiFaceLandmarks.length>0) {
        const face = faceResults.multiFaceLandmarks[0];
        const upperInner = face[13];
        const lowerInner = face[14];
        const lipsCenter = upperInner && lowerInner ? { x: (upperInner.x+lowerInner.x)/2, y:(upperInner.y+lowerInner.y)/2 } : null;
        const leftCorner = face[61];
        const rightCorner = face[291];
        const dx = (a,b)=>a.x-b.x; const dy=(a,b)=>a.y-b.y; const dist=(a,b)=>Math.sqrt(dx(a,b)*dx(a,b)+dy(a,b)*dy(a,b));
        const mouthWidth = (leftCorner && rightCorner) ? dist(leftCorner,rightCorner) : 0.2;
        handResults.multiHandLandmarks.forEach(lm => {
            const indexTip = lm[8];
            const indexMCP = lm[5];
            if (indexTip && indexMCP && lipsCenter) {
                const proximity = dist(indexTip, lipsCenter) / (mouthWidth || 0.2);
                const vertical = indexTip.y < indexMCP.y - 0.01; // finger pointing up
                if (proximity < 0.5 && vertical) {
                    fingerNearLipsScore = Math.max(fingerNearLipsScore, 0.9);
                } else if (proximity < 0.8 && vertical) {
                    fingerNearLipsScore = Math.max(fingerNearLipsScore, 0.6);
                }
            }
        });
    }

    // Combine
    if (browsRaisedScore >= 0.8 && fingerNearLipsScore >= 0.8) return 0.92;
    if (browsRaisedScore >= 0.6 && fingerNearLipsScore >= 0.6) return 0.75;
    return Math.max(0.2, Math.min(browsRaisedScore, fingerNearLipsScore));
}

// Joker removed

// Display matched meme
function displayMatchedMeme(match) {
    const matchedMemeDiv = document.getElementById('matchedMeme');
    const confidenceSpan = document.getElementById('confidence');
    
    if (match && match.confidence > 50) {
        matchedMemeDiv.innerHTML = `
            <img src="/memes/${match.meme.filename}" alt="${match.meme.name}">
        `;
        confidenceSpan.textContent = match.confidence;
        
        // Update active state in meme grid
        document.querySelectorAll('.meme-card').forEach(card => {
            card.classList.remove('active');
        });
        const activeCard = document.querySelector(`[data-meme="${match.memeId}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
        }
    } else {
        matchedMemeDiv.innerHTML = '<p class="placeholder">Try to match a pose!</p>';
        confidenceSpan.textContent = match ? match.confidence : '--';
        
        // Remove active state
        document.querySelectorAll('.meme-card').forEach(card => {
            card.classList.remove('active');
        });
    }
}

