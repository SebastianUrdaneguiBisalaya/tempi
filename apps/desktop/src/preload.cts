// CommonJS on purpose (.cts -> .cjs): sandboxed preloads cannot be ES modules.
import electron = require('electron');

// Only explicit, narrow bridges here - never the full `ipcRenderer` or any Node API.
electron.contextBridge.exposeInMainWorld('desktop', {
	version: process.versions.electron,
});
