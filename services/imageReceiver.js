const express = require('express');
const multer = require('multer');
const app = express();
const port = 3000;
const globalEmitter = require('./eventEmitter');
const { nativeImage } = require('electron');
const { clipboard } = require('electron');

// Multer setup for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/receive-image', upload.single('screenshot'), (req, res) => {
    const image = req.file;
    if (image) {
        const nativeImageObj = nativeImage.createFromBuffer(image.buffer);
        nativeImageObj.resize({ height: 300 });
        clipboard.writeImage(nativeImageObj);
        globalEmitter.emit('receive-screenshot', nativeImageObj);
    } else {
        console.log('No image received');
    }
    res.send('Image received');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = globalEmitter;

