import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('hudBridge', {
  setIgnoreMouse: (ignore: boolean) => {
    ipcRenderer.send('hud:setIgnoreMouse', ignore)
  },
  setAnswerHover: (hovering: boolean) => {
    ipcRenderer.send('hud:answerHover', hovering)
  }
})
