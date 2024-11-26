const { ipcRenderer } = require('electron');
const path = require('path');
const { promises: fsPromises } = require('fs');

let isDrawing = false;
let startX, startY, areaStartX, areaStartY;
let selectedArea = { x: 0, y: 0, width: 0, height: 0 };
const overlay = document.getElementById('selection-overlay');

window.addEventListener('mousedown', (e) => {
    isDrawing = true;
    startX = e.screenX;
    startY = e.screenY;

    areaStartX = e.clientX;
    areaStartY = e.clientY;
    
    overlay.style.left = `${areaStartX}px`;
    overlay.style.top = `${areaStartY}px`;
    overlay.style.display = 'block';
});

window.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    
    const currentX = e.screenX;
    const currentY = e.screenY;
    
    selectedArea = {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY)
    };
    
    ipcRenderer.invoke('update-screenshot-area', selectedArea);
    
    overlay.style.left = `${areaStartX}px`;
    overlay.style.top = `${areaStartY}px`;
    overlay.style.width = `${e.clientX - areaStartX}px`;
    overlay.style.height = `${e.clientY - areaStartY}px`;
    
});

window.addEventListener('mouseup', async () => {
    isDrawing = false;
    overlay.style.display = 'none';
    const imgPath = await ipcRenderer.invoke('take-screenshot');
    
    // スクリーンショット後にブラー効果を適用
    await ipcRenderer.invoke('apply-blur');
    
    document.getElementById('result').innerHTML = `Screenshot saved: ${imgPath}`;
        
    // 新しいウィンドウを開いて画像を表示
    await ipcRenderer.invoke('show-screenshot', {
      imgPath: imgPath,
      bounds: {
        x: selectedArea.x,
        y: selectedArea.y,
        width: selectedArea.width,
        height: selectedArea.height
      }
    });
});

// document.getElementById('screenshot-btn').addEventListener('click', async () => {
//   try {
//     const imgPath = await ipcRenderer.invoke('take-screenshot');
    
//     // 新しいウィンドウを開いて画像を表示
//     await ipcRenderer.invoke('show-screenshot', {
//       imgPath: imgPath,
//       bounds: {
//         x: selectedArea.x,
//         y: selectedArea.y,
//         width: selectedArea.width,
//         height: selectedArea.height
//       }
//     });
//   } catch (error) {
//     console.error('Screenshot error:', error);
//     document.getElementById('result').innerHTML = 'Screenshot failed';
//   }
// });

// document.getElementById('suggestion-btn').addEventListener('click', async () => {
//   console.log('suggestion-btn clicked');
//   try {
//     await ipcRenderer.invoke('take-full-screenshot');
//     const imagePath = path.join(__dirname, '..', 'screenshot-full.png');
//     const imageBuffer = await fsPromises.readFile(imagePath);
//     const base64Image = imageBuffer.toString('base64');

//     // 画像データを使用して分析を実行
//     const data = await ipcRenderer.invoke('analyze-screenshot', base64Image);

//     // 結果を表示
//     await ipcRenderer.invoke('show-analysis-result', data);
//   } catch (error) {
//     console.error('Suggestion error:', error);
//     document.getElementById('result').innerHTML = 'Suggestion failed';
//   }
// });
