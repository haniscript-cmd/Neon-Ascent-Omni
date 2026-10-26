const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

// Allow Web Audio API to play immediately without browser autoplay throttling
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createMainWindow() {
  const iconPath = path.join(__dirname, '..', 'dist', 'pwa-512x512.png');

  const win = new BrowserWindow({
    width: 600,
    height: 860,
    minWidth: 420,
    minHeight: 680,
    title: 'NEON ASCENT: OMNI',
    backgroundColor: '#04050a',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Toggle Fullscreen with F11
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
