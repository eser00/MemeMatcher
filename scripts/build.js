const fs = require('fs');
const path = require('path');

// Create build directory
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// Function to copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

// Copy public folder contents to build root (for GitHub Pages)
console.log('Copying public folder contents to build root...');
const publicDir = path.join(__dirname, '..', 'public');
const publicFiles = fs.readdirSync(publicDir);
publicFiles.forEach(file => {
    const srcPath = path.join(publicDir, file);
    const destPath = path.join(buildDir, file);
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
        copyDir(srcPath, destPath);
    } else {
        fs.copyFileSync(srcPath, destPath);
    }
});

// Copy memes folder
console.log('Copying memes folder...');
const memesDir = path.join(__dirname, '..', 'memes');
const buildMemesDir = path.join(buildDir, 'memes');
if (fs.existsSync(memesDir)) {
    copyDir(memesDir, buildMemesDir);
}

console.log('Build completed successfully!');
