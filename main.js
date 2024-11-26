const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, shell, clipboard, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { analyzeScreenshot, analyzeInput, rewriteContent } = require('./services/openai');
const imageReceiver = require('./services/imageReceiver');
const bottomBar = require('./bottomBar');
const globalEmitter = require('./services/eventEmitter');

let mainWindow;
let spinnerWindow = null;
let isWindowVisible = false;
let screenshotArea = { x: 100, y: 100, width: 500, height: 500 };
const isDev = !app.isPackaged;
let previousText = '';
let previousImage = null;
let isFirstCheck = true;

function checkClipboard() {
  const currentText = clipboard.readText();
  const clipboardFormats = clipboard.availableFormats();
  if (clipboardFormats.includes('text/plain')) {
    if (currentText !== previousText) {
      previousText = currentText;
      if (isFirstCheck) return isFirstCheck = false;
      bottomBar.showContextMenu();
    }
  } else if (clipboardFormats.includes('image/png') || clipboardFormats.includes('image/jpeg')) {
    const currentImage = clipboard.readImage();
    if (!currentImage.isEmpty() && currentImage.toDataURL() !== previousImage) {
      previousImage = currentImage.toDataURL();
      if (isFirstCheck) return isFirstCheck = false;
      bottomBar.showContextMenu();
      bottomBar.displayImageInWindow(currentImage);
    }
  }
}

setInterval(checkClipboard, 200);

async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    transparent: true,
    frame: false,
    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        preload: path.join(__dirname, 'preload.js')
    }
  });  

  if (isDev) {
    try {
      await mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } catch (e) {
      console.error('Failed to load dev server:', e);
    }
  } else {
    await mainWindow.loadFile('index.html');
  }

  mainWindow.hide();
}

bottomBar.setupIpcHandlers();

app.whenReady().then(() => {
  bottomBar.createBottomBarWindow();
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (!mainWindow) {
      createWindow();
    }
    if (isWindowVisible) {
      mainWindow.hide();
      isWindowVisible = false;
    } else {
      mainWindow.show();
      isWindowVisible = true;
    }
  });

  globalShortcut.register('Control+Z', () => {
    showContextMenu();
  });

  globalShortcut.register('Control+A', () => {
    bottomBar.showContextMenu();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('activate');
  }
});

ipcMain.handle('take-screenshot', async (event) => {
  try {
    const { x, y, width, height } = screenshotArea;
    console.log(x, y, width, height);
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: screenWidth,
        height: screenHeight
      }
    });
    
    const imgPath = path.join(__dirname, `screenshot.png`);
    const source = sources[0];
    if (source.thumbnail) {
      const nativeImage = source.thumbnail.crop({ x, y, width, height });
      await fs.promises.writeFile(imgPath, nativeImage.toPNG());
    }
    
    return imgPath;
  } catch (error) {
    console.error('Screenshot error:', error);
    throw error;
  }
});

ipcMain.handle('update-screenshot-area', async (event, area) => {
    console.log('update-screenshot-area', area);
    screenshotArea = { ...area };
});

ipcMain.handle('show-screenshot', async (event, { imgPath, bounds }) => {
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const absoluteImgPath = path.resolve(imgPath);
  
  if (isDev) {
    await win.loadURL('http://localhost:3000/src/screenshot-viewer.html');
  } else {
    await win.loadFile('src/screenshot-viewer.html');
  }
  
  await win.webContents.executeJavaScript(`
    document.getElementById('screenshot').src = 'file://${absoluteImgPath}';
  `);
});

ipcMain.handle('apply-blur', () => {
  mainWindow.webContents.executeJavaScript(`
    document.body.classList.add('dark-overlay');
  `);
});

ipcMain.handle('close-main-window', () => {
  if (mainWindow) {
    mainWindow.hide();
    isWindowVisible = false;
  }
  mainWindow.webContents.executeJavaScript(`
    document.body.classList.remove('dark-overlay');
  `);
  return;
});

ipcMain.handle('analyze-screenshot', async (event, imgBase64) => {
  try {
    const result = await analyzeScreenshot(imgBase64);
    return result; 
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
});

ipcMain.handle('show-analysis-result', async (event, data) => {
  const { width, height } = screen.getPrimaryDisplay().size;
  const parsedData = JSON.parse(data).areas;
  const resultWindow = new BrowserWindow({
      width: width,
      height: height,
      transparent: true,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        preload: path.join(__dirname, 'preload.js')
      }
  });

  await resultWindow.loadFile('screenshot-result.html');
  console.dir(parsedData, { depth: null });
  await resultWindow.webContents.executeJavaScript(`
    displayAreas(${JSON.stringify(parsedData)});
  `);
});

ipcMain.handle('take-full-screenshot', async (event) => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: screenWidth,
        height: screenHeight
      }
    });
    
    const imgPath = path.join(__dirname, `screenshot-full.png`);
    const source = sources[0];
    if (source.thumbnail) {
      await fs.promises.writeFile(imgPath, source.thumbnail.toPNG());
    }
    
    return imgPath;
  } catch (error) {
    console.error('Full screenshot error:', error);
    throw error;
  }
});

// Function to create spinner window with dynamic size
async function createSpinnerWindow(width = 400, height = 480) {
  if (spinnerWindow && !spinnerWindow.isDestroyed()) {
    spinnerWindow.show();
    spinnerWindow.webContents.send('reset-spinner');
    return;
  }

  spinnerWindow = new BrowserWindow({
    width: width,
    height: height,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    movable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  const { x, y } = screen.getCursorScreenPoint();
  spinnerWindow.setPosition(x + 300, y);

  await spinnerWindow.loadFile('src/spinner.html');

  spinnerWindow.on('closed', () => {
    spinnerWindow = null;
  });
}

// IPC handler to open spinner with dynamic size
ipcMain.handle('open-spinner', async (event) => {
  await createSpinnerWindow(400, 480);
});

ipcMain.handle('analyze-input', async (event, {prompt, model}) => {
  let input = null;
  
  const clipboardFormats = clipboard.availableFormats();
  if (!spinnerWindow || spinnerWindow.isDestroyed()) {
    await createSpinnerWindow();
  }

  if (clipboardFormats.includes('text/plain')) {
    let currentText = clipboard.readText();
    if (prompt.includes(currentText)) {
      currentText = "";
    }
    input = {type:"text", prompt: prompt + "\n"+currentText}
  } else if (clipboardFormats.includes('image/png') || clipboardFormats.includes('image/jpeg')) {
    const currentImage = clipboard.readImage();
    previousImage = currentImage.toDataURL();
    input = {type:"image", prompt: prompt, image: currentImage}
  }

  try {
    spinnerWindow.webContents.send('api-response', { type: 'progress', message: ""});
    console.log(model);

    let result;
    if (model.includes('gpt')) {
        result = await analyzeInput(input, model);
    } else if (model.includes('claude')) {
        const { analyze } = require('./services/claude.js');
        result = await analyze(input,model);
    } else if (model.includes('gemini')) {
        // Placeholder for gemini model analysis
        result = 'Gemini model analysis not implemented yet.';
    } else {
        throw new Error('Unknown model type');
    }
    
    if (spinnerWindow && !spinnerWindow.isDestroyed()) {
      spinnerWindow.webContents.send('api-response', { type: 'complete', message: result, input: JSON.parse(JSON.stringify(input)), model });
    }
  } catch (error) {
    if (spinnerWindow && !spinnerWindow.isDestroyed()) {
      spinnerWindow.webContents.send('api-response', { type: 'error', message: error.message });
    }
    throw error;
  }
});

ipcMain.handle('rewrite-content', async (event, { content, instruction }) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  senderWindow.webContents.send('api-response', { type: 'progress', message: "" });
  
  try {
    const result = await rewriteContent({ content, instruction });
    senderWindow.webContents.send('api-response', { type: 'complete', message: result });
    return result;
  } catch (error) {
    senderWindow.webContents.send('api-response', { type: 'error', message: error.message });
    throw error;
  }
});
ipcMain.handle('window-resize', async (event, {height, width}) => {
  console.log('window-resize', height, width);
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  senderWindow.setSize(width, height);
  senderWindow.webContents.send('api-response', { type: 'resize', message: `Window resized to ${width}x${height}` });
});



function showToast(message) {
  const { BrowserWindow } = require('electron');
  const toastWindow = new BrowserWindow({
    width: 300,
    height: 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  toastWindow.loadURL(`data:text/html;charset=utf-8,
    <style>
      body {
        margin: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 14px;
        padding: 10px;
        border-radius: 5px;
      }
    </style>
    <body>${message}</body>
  `);

  setTimeout(() => {
    toastWindow.close();
  }, 2000);
}
