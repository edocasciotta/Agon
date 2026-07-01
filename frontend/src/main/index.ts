import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import * as http from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'

let backendProcess: ChildProcess | null = null
let isQuitting = false
let restartAttempts = 0
let backendReady = false
const MAX_RESTART_ATTEMPTS = 3

app.on('before-quit', () => {
  isQuitting = true
})

function startBackend(): void {
  console.log('[Electron] Starting backend process...')
  let portConflict = false

  const backendPath = join(__dirname, '../../../backend')
  backendProcess = spawn('python3', ['-m', 'uvicorn', 'main:app', '--port', '8000', '--host', '127.0.0.1'], {
    cwd: backendPath,
    stdio: 'pipe'
  })

  backendProcess.stdout?.on('data', (data) => console.log('[Backend]', data.toString()))

  backendProcess.stderr?.on('data', (data) => {
    const text = data.toString()
    console.error('[Backend]', text)
    if (
      text.toLowerCase().includes('address already in use') ||
      text.toLowerCase().includes('error while attempting to bind')
    ) {
      portConflict = true
    }
  })

  backendProcess.on('exit', (code) => {
    console.log(`[Electron] Backend process exited with code ${code}`)

    if (isQuitting) return

    if (portConflict) {
      dialog.showErrorBox(
        'Agon — Port Conflict',
        'Port 8000 is already in use. Please close the application using that port and restart Agon.'
      )
      app.quit()
      return
    }

    if (backendReady && code !== 0) {
      if (restartAttempts < MAX_RESTART_ATTEMPTS) {
        restartAttempts++
        const delayMs = Math.pow(2, restartAttempts - 1) * 1000 // 1s, 2s, 4s
        console.log(`[Electron] Restarting backend (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`)
        setTimeout(() => {
          startBackend()
        }, delayMs)
      } else {
        console.log('[Electron] Backend failed to restart after 3 attempts')
        dialog.showErrorBox(
          'Agon — Backend Error',
          'The backend service has crashed repeatedly. Please restart Agon.'
        )
        app.quit()
      }
    }
  })
}

function waitForBackend(maxWaitMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    function attempt(): void {
      http
        .get('http://127.0.0.1:8000/health', (res) => {
          if (res.statusCode === 200) {
            backendReady = true
            restartAttempts = 0
            console.log('[Electron] Backend ready')
            resolve()
          } else if (Date.now() - start < maxWaitMs) {
            setTimeout(attempt, 500)
          } else {
            reject(new Error('Backend did not start within 30 seconds'))
          }
        })
        .on('error', () => {
          if (Date.now() - start < maxWaitMs) {
            setTimeout(attempt, 500)
          } else {
            reject(new Error('Backend did not start within 30 seconds'))
          }
        })
    }
    attempt()
  })
}

function registerIpcHandlers(): void {
  // IPC handlers reserved for future use
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.agon.studio')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  if (!is.dev) {
    startBackend()
    try {
      await waitForBackend()
    } catch (err) {
      dialog.showErrorBox(
        'Agon — Backend Error',
        'The backend service did not start within 30 seconds. Please restart the application.'
      )
      app.quit()
      return
    }
  }
  registerIpcHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  backendProcess?.kill()
  if (process.platform !== 'darwin') app.quit()
})
