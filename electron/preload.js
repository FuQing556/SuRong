// preload.js — 预加载脚本（为未来 IPC 通信预留）
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
