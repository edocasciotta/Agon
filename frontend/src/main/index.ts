import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'
import {
  isOllamaInstalled,
  isOllamaRunning,
  isModelAvailable,
  startOllamaServer,
  pullModel,
  openOllamaDownloadPage,
  getOllamaStatus,
  killOllamaServer
} from './ollama'

let backendProcess: ChildProcess | null = null

function startBackend(): void {
  const backendPath = join(__dirname, '../../../backend')
  backendProcess = spawn('python3', ['-m', 'uvicorn', 'main:app', '--port', '8000', '--host', '127.0.0.1'], {
    cwd: backendPath,
    stdio: 'pipe'
  })
  backendProcess.stdout?.on('data', (data) => console.log('[Backend]', data.toString()))
  backendProcess.stderr?.on('data', (data) => console.error('[Backend]', data.toString()))
}

async function setupOllama(): Promise<void> {
  const installed = isOllamaInstalled()
  if (!installed) {
    console.log('[Ollama] Not installed — renderer will show setup UI')
    return
  }

  const running = await isOllamaRunning()
  if (!running) {
    console.log('[Ollama] Installed but not running — starting server')
    startOllamaServer()

    // Poll up to 5 seconds for the server to be ready
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const nowRunning = await isOllamaRunning()
      if (nowRunning) {
        console.log('[Ollama] Server is now running')
        break
      }
    }
  }

  const modelReady = await isModelAvailable()
  if (!modelReady) {
    console.log('[Ollama] Model not available — starting pull in background')
    const emitter = pullModel()
    emitter.on('progress', (msg: string) => console.log('[Ollama pull]', msg))
    emitter.on('done', () => console.log('[Ollama] Model pull complete'))
    emitter.on('error', (err: Error) => console.error('[Ollama] Model pull error:', err.message))
  } else {
    console.log('[Ollama] Ready')
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('ollama:getStatus', async () => getOllamaStatus())

  ipcMain.handle('ollama:openDownloadPage', () => openOllamaDownloadPage())

  ipcMain.handle('ollama:startServer', async () => {
    startOllamaServer()
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  ipcMain.handle('ollama:pull', async (event) => {
    const emitter = pullModel()
    emitter.on('progress', (msg: string) => {
      event.sender.send('ollama:pull:progress', msg)
    })
    return new Promise((resolve) => {
      emitter.on('done', () => resolve({ success: true }))
      emitter.on('error', (err: Error) => resolve({ success: false, error: err.message }))
    })
  })
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
      sandbox: false
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.agon.studio')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  if (!is.dev) startBackend()
  registerIpcHandlers()
  setupOllama() // intentionally not awaited — runs in background
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  backendProcess?.kill()
  killOllamaServer()
  if (process.platform !== 'darwin') app.quit()
})
