/**
 * ClipVault - Preload
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipvault', {
    // 剪切板
    getAll: (params) => ipcRenderer.invoke('clips:get-all', params),
    add: (data) => ipcRenderer.invoke('clips:add', data),
    update: (data) => ipcRenderer.invoke('clips:update', data),
    delete: (id) => ipcRenderer.invoke('clips:delete', { id }),
    copy: (id) => ipcRenderer.invoke('clips:copy', { id }),
    togglePin: (id) => ipcRenderer.invoke('clips:toggle-pin', { id }),
    addTag: (id, tag) => ipcRenderer.invoke('clips:add-tag', { id, tag }),
    removeTag: (id, tag) => ipcRenderer.invoke('clips:remove-tag', { id, tag }),
    clearAll: () => ipcRenderer.invoke('clips:clear-all'),
    exportData: () => ipcRenderer.invoke('clips:export'),
    importData: (data) => ipcRenderer.invoke('clips:import', { data }),
    getTags: () => ipcRenderer.invoke('tags:get-all'),

    // 事件
    onNewClip: (cb) => ipcRenderer.on('clip:new', (_e, clip) => cb(clip)),
    onRefresh: (cb) => ipcRenderer.on('clips:refresh', () => cb()),

    // 窗口
    minimize: () => ipcRenderer.invoke('win:min'),
    maximize: () => ipcRenderer.invoke('win:max'),
    close: () => ipcRenderer.invoke('win:close'),

    // 设置
    getSettings: () => ipcRenderer.invoke('settings:get'),
    setSetting: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
    setSettings: (obj) => ipcRenderer.invoke('settings:setMultiple', obj),
});
