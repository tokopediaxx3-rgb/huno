import type {AppData,ExtraComponent,LedCircuit,Project,PsuAssignment,PsuSpec,Zone} from '../types';
export const STORAGE_KEY='huno-led-planner-v1';
const MAX_BACKUP_BYTES=2*1024*1024;
let fallbackSequence=0;
export function uuid():string {
  if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
  return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+(++fallbackSequence).toString(36);
}
export function createProject(name='Proyek booth baru'):Project {
  const now=new Date().toISOString();
  return {id:uuid(),name,client:'',location:'',eventDate:'',createdAt:now,updatedAt:now,targetLoad:80,mode:'auto',zones:[{id:uuid(),name:'Area utama'}],circuits:[],assignments:[],extras:[]};
}
export function createInitialData():AppData {
  const catalog:PsuSpec[]=[];
  for(const voltage of [12,24] as const)for(const watts of [60,100,150,200,300,400])catalog.push({id:'psu-'+voltage+'-'+watts,name:'PSU '+voltage+' V · '+watts+' W',voltage,watts});
  const project=createProject('Contoh · Booth Nusantara');
  const backdrop:Zone={id:uuid(),name:'Backdrop'},signage:Zone={id:uuid(),name:'Signage'},counter:Zone={id:uuid(),name:'Meja counter'};
  project.client='Nusantara Creative (contoh)';project.location='JIExpo · Jakarta (contoh)';project.eventDate='2026-11-14';project.zones=[backdrop,signage,counter];
  project.circuits=[
    {id:uuid(),name:'Strip utama backdrop',zoneId:backdrop.id,kind:'strip',voltage:24,quantity:5,powerPerUnit:14.4},
    {id:uuid(),name:'Strip aksen backdrop',zoneId:backdrop.id,kind:'strip',voltage:24,quantity:8,powerPerUnit:9.6},
    {id:uuid(),name:'Modul huruf signage',zoneId:signage.id,kind:'module',voltage:12,quantity:40,powerPerUnit:1.2},
    {id:uuid(),name:'Strip meja counter',zoneId:counter.id,kind:'strip',voltage:24,quantity:6,powerPerUnit:14.4}
  ];
  project.extras=[
    {id:uuid(),name:'Kabel DC (contoh)',specification:'Spesifikasi ditentukan sesuai kebutuhan pemasangan',quantity:25,unit:'m'},
    {id:uuid(),name:'Konektor LED (contoh)',specification:'2-pin DC; sesuaikan dengan komponen yang digunakan',quantity:6,unit:'buah'}
  ];
  return {version:1,catalog,projects:[project]};
}
type JsonRecord=Record<string,unknown>;
function invalid(path:string,message:string):never {throw new Error(path+' '+message);}
function record(value:unknown,path:string):JsonRecord {if(typeof value!=='object'||value===null||Array.isArray(value))return invalid(path,'harus berupa objek.');return value as JsonRecord;}
function text(value:unknown,path:string):string {if(typeof value!=='string')return invalid(path,'harus berupa teks.');return value;}
function id(value:unknown,path:string):string {const result=text(value,path);if(!result.trim())return invalid(path,'tidak boleh kosong.');return result;}
function finite(value:unknown,path:string):number {if(typeof value!=='number'||!Number.isFinite(value))return invalid(path,'harus berupa angka yang terbatas.');return value;}
function voltage(value:unknown,path:string):12|24 {if(value!==12&&value!==24)return invalid(path,'harus 12 atau 24.');return value;}
function list<T>(value:unknown,path:string,parse:(item:unknown,itemPath:string)=>T):T[] {if(!Array.isArray(value))return invalid(path,'harus berupa daftar.');return value.map((item,index)=>parse(item,path+'['+index+']'));}
function unique<T extends {id:string}>(items:T[],path:string):T[] {const ids=new Set<string>();for(const item of items){if(ids.has(item.id))return invalid(path,'memiliki ID duplikat: '+item.id+'.');ids.add(item.id);}return items;}
function parseZone(value:unknown,path:string):Zone {const d=record(value,path);return {id:id(d.id,path+'.id'),name:text(d.name,path+'.name')};}
function parseCircuit(value:unknown,path:string):LedCircuit {
  const d=record(value,path);if(d.kind!=='strip'&&d.kind!=='module')return invalid(path+'.kind','harus strip atau module.');
  return {id:id(d.id,path+'.id'),name:text(d.name,path+'.name'),zoneId:id(d.zoneId,path+'.zoneId'),kind:d.kind,voltage:voltage(d.voltage,path+'.voltage'),quantity:finite(d.quantity,path+'.quantity'),powerPerUnit:finite(d.powerPerUnit,path+'.powerPerUnit')};
}
function parsePsu(value:unknown,path:string):PsuSpec {const d=record(value,path),watts=finite(d.watts,path+'.watts');if(watts<=0)return invalid(path+'.watts','harus lebih besar dari nol.');return {id:id(d.id,path+'.id'),name:text(d.name,path+'.name'),voltage:voltage(d.voltage,path+'.voltage'),watts};}
function parseAssignment(value:unknown,path:string):PsuAssignment {const d=record(value,path);return {id:id(d.id,path+'.id'),zoneId:id(d.zoneId,path+'.zoneId'),catalogId:id(d.catalogId,path+'.catalogId'),circuitIds:list(d.circuitIds,path+'.circuitIds',id)};}
function parseExtra(value:unknown,path:string):ExtraComponent {const d=record(value,path);return {id:id(d.id,path+'.id'),name:text(d.name,path+'.name'),specification:text(d.specification,path+'.specification'),quantity:finite(d.quantity,path+'.quantity'),unit:text(d.unit,path+'.unit')};}
function parseProject(value:unknown,path:string):Project {
  const d=record(value,path);if(d.mode!=='auto'&&d.mode!=='manual')return invalid(path+'.mode','harus auto atau manual.');
  return {id:id(d.id,path+'.id'),name:text(d.name,path+'.name'),client:text(d.client,path+'.client'),location:text(d.location,path+'.location'),eventDate:text(d.eventDate,path+'.eventDate'),createdAt:text(d.createdAt,path+'.createdAt'),updatedAt:text(d.updatedAt,path+'.updatedAt'),targetLoad:finite(d.targetLoad,path+'.targetLoad'),mode:d.mode,zones:unique(list(d.zones,path+'.zones',parseZone),path+'.zones'),circuits:unique(list(d.circuits,path+'.circuits',parseCircuit),path+'.circuits'),assignments:unique(list(d.assignments,path+'.assignments',parseAssignment),path+'.assignments'),extras:unique(list(d.extras,path+'.extras',parseExtra),path+'.extras')};
}
function validateData(value:unknown):AppData {const d=record(value,'Cadangan');if(d.version!==1)return invalid('Versi cadangan','tidak didukung. Gunakan format versi 1.');return {version:1,catalog:unique(list(d.catalog,'catalog',parsePsu),'catalog'),projects:unique(list(d.projects,'projects',parseProject),'projects')};}
export function parseBackup(serialized:string):AppData {
  if(new TextEncoder().encode(serialized).byteLength>MAX_BACKUP_BYTES)throw new Error('Ukuran cadangan melebihi batas 2 MB.');
  let parsed:unknown;try{parsed=JSON.parse(serialized) as unknown;}catch{throw new Error('File cadangan bukan JSON yang valid.');}return validateData(parsed);
}
export function exportBackup(data:AppData):string {const serialized=JSON.stringify(validateData(data),null,2);if(new TextEncoder().encode(serialized).byteLength>MAX_BACKUP_BYTES)throw new Error('Ukuran cadangan melebihi batas 2 MB.');return serialized;}
export function loadData(storage:Pick<Storage,'getItem'>):{data:AppData;error:string|null} {
  try{const serialized=storage.getItem(STORAGE_KEY);if(serialized===null)return {data:createInitialData(),error:null};return {data:parseBackup(serialized),error:null};}
  catch(error){const detail=error instanceof Error?error.message:'Kesalahan tidak diketahui.';return {data:createInitialData(),error:'Data browser tidak dapat dibaca: '+detail+' Penyimpanan otomatis dihentikan agar data lama tidak tertimpa.'};}
}
export function saveData(data:AppData,storage:Pick<Storage,'setItem'>):void {storage.setItem(STORAGE_KEY,exportBackup(data));}
