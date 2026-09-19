const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    fetchNovel: (ncode) => ipcRenderer.invoke('fetch-novel', ncode),
    cancelFetchNovel: () => ipcRenderer.send('cancel-fetch-novel'), // ★追加
    saveFiles: (data) => ipcRenderer.invoke('save-files', data),
    onMeta: (callback) => {
        ipcRenderer.removeAllListeners('fetch-meta');
        ipcRenderer.on('fetch-meta', (event, value) => callback(value));
    },
    onProgress: (callback) => {
        ipcRenderer.removeAllListeners('fetch-progress');
        ipcRenderer.on('fetch-progress', (event, value) => callback(value));
    },
    onSaveProgress: (callback) => {
        ipcRenderer.removeAllListeners('save-progress');
        ipcRenderer.on('save-progress', (event, value) => callback(value));
    }
});
