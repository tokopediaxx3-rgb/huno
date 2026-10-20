import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try {const response=await fetch('http://127.0.0.1:4173',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error('Preview server did not become ready.');
  await mkdir('docs/previews',{recursive:true});
  browser=await chromium.launch();
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,isMobile:name==='mobile',hasTouch:name==='mobile'});
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Dashboard kelistrikan',exact:true}).waitFor();
    await page.locator('.hero-card').waitFor();
    const screenshot=await page.screenshot({type:'jpeg',quality:80,fullPage:true,animations:'disabled'});
    await writeFile('docs/previews/dashboard-'+name+'.jpg',screenshot);
    const encoded=screenshot.toString('base64');
    console.log('HUNO_PREVIEW_BEGIN '+name);
    for(let offset=0;offset<encoded.length;offset+=4096)console.log('HUNO_IMAGE_CHUNK '+encoded.slice(offset,offset+4096));
    console.log('HUNO_PREVIEW_END '+name);
    console.log('Captured '+name+' preview: '+screenshot.length+' bytes.');
    await page.getByRole('button',{name:/^Buka proyek /}).first().click();
    await page.getByRole('tab',{name:'Panduan kabel',exact:true}).click();
    await page.locator('.screen-only [data-testid="cable-guide"]').waitFor();
    const cables=await page.screenshot({type:'jpeg',quality:80,fullPage:true,animations:'disabled'});
    await writeFile('docs/previews/cable-guide-'+name+'.jpg',cables);
    const encodedCables=cables.toString('base64');
    console.log('HUNO_PREVIEW_BEGIN cables-'+name);
    for(let offset=0;offset<encodedCables.length;offset+=4096)console.log('HUNO_IMAGE_CHUNK '+encodedCables.slice(offset,offset+4096));
    console.log('HUNO_PREVIEW_END cables-'+name);
    console.log('Captured cables '+name+' preview: '+cables.length+' bytes.');
    await context.close();
  }
} finally {
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
