const fs=require('fs'); const path=require('path'); const {_electron}=require('C:/Users/Vinicius/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd();
(async()=>{
 const qa=path.join(root,'.client-build','qa'); const data=path.join(qa,'app-data');
 const config={host:'127.0.0.1',port:1,user:'qa_whitelabel',password:'qa_sintetica',database:'qa_whitelabel'};
 fs.mkdirSync(path.join(data,'pharmaflow'),{recursive:true}); fs.writeFileSync(path.join(data,'pharmaflow','config.json'),JSON.stringify(config));
 const scenarios=[['anterior',path.resolve('../pharmaflow-pix-farma-release/0.1.9/win-unpacked/resources/app.asar')],['pix-farma',path.resolve('release/pix-farma/0.2.0/win-unpacked/resources/app.asar')],['generic',path.resolve('release/generic/0.2.0/win-unpacked/resources/app.asar')]];
 for(const [id,asar] of scenarios){
  const dir=path.join(qa,'runner-'+id); fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'pharmaflow',version:id==='anterior'?'0.1.9':'0.2.0',type:'module',main:'main.mjs'}));
  fs.writeFileSync(path.join(dir,'main.mjs'),`import {app} from 'electron'; import path from 'node:path'; app.setPath('appData',${JSON.stringify(data)}); app.setPath('userData',path.join(app.getPath('appData'),'pharmaflow')); await import(${JSON.stringify('file:///'+asar.replaceAll('\\','/')+'/dist-electron/main.js')});`);
  const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[dir,'--disable-gpu'],timeout:30000});
  try{
   const win=await app.firstWindow(); await win.waitForLoadState('domcontentloaded');
   console.log(id,JSON.stringify(await app.evaluate(({app})=>({name:app.name,userData:app.getPath('userData'),version:app.getVersion(),sessionData:app.getPath('sessionData')}))));
   const c=await win.evaluate(()=>window.electronAPI.getConfig()); console.log('config',JSON.stringify(c));
   if(id!=='generic') require('assert').deepStrictEqual(c,{host:config.host,port:config.port,user:config.user,database:config.database});
   else require('assert').strictEqual(c.database,'');
   await win.waitForFunction(()=>[...document.querySelectorAll('.max-w-md')].every(el=>getComputedStyle(el).opacity==='1')); await win.evaluate(()=>document.fonts.ready); await win.screenshot({path:path.join(qa,id+'-login.png')});
   if(id!=='anterior') console.log('visual',JSON.stringify(await win.evaluate(()=>({title:document.title,client:document.documentElement.dataset.client,font:getComputedStyle(document.body).fontFamily,primary:getComputedStyle(document.documentElement).getPropertyValue('--pf-primary'),images:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0}))}))));
   if(id==='generic') {
    const mainSource=fs.readFileSync('electron/main.ts','utf8');
    const login=mainSource.match(/const MASTER_USERNAME = '([^']+)'/)[1]; const password=mainSource.match(/const MASTER_PASSWORD = '([^']+)'/)[1];
    await win.locator('input[type=text]').fill(login); await win.locator('input[type=password]').fill(password); await win.getByRole('button',{name:'Entrar',exact:true}).click();
    await win.getByRole('button',{name:'Testar Conexão',exact:true}).waitFor();
    await win.waitForFunction(()=>[...document.querySelectorAll('[style]')].every(el=>getComputedStyle(el).opacity==='1')); await win.evaluate(()=>document.fonts.ready); await win.screenshot({path:path.join(qa,'generic-settings.png')});
    console.log('Genérico: fluxo de configuração acessível, logo branca e fonte local carregadas.');
   }
  }finally{await app.evaluate(({app,BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()) w.destroy(); app.exit(0)}).catch(()=>{}); await app.close().catch(()=>{});}
 }
 require('assert').deepStrictEqual(JSON.parse(fs.readFileSync(path.join(data,'pharmaflow','config.json'))),config);
 console.log('Configuração sintética PIX preservada antes/depois; genérico isolado.');
})();
