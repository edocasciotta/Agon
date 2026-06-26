import { execSync, spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import http from 'http'
import { shell } from 'electron'

export interface OllamaStatus {
  installed: boolean
  running: boolean
  modelReady: boolean
}

let ollamaProcess: ChildProcess | null = null

export function isOllamaInstalled(): boolean {
  try {
    if (process.platform === 'win32') {
      execSync('where ollama', { stdio: 'pipe' })
    } else {
      execSync('which ollama', { stdio: 'pipe' })
    }
    return true
  } catch {
    return false
  }
}

export function isOllamaRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434', () => {
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

export function isModelAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434/api/tags', (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const models: Array<{ name: string }> = json.models || []
          const found = models.some((m) => m.name.startsWith('llama3.2'))
          resolve(found)
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

export function startOllamaServer(): void {
  if (ollamaProcess) return
  ollamaProcess = spawn('ollama', ['serve'], {
    detached: false,
    stdio: 'pipe'
  })
  ollamaProcess.stdout?.on('data', (data) => console.log('[Ollama]', data.toString()))
  ollamaProcess.stderr?.on('data', (data) => console.error('[Ollama]', data.toString()))
  ollamaProcess.on('exit', () => {
    ollamaProcess = null
  })
}

export function pullModel(): EventEmitter {
  const emitter = new EventEmitter()
  const proc = spawn('ollama', ['pull', 'llama3.2'], { stdio: 'pipe' })

  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach((line) => emitter.emit('progress', line))
  })

  proc.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach((line) => emitter.emit('progress', line))
  })

  proc.on('exit', (code) => {
    if (code === 0) {
      emitter.emit('done')
    } else {
      emitter.emit('error', new Error(`ollama pull exited with code ${code}`))
    }
  })

  proc.on('error', (err) => emitter.emit('error', err))

  return emitter
}

export function openOllamaDownloadPage(): void {
  shell.openExternal('https://ollama.com/download')
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  const installed = isOllamaInstalled()
  if (!installed) {
    return { installed: false, running: false, modelReady: false }
  }
  const running = await isOllamaRunning()
  if (!running) {
    return { installed: true, running: false, modelReady: false }
  }
  const modelReady = await isModelAvailable()
  return { installed: true, running: true, modelReady }
}

export function killOllamaServer(): void {
  if (ollamaProcess) {
    ollamaProcess.kill()
    ollamaProcess = null
  }
}
