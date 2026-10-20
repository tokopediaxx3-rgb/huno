import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function planStrip(page: Page) {
  await page.goto('/');
  await page.getByRole('button',{name:'Proyek baru',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nama proyek',{exact:true}).fill('Booth Uji');
  await dialog.getByRole('button',{name:'Buat proyek',exact:true}).click();
  await page.getByRole('button',{name:'Tambah LED',exact:true}).click();
  await page.getByLabel('Panjang rangkaian 1',{exact:true}).fill('5');
  await page.getByLabel('Daya satuan rangkaian 1',{exact:true}).fill('14.4');
  await expect(page.getByTestId('project-total-watts')).toHaveText('72');
}

test('72 W selects a 100 W PSU and the project survives reload',async({page})=>{
  await planStrip(page);
  await page.getByRole('tab',{name:'Power supply',exact:true}).click();
  await expect(page.locator('.supply-card')).toHaveCount(1);
  await expect(page.getByLabel('Model PSU 1').locator('option:checked')).toContainText('100');
  await expect(page.getByLabel('Model PSU 1').locator('option:checked')).toContainText('24');
  await page.reload();
  await page.getByRole('button',{name:'Buka proyek Booth Uji',exact:true}).click();
  await expect(page.getByTestId('project-total-watts')).toHaveText('72');
});

test('manual PSU overload is flagged and manual choices persist',async({page})=>{
  await planStrip(page);
  await page.getByLabel('Panjang rangkaian 1',{exact:true}).fill('10');
  await page.getByRole('tab',{name:'Power supply',exact:true}).click();
  const select=page.getByLabel('Model PSU 1');
  const value=await select.locator('option').evaluateAll(options=>options.find(o=>/24\s*V/.test(o.textContent??'')&&/100\s*W/.test(o.textContent??''))?.getAttribute('value'));
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  await expect(page.locator('.supply-card .badge-error')).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('huno-led-planner-v1')!).projects.find((p:{name:string})=>p.name==='Booth Uji'));
  expect(stored.mode).toBe('manual');
  await page.reload();
  await page.getByRole('button',{name:'Buka proyek Booth Uji',exact:true}).click();
  await page.getByRole('tab',{name:'Power supply',exact:true}).click();
  await expect(page.getByLabel('Model PSU 1')).toHaveValue(value!);
  await expect(page.locator('.supply-card .badge-error')).toBeVisible();
});

test('backup exports and restores projects after explicit confirmation',async({page})=>{
  await planStrip(page);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Ekspor cadangan',exact:true}).click();
  const download=await downloadPromise;
  const backup=await readFile((await download.path())!,'utf8');
  expect(JSON.parse(backup).projects.some((p:{name:string})=>p.name==='Booth Uji')).toBe(true);
  await page.getByRole('button',{name:'Semua proyek',exact:true}).click();
  await page.getByRole('button',{name:'Hapus proyek Booth Uji',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Ya, lanjutkan',exact:true}).click();
  await expect(page.getByRole('button',{name:'Buka proyek Booth Uji',exact:true})).toHaveCount(0);
  await page.getByLabel('Pilih cadangan JSON').setInputFiles({name:'cadangan.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await expect(page.getByRole('dialog',{name:'Impor cadangan',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ganti dengan cadangan',exact:true}).click();
  await expect(page.getByRole('button',{name:'Buka proyek Booth Uji',exact:true})).toBeVisible();
  await page.getByLabel('Pilih cadangan JSON').setInputFiles({name:'rusak.json',mimeType:'application/json',buffer:Buffer.from('{rusak')});
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Buka proyek Booth Uji',exact:true})).toBeVisible();
});

test('corrupt local storage is preserved until an explicit recovery action',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('huno-led-planner-v1','{rusak'));
  await page.goto('/');
  await expect(page.getByText('Penyimpanan dijeda',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('huno-led-planner-v1'))).toBe('{rusak');
});

test('dashboard, mobile layout, wiring and print report remain accessible',async({page},testInfo)=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Dashboard kelistrikan',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await testInfo.attach('Dashboard',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await page.getByRole('button',{name:/^Buka proyek /}).first().click();
  await page.getByRole('tab',{name:'Skema koneksi',exact:true}).click();
  await expect(page.locator('.screen-only .wiring-group').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await testInfo.attach('Skema DC',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await page.emulateMedia({media:'print'});
  await expect(page.locator('.print-report')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.print-report .data-table')).toBeVisible();
  await expect(page.locator('.print-report .wiring-group').first()).toBeVisible();
});

test('incomplete drafts remain editable after reload',async({page})=>{
  await planStrip(page);
  await page.getByLabel('Nama proyek',{exact:true}).fill('');
  await page.getByLabel('Target beban PSU (%)',{exact:true}).fill('0');
  await page.getByLabel('Daya satuan rangkaian 1',{exact:true}).clear();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('huno-led-planner-v1')!).projects.find((p:{name:string})=>p.name==='')?.circuits[0]?.powerPerUnit)).toBe(0);
  await page.reload();
  await expect(page.getByText('Penyimpanan dijeda',{exact:true})).toHaveCount(0);
  const card=page.locator('.project-card').filter({hasText:'Proyek tanpa nama'});
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Buka proyek',exact:true}).click();
  await expect(page.getByLabel('Nama proyek',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Daya satuan rangkaian 1',{exact:true})).toHaveValue('');
});
