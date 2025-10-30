const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/memes', express.static('memes'));

// Configure multer for file uploads (if needed for future features)
const upload = multer({ dest: 'uploads/' });

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'MemeMatcher API is running' });
});

// API endpoint to get available memes
app.get('/api/memes', (req, res) => {
    const memes = [
        { id: 'cheer', filename: 'cheer.webp' },
        { id: 'emoji', filename: 'emoji.jpg' },
        { id: 'monkey_point', filename: 'monkey_point.jpg' },
        { id: 'monkey_think', filename: 'monkey_think.jpeg' },
        { id: 'thumbsup', filename: 'thumbsup.png' },
        { id: 'yawn', filename: 'yawn.jpg' }
    ];
    res.json(memes);
});

// ML prediction endpoint (placeholder for now)
app.post('/api/predict', (req, res) => {
    // This will be integrated with PoseNet in the frontend
    // For now, return a mock response
    res.json({ 
        matchedMeme: 'emoji',
        confidence: 0.85,
        message: 'ML model processing will happen in frontend'
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

