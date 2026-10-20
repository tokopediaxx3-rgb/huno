import {describe,expect,it,vi} from 'vitest';
import {STORAGE_KEY,createInitialData,createProject,exportBackup,loadData,parseBackup,saveData,uuid} from './storage';
describe('proyek dan data awal',()=>{
  it('membuat proyek kosong satu area dengan target80%',()=>{const p=createProject('Booth baru');expect(p.name).toBe('Booth baru');expect(p.zones).toHaveLength(1);expect(p.circuits).toEqual([]);expect(p.assignments).toEqual([]);expect(p.targetLoad).toBe(80);expect(p.mode).toBe('auto');expect(p.createdAt).toBe(p.updatedAt);});
  it('menghasilkan ID berbeda',()=>{const ids=Array.from({length:100},()=>uuid());expect(new Set(ids).size).toBe(ids.length);});
  it('menandai contoh dan kedua tegangan',()=>{const d=createInitialData();expect(d.projects[0].name).toMatch(/^Contoh/);expect(d.projects[0].zones).toHaveLength(3);expect(d.catalog).toHaveLength(12);for(const v of [12,24])expect(d.catalog.filter(s=>s.voltage===v).map(s=>s.watts)).toEqual([60,100,150,200,300,400]);});
});
describe('cadangan JSON',()=>{
  it('roundtrip lengkap',()=>{const d=createInitialData();expect(parseBackup(exportBackup(d))).toEqual(d);});
  it('menerima draft kosong dan referensi manual lama',()=>{const d=createInitialData(),p=d.projects[0];p.name='';p.targetLoad=0;p.circuits[0].name='';p.circuits[0].quantity=0;p.circuits[0].powerPerUnit=0;p.circuits[2].quantity=10.5;p.mode='manual';p.assignments=[{id:'manual',zoneId:'old',catalogId:'old',circuitIds:['old','old']}];p.extras[0].name='';p.extras[0].unit='';expect(parseBackup(exportBackup(d))).toEqual(d);});
  it('menerima daftar kosong',()=>expect(parseBackup('{"version":1,"catalog":[],"projects":[]}')).toEqual({version:1,catalog:[],projects:[]}));
  it.each(['','{','bukan-json','{"version":'])('menolak JSON rusak %s',s=>expect(()=>parseBackup(s)).toThrow(/JSON/));
  it('menolak versi tidak dikenal',()=>expect(()=>parseBackup('{"version":2,"catalog":[],"projects":[]}')).toThrow(/Versi/));
  it.each(['null','[]','"text"'])('menolak root bukanobjek %s',s=>expect(()=>parseBackup(s)).toThrow(/objek/));
  it('menolak fieldwajib hilang',()=>expect(()=>parseBackup(JSON.stringify({version:1,catalog:[],projects:[{id:'p',name:'x'}]}))).toThrow(/projects/));
  it('menolak daftar salah tipe',()=>expect(()=>parseBackup('{"version":1,"catalog":{},"projects":[]}')).toThrow(/catalog/));
  it('menolak jenis LED atau tegangan lain',()=>{const d=createInitialData(),p=d.projects[0];expect(()=>parseBackup(JSON.stringify({...d,catalog:[{...d.catalog[0],voltage:48}]}))).toThrow(/voltage/);expect(()=>parseBackup(JSON.stringify({...d,projects:[{...p,circuits:[{...p.circuits[0],kind:'ac'}]}]}))).toThrow(/kind/);});
  it('menolak angka string dan overflow',()=>{const d=createInitialData();expect(()=>parseBackup(JSON.stringify({...d,catalog:[{...d.catalog[0],watts:'100'}]}))).toThrow(/watts/);expect(()=>parseBackup(JSON.stringify(d).replace('"quantity":5','"quantity":1e400'))).toThrow(/quantity/);});
  it.each([NaN,Infinity,-Infinity])('menolak ekspor angka tidak terbatas %s',v=>{const d=createInitialData();d.projects[0].circuits[0].quantity=v;expect(()=>exportBackup(d)).toThrow(/quantity/);});
  it.each([0,-100])('menolak kapasitas katalog %s',watts=>{const d=createInitialData();expect(()=>parseBackup(JSON.stringify({...d,catalog:[{...d.catalog[0],watts}]}))).toThrow(/watts/);});
  it('menolak ID proyek katalog dan rangkaian duplikat',()=>{const d=createInitialData();expect(()=>parseBackup(JSON.stringify({...d,projects:[d.projects[0],d.projects[0]]}))).toThrow(/duplikat/);expect(()=>parseBackup(JSON.stringify({...d,catalog:[d.catalog[0],d.catalog[0]]}))).toThrow(/duplikat/);d.projects[0].circuits.push({...d.projects[0].circuits[0]});expect(()=>parseBackup(JSON.stringify(d))).toThrow(/duplikat/);});
  it('menolak ID kosong dan cadangan terlalu besar',()=>{const d=createInitialData();d.projects[0].id=' ';expect(()=>parseBackup(JSON.stringify(d))).toThrow(/id/);expect(()=>parseBackup(' '.repeat(2*1024*1024+1))).toThrow(/2 MB/);});
});
describe('penyimpanan browser',()=>{
  it('memuat contoh ketika key belumada',()=>{const getItem=vi.fn(()=>null),r=loadData({getItem});expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);expect(r.error).toBeNull();expect(r.data.projects[0].name).toMatch(/^Contoh/);});
  it('menyimpan dan memuat ulang',()=>{let serialized:string|null=null;const storage={getItem:()=>serialized,setItem:(_key:string,value:string)=>{serialized=value;}};const d=createInitialData();saveData(d,storage);expect(loadData(storage)).toEqual({data:d,error:null});});
  it('tidak menimpa data rusak',()=>{const storage={getItem:vi.fn(()=>'{corrupted'),setItem:vi.fn()},r=loadData(storage);expect(r.error).toMatch(/Penyimpanan otomatis dihentikan/);expect(storage.setItem).not.toHaveBeenCalled();});
  it('kegagalan baca tidak menulis',()=>{const storage={getItem:()=>{throw new Error('Storage denied');},setItem:vi.fn()};expect(loadData(storage).error).toContain('Storage denied');expect(storage.setItem).not.toHaveBeenCalled();});
  it('kegagalan kuota diteruskan ke UI',()=>expect(()=>saveData(createInitialData(),{setItem:()=>{throw new Error('Quota exceeded');}})).toThrow(/Quota/));
  it('validasi sebelum menulis',()=>{const d=createInitialData();d.catalog[0].watts=NaN;const setItem=vi.fn();expect(()=>saveData(d,{setItem})).toThrow(/watts/);expect(setItem).not.toHaveBeenCalled();});
});

describe('batas UTF-8 cadangan',()=>{
  it('batas impor dan ekspor menghitung byte Unicode yang sama',()=>{
    const data=createInitialData();
    data.projects[0].client='展'.repeat(750000);
    const serialized=JSON.stringify(data);
    expect(serialized.length).toBeLessThan(2*1024*1024);
    expect(new TextEncoder().encode(serialized).byteLength).toBeGreaterThan(2*1024*1024);
    expect(()=>exportBackup(data)).toThrow(/2 MB/);
    expect(()=>parseBackup(serialized)).toThrow(/2 MB/);
  });
});
