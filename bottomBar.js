const { BrowserWindow, ipcMain, screen } = require('electron');
const { EventEmitter } = require('events');
const path = require('path');
const globalEmitter = require('./services/eventEmitter');

let bottomBarWindow;
const emitter = new EventEmitter();

/**
 * Creates the Bottom Bar Window
 */
async function createBottomBarWindow() {
  bottomBarWindow = new BrowserWindow({
    width: 200,
    height: 225,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    useContentSize: true,
    show: false, // Initially hide the bottom bar window
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const cursorPosition = screen.getCursorScreenPoint();
  bottomBarWindow.setBounds({
    width: 200,
    height: 225,
    x: cursorPosition.x + 60,
    y: cursorPosition.y - 400,
  });

  bottomBarWindow.setResizable(false);
  bottomBarWindow.setMovable(true);

  await bottomBarWindow.loadFile('src/bottom-bar.html');
}

/**
 * Shows the Bottom Bar Window at the current cursor position
 */
function showContextMenu() {
  const { x, y } = screen.getCursorScreenPoint();
  createBottomBarWindow();
  bottomBarWindow.setPosition(x, y);
  bottomBarWindow.show();
}

/**
 * Displays an image in a new BrowserWindow
 * @param {NativeImage} image - The image to display
 */
function displayImageInWindow(image = null) {
    let imageWidth = 800;  // Default value
    let imageHeight = 600; // Default value

    if (image && image.getSize) {
      const size = image.getSize();
      // Scale the image if it's too large
      if (size.width > 800 || size.height > 600) {
        const scale = Math.min(800 / size.width, 600 / size.height);
        imageWidth = Math.floor(size.width * scale);
        imageHeight = Math.floor(size.height * scale);
      } else {
        imageWidth = size.width / 2;
        imageHeight = size.height / 2;
      }
    }

    const { x, y } = screen.getCursorScreenPoint(); // Define x and y here

    const imageWindow = new BrowserWindow({
      width: imageWidth,
      height: imageHeight,
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      useContentSize: true,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    imageWindow.setPosition(x - imageWidth, y - imageHeight + 225);

    // Convert image to data URL if it's a NativeImage
    const imageUrl = image ? image.toDataURL() : '';

    imageWindow.loadURL(`data:text/html,<html><body style="margin:0"><img src="${imageUrl}" style="width:100%;height:100%"/></body></html>`);

    // Close the window when the Escape key is pressed
    imageWindow.on('focus', () => {
      imageWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape') {
          imageWindow.hide();
        }
      });
    });
}

/**
 * Handles IPC events related to the Bottom Bar
 */
function setupIpcHandlers() {
  ipcMain.handle('resize-bottom-bar-window', (event, { width, height }) => {
    console.log('resize-bottom-bar-window', width, height);
    if (bottomBarWindow) {
      bottomBarWindow.setSize(width, height);
    }
  });

  ipcMain.handle('close-bottom-bar-window', () => {
    if (bottomBarWindow) {
      bottomBarWindow.close();
      bottomBarWindow = null; // Promote garbage collection
    }
  });
}

globalEmitter.on('receive-screenshot', (image) => {
    displayImageInWindow(image);
    showContextMenu();
});

module.exports = {
  createBottomBarWindow,
  showContextMenu,
  setupIpcHandlers,
  displayImageInWindow,
  emitter // Export emitter to allow other modules to emit events
};