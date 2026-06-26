import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('ollamaApi', {
      getStatus: () => ipcRenderer.invoke('ollama:getStatus'),
      openDownloadPage: () => ipcRenderer.invoke('ollama:openDownloadPage'),
      startServer: () => ipcRenderer.invoke('ollama:startServer'),
      pull: () => ipcRenderer.invoke('ollama:pull'),
      onPullProgress: (callback: (message: string) => void) => {
        ipcRenderer.on('ollama:pull:progress', (_event, message) => callback(message))
      },
      removePullProgressListeners: () => {
        ipcRenderer.removeAllListeners('ollama:pull:progress')
      }
    })
  } catch (error) {
    console.error(error)
  }
}
