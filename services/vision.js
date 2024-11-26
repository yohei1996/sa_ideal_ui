const vision = require('@google-cloud/vision');
const path = require('path');

// Google Cloud Visionクライアントの作成
const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, '../make-integration-388404-7b1bf238df12.json')
});

async function detectText(imageBuffer) {
  const [result] = await client.textDetection(imageBuffer);
  const detections = result.textAnnotations;

  // テキストと座標情報を抽出
  const areas = detections.map(detection => ({
    type: 'text',
    content: detection.description,
    coordinates: {
      x: detection.boundingPoly.vertices[0].x,
      y: detection.boundingPoly.vertices[0].y,
      width: detection.boundingPoly.vertices[1].x - detection.boundingPoly.vertices[0].x,
      height: detection.boundingPoly.vertices[2].y - detection.boundingPoly.vertices[0].y
    }
  }));

  return areas;
}

module.exports = {
  detectText
}; 