const { _electron } = require('C:/Users/Vinicius/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const old = await _electron.launch({ executablePath: require('path').resolve('../pharmaflow-pix-farma-release/0.1.9/win-unpacked/PIX Farma.exe'), args: ['--disable-gpu'], timeout:30000 });
 try { console.log(JSON.stringify(await old.evaluate(({app})=>({ name:app.name,userData:app.getPath('userData'),appData:app.getPath('appData') })))); }
 finally { await old.evaluate(({app,BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()) w.destroy(); app.exit(0);}).catch(()=>{}); await old.close().catch(()=>{}); }
})();
