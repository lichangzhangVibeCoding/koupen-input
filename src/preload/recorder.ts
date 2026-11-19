import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('recBridge', {
  started: (payload: { requestId: string }) => {
    ipcRenderer.send('voice:recorder-started', payload)
  },
  result: (payload: {
    requestId: string
    ok: boolean
    bytes?: number[]
    pcmB64?: string
    mime?: string
    error?: string
  }) => {
    ipcRenderer.send('voice:recorder-result', payload)
  },
  pcm: (payload: { requestId: string; bytes: number[] }) => {
    ipcRenderer.send('voice:recorder-pcm', payload)
  }
})
