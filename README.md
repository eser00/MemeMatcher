# Meme Matcher 🎭

An AI/ML web app that matches your camera gestures to memes in real time. Built with TensorFlow.js (PoseNet) and MediaPipe (Hands + Face Mesh).

## Features

- 🎥 Real-time camera access
- 🤖 AI-powered pose and hand/face landmarks (PoseNet + MediaPipe Hands/Face Mesh)
- 🎯 Automatic meme matching based on gestures
- 📊 Confidence scoring for matches
- 💻 Modern, responsive web interface

## Available Memes

1. **Cheer** - Two open palms (both hands fully open)
2. **Thumbs Up** - Both hands thumbs up at or below shoulder level
3. **Lipa** - One hand: index, ring, pinky, thumb extended; middle folded
4. **Shush** - Raised eyebrows + index finger vertically over lips
5. **Yawn** - Mouth-open detection using Face Mesh mouth aspect ratio

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Modern web browser with camera access

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

4. Click "Start Camera" and allow camera access when prompted.

## How It Works

### Backend (Node.js + Express)
- Serves static files and meme images
- Provides API endpoints for future ML backend integration
- Handles CORS for local development

### Frontend (TensorFlow.js + MediaPipe)
- Accesses user's webcam in real-time
- Uses PoseNet to detect body keypoints and MediaPipe Hands/Face Mesh for fine hand/face details
- Extracts key body landmarks (shoulders, elbows, wrists, etc.) plus hands/facial landmarks
- Matches detected poses with predefined meme gestures
- Calculates confidence scores for matches
- Displays the best matching meme

### Landmark Detection
- PoseNet: 17 body keypoints (nose, shoulders, elbows, wrists, hips, knees, ankles)
- MediaPipe Hands: 21 landmarks per hand (for thumbs up, open palms, middle/lipa)
- MediaPipe Face Mesh: 468 landmarks (for yawn and shush)

### Matching Algorithm
1. Extract body, hand, and face landmarks from camera frames
2. Compute gesture-specific scores (e.g., open palm, thumbs up, mouth aspect ratio)
3. Weighted scoring per meme; select highest confidence (>50%)

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **ML Framework**: TensorFlow.js, PoseNet; MediaPipe Hands/Face Mesh
- **Backend**: Node.js, Express.js
- **Styling**: Minimalist dark UI

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari (iOS 11+)

**Note**: Camera access requires HTTPS in production or localhost for development.

## API Endpoints

- `GET /` - Main application page
- `GET /health` - Health check endpoint
- `GET /api/memes` - List available memes
- `POST /api/predict` - ML prediction endpoint (future use)

## Future Enhancements

- [ ] Add more memes and gestures
- [ ] Implement backend ML model for more complex matching
- [ ] Add multi-person detection
- [ ] Store matched poses for continuous improvement
- [ ] Add sound effects for matches
- [ ] Support for uploading custom memes
- [ ] Add pose recording and playback

## Troubleshooting

**Camera not working:**
- Check browser permissions for camera access
- Ensure you're using HTTPS or localhost
- Try a different browser

**Low match confidence:**
- Ensure good lighting
- Stand at least 2-3 feet from camera
- Make clear, distinct poses
- Face the camera directly

**Model loading slowly:**
- Check your internet connection (first-time model download)
- Model caches in browser for future use

## License

ISC

## Contributing

This is an educational ML/AI project. Feel free to fork, modify, and experiment!

