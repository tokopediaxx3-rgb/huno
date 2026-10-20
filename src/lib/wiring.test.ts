import {describe,expect,it} from 'vitest';
import {createInitialData,createProject} from './storage';
import {analyzeProject} from './electrical';
import {AC_REFERENCE,DEFAULT_WIRING,WIRE_COLORS,cableConnections,isWireColor,resolveWirePlan} from './wiring';

function manualFixture(){
  const d=createInitialData(),p=createProject('Booth kabel');
  p.circuits=[{id:'led-a',name:'LED A',zoneId:p.zones[0].id,kind:'strip',voltage:24,quantity:2,powerPerUnit:12},{id:'led-b',name:'LED B',zoneId:p.zones[0].id,kind:'module',voltage:24,quantity:2,powerPerUnit:1.2}];
  p.mode='manual';
  p.assignments=[{id:'psu-a',zoneId:p.zones[0].id,catalogId:'psu-24-100',circuitIds:['led-a']},{id:'psu-b',zoneId:p.zones[0].id,catalogId:'psu-24-100',circuitIds:['led-b']}];
  return {project:p,catalog:d.catalog};
}
describe('rencana warna kabel',()=>{
  it('proyek baru memakai merah positif dan hitam negatif',()=>expect(createProject().wiring).toEqual(DEFAULT_WIRING));
  it('cadangan lama tanpa rencana kabel mendapat default tanpa mutasi',()=>{const p=createProject();delete p.wiring;expect(resolveWirePlan(p)).toEqual(DEFAULT_WIRING);expect(p.wiring).toBeUndefined();});
  it('warna dan catatan kustom tetap utuh',()=>{const p=createProject();p.wiring={positiveColor:'white',negativeColor:'orange',notes:'Label ujung kabel'};expect(resolveWirePlan(p)).toEqual(p.wiring);expect(resolveWirePlan(p)).not.toBe(p.wiring);});
  it('hijau-kuning proteksi tidak menjadi pilihan DC',()=>{expect(isWireColor('green-yellow')).toBe(false);expect(isWireColor('red')).toBe(true);expect(WIRE_COLORS.some(x=>x.label==='Hijau-kuning')).toBe(false);expect(AC_REFERENCE.find(x=>x.color==='Hijau-kuning')?.terminal).toContain('PE');});
});
describe('asal dan tujuan sambungan kabel',()=>{
  it('dua jalur untuk setiap rangkaian yang ditempatkan',()=>{const d=createInitialData(),p=d.projects[0],a=analyzeProject(p,d.catalog),rows=cableConnections(p,a);expect(rows).toHaveLength(p.circuits.length*2);for(const circuit of p.circuits){const pair=rows.filter(x=>x.circuitId===circuit.id);expect(pair.map(x=>x.polarity)).toEqual(['positive','negative']);expect(pair[0].source).toContain('V+');expect(pair[0].target).toBe(circuit.name+' · +');expect(pair[0].color).toBe('red');expect(pair[1].source).toContain('V−');expect(pair[1].target).toBe(circuit.name+' · −');expect(pair[1].color).toBe('black');expect(pair[0].supplyId).toBe(pair[1].supplyId);expect(pair.every(x=>x.status==='ready')).toBe(true);}});
  it('pilihan warna berlaku pada semua jalur dan tidak mengubah alokasi',()=>{const {project:p,catalog}=manualFixture();p.wiring={positiveColor:'white',negativeColor:'orange',notes:''};const before=JSON.stringify(p.assignments),rows=cableConnections(p,analyzeProject(p,catalog));expect(rows.filter(x=>x.polarity==='positive').every(x=>x.color==='white')).toBe(true);expect(rows.filter(x=>x.polarity==='negative').every(x=>x.color==='orange')).toBe(true);expect(JSON.stringify(p.assignments)).toBe(before);});
  it('pemindahan manual mengubah PSU asal',()=>{const {project:p,catalog}=manualFixture();p.assignments[0].circuitIds=[];p.assignments[1].circuitIds.push('led-a');const pair=cableConnections(p,analyzeProject(p,catalog)).filter(x=>x.circuitId==='led-a');expect(pair).toHaveLength(2);expect(pair.every(x=>x.supplyId==='psu-b'&&x.source.startsWith('PSU 2'))).toBe(true);});
  it('rangkaian tanpa PSU tidak diberi sambungan buatan',()=>{const {project:p,catalog}=manualFixture();p.assignments=[];expect(cableConnections(p,analyzeProject(p,catalog))).toEqual([]);});
  it('tegangan tidak sesuai tidak mendapat status sesuai',()=>{const {project:p,catalog}=manualFixture();p.assignments[0].catalogId='psu-12-100';const pair=cableConnections(p,analyzeProject(p,catalog)).filter(x=>x.circuitId==='led-a');expect(pair).toHaveLength(2);expect(pair.every(x=>x.status==='error')).toBe(true);});
  it('duplikasi antar-PSU ditandai pada seluruh jalur terkait',()=>{const {project:p,catalog}=manualFixture();p.assignments[1].circuitIds.push('led-a');const rows=cableConnections(p,analyzeProject(p,catalog)).filter(x=>x.circuitId==='led-a');expect(rows).toHaveLength(4);expect(rows.every(x=>x.status==='error')).toBe(true);});
  it('PSU yang hilang dari katalog tetap ditandai bermasalah',()=>{const {project:p,catalog}=manualFixture();p.assignments[0].catalogId='deleted';expect(cableConnections(p,analyzeProject(p,catalog)).filter(x=>x.circuitId==='led-a').every(x=>x.status==='error')).toBe(true);});
  it('kesalahan target global menandai semua jalur',()=>{const {project:p,catalog}=manualFixture();p.targetLoad=0;const rows=cableConnections(p,analyzeProject(p,catalog));expect(rows).toHaveLength(4);expect(rows.every(x=>x.status==='error')).toBe(true);});
  it('warna yang sama mendapat catatan pemeriksaan',()=>{const {project:p,catalog}=manualFixture();p.wiring={positiveColor:'black',negativeColor:'black',notes:''};const rows=cableConnections(p,analyzeProject(p,catalog));expect(rows).toHaveLength(4);expect(rows.every(x=>x.status==='warning')).toBe(true);});
  it('referensi AC tidak tercampur ke daftar DC',()=>{const d=createInitialData(),p=d.projects[0],rows=cableConnections(p,analyzeProject(p,d.catalog));expect(rows.every(x=>!x.source.includes('AC')&&!x.target.includes('PE'))).toBe(true);expect(AC_REFERENCE).toHaveLength(3);});
});
