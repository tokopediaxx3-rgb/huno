import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Blocks, Cable, Check, CheckCircle2, ChevronRight, Copy, Download, FolderOpen, Gauge, LayoutDashboard, Lightbulb, MapPin, Plus, Printer, Search, Settings2, ShieldCheck, Trash2, Upload, X, Zap, AlertTriangle, CalendarDays, CircuitBoard, HardDrive } from 'lucide-react';
import type { AppData, Project, ProjectAnalysis } from './types';
import { analyzeProject } from './lib/electrical';
import { createInitialData, createProject, exportBackup, loadData, parseBackup, saveData, uuid } from './lib/storage';
import { CatalogEditor, Field, number, ProjectEditor } from './components/ProjectEditor';
import { BillOfMaterials, PowerPlan, WiringDiagram } from './components/PowerPlan';
import { CableGuide } from './components/CableGuide';

type View='dashboard'|'projects'|'catalog'|'editor';
type Tab='setup'|'power'|'wiring'|'cables'|'bom';
type ModalState={kind:'new'}|{kind:'import';data:AppData}|{kind:'confirm';title:string;description:string;action:()=>void}|null;
const statusLabels:Record<ProjectAnalysis['status'],string>={ready:'Sesuai perhitungan',warning:'Periksa target beban',incomplete:'Perlu dilengkapi',empty:'Belum ada LED'};
function statusClass(status:ProjectAnalysis['status']) {return status==='ready'?'ready':status==='warning'?'warning':status==='incomplete'?'error':'empty';}
function Badge({status}:{status:ProjectAnalysis['status']}) {return <span className={'badge badge-'+statusClass(status)}><span className="status-dot"/>{statusLabels[status]}</span>;}
function dateLabel(value:string) {if(!value)return 'Tanggal belum diatur';const date=new Date(value+'T00:00:00');return Number.isNaN(date.getTime())?'Tanggal belum diatur':new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(date);}
function Dialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const id=useId(),ref=useRef<HTMLDivElement>(null),closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const frame=requestAnimationFrame(()=>{((ref.current?.querySelector('input, select, textarea')??ref.current?.querySelector('button')) as HTMLElement|null)?.focus();});
    const handler=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}
      if(event.key!=='Tab')return;
      const focusable=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')??[]);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',handler);
    return ()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',handler);document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={id}><div className="modal-header"><h2 id={id}>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Tutup dialog"><X size={20}/></button></div>{children}</div></div>;
}

export default function App() {
  const [initial]=useState(()=>{try{return loadData(window.localStorage);}catch{return {data:createInitialData(),error:'Penyimpanan browser tidak dapat diakses.'};}});
  const [data,setData]=useState<AppData>(initial.data);
  const [canSave,setCanSave]=useState(!initial.error);
  const [readError,setReadError]=useState(initial.error);
  const [saveError,setSaveError]=useState<string|null>(null);
  const [view,setView]=useState<View>('dashboard');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [tab,setTab]=useState<Tab>('setup');
  const [search,setSearch]=useState('');
  const [modal,setModal]=useState<ModalState>(null);
  const [newName,setNewName]=useState(''),[newClient,setNewClient]=useState('');
  const [toast,setToast]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{if(!canSave)return;try{saveData(data,window.localStorage);setSaveError(null);}catch{setSaveError('Perubahan belum tersimpan. Penyimpanan browser mungkin penuh atau dibatasi. Ekspor cadangan untuk menyimpan pekerjaan Anda.');}},[data,canSave]);
  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),4500);return ()=>window.clearTimeout(timer);},[toast]);
  const analyses=useMemo(()=>Object.fromEntries(data.projects.map(project=>[project.id,analyzeProject(project,data.catalog)])) as Record<string,ProjectAnalysis>,[data]);
  const project=data.projects.find(p=>p.id===selectedId);
  const analysis=project?analyses[project.id]:null;
  const totalWatts=Object.values(analyses).reduce((sum,a)=>sum+a.totalWatts,0);
  const psuCount=Object.values(analyses).reduce((sum,a)=>sum+a.supplies.length,0);
  const attention=Object.values(analyses).filter(a=>a.status==='incomplete'||a.status==='warning').length;
  const visibleProjects=data.projects.filter(p=>(p.name+' '+p.client+' '+p.location).toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));

  function navigate(next:View){setView(next);setSearch('');if(next!=='editor')setSelectedId(null);}
  function openProject(id:string){setSelectedId(id);setView('editor');setTab('setup');}
  function updateProject(patch:Partial<Project>){if(!project)return;setData(previous=>({...previous,projects:previous.projects.map(p=>p.id===project.id?{...p,...patch,updatedAt:new Date().toISOString()}:p)}));}
  function create(event:FormEvent){event.preventDefault();if(!newName.trim())return;const added={...createProject(newName.trim()),client:newClient.trim()};setData(previous=>({...previous,projects:[added,...previous.projects]}));setModal(null);openProject(added.id);setToast('Proyek baru dibuat. Tambahkan kebutuhan LED Anda.');}
  function showNew(){setNewName('');setNewClient('');setModal({kind:'new'});}
  function duplicate(p:Project){const copy={...structuredClone(p),id:uuid(),name:p.name+' (salinan)',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};setData(previous=>({...previous,projects:[copy,...previous.projects]}));setToast('Salinan proyek berhasil dibuat.');}
  function remove(p:Project){setModal({kind:'confirm',title:'Hapus proyek?',description:'Proyek “'+p.name+'” beserta area dan rangkaiannya akan dihapus dari perangkat ini.',action:()=>{setData(previous=>({...previous,projects:previous.projects.filter(x=>x.id!==p.id)}));if(selectedId===p.id)navigate('projects');setToast('Proyek dihapus.');}});}
  function downloadBackup(){
    try{const blob=new Blob([exportBackup(data)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='huno-cadangan-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);setToast('Cadangan JSON siap diunduh.');}
    catch(error){setToast(error instanceof Error?error.message:'Cadangan tidak dapat diekspor.');}
  }
  async function importFile(file:File|undefined){
    if(!file)return;
    if(file.size>2*1024*1024){setToast('Ukuran cadangan maksimal 2 MB.');return;}
    try{const imported=parseBackup(await file.text());setModal({kind:'import',data:imported});}
    catch(error){setToast(error instanceof Error?error.message:'File cadangan tidak dapat dibaca.');}
  }
  function resetStorage(){setModal({kind:'confirm',title:'Mulai ulang penyimpanan?',description:'Data lokal yang tidak dapat dibaca akan diganti dengan proyek contoh dan katalog awal. Impor cadangan jika Anda ingin memulihkan proyek lama.',action:()=>{setData(createInitialData());setCanSave(true);setReadError(null);navigate('dashboard');}});}

  const tabs:{id:Tab;label:string;icon:typeof Lightbulb}[]=[{id:'setup',label:'Detail & LED',icon:Lightbulb},{id:'power',label:'Power supply',icon:Zap},{id:'wiring',label:'Skema koneksi',icon:Cable},{id:'cables',label:'Panduan kabel',icon:Cable},{id:'bom',label:'Daftar komponen',icon:Blocks}];
  const statItems:{label:string;value:string;unit:string;foot:string;icon:typeof Lightbulb;test?:string}[]=view==='editor' && analysis ? [
    {label:'Beban LED DC',value:number(analysis.totalWatts),unit:'W',foot:project?.circuits.length+' rangkaian LED',icon:Lightbulb,test:'project-total-watts'},
    {label:'Kebutuhan kapasitas',value:number(analysis.requiredWatts),unit:'W',foot:'Dengan target beban '+number(project?.targetLoad??80)+'%',icon:Gauge},
    {label:'PSU terpilih',value:String(analysis.supplies.length),unit:'unit',foot:number(analysis.capacityWatts)+' W kapasitas terpasang',icon:Zap},
    {label:'Arus DC per tegangan',value:number(analysis.currents[12])+' / '+number(analysis.currents[24]),unit:'A',foot:'12 V / 24 V dihitung terpisah',icon:CircuitBoard}
  ]:[
    {label:'Total proyek',value:String(data.projects.length).padStart(2,'0'),unit:'proyek',foot:'Rencana booth tersimpan',icon:FolderOpen},
    {label:'Total beban LED DC',value:number(totalWatts),unit:'W',foot:'Akumulasi seluruh proyek',icon:Lightbulb},
    {label:'Power supply',value:String(psuCount).padStart(2,'0'),unit:'unit',foot:'Terpilih pada semua proyek',icon:Zap},
    {label:'Perlu perhatian',value:String(attention).padStart(2,'0'),unit:'proyek',foot:attention?'Periksa data atau kapasitas':'Semua rencana terpantau',icon:ShieldCheck}
  ];

  return <div className="app-shell">
    <aside className="sidebar screen-only">
      <div className="brand"><span className="brand-mark"><Zap size={25} fill="currentColor"/></span><div className="brand-copy"><span className="brand-name">HUNO<span style={{color:'#5eead4'}}>.</span></span><span className="brand-subtitle">BOOTH ELECTRICAL PLANNER</span></div></div>
      <nav className="nav-list" aria-label="Navigasi utama">
        <button className={'nav-item'+(view==='dashboard'?' active':'')} onClick={()=>navigate('dashboard')}><LayoutDashboard size={19}/><span>Dashboard</span></button>
        <button className={'nav-item'+(view==='projects'||view==='editor'?' active':'')} onClick={()=>navigate('projects')}><FolderOpen size={19}/><span>Proyek booth</span><span className="nav-count">{data.projects.length}</span></button>
        <button className={'nav-item'+(view==='catalog'?' active':'')} onClick={()=>navigate('catalog')}><Settings2 size={19}/><span>Katalog PSU</span></button>
      </nav>
      <div className="sidebar-footer"><div className="workspace-badge"><HardDrive size={18}/><div><strong>Ruang kerja pribadi</strong><small>Tersimpan di browser ini</small></div></div><div className="connection-note"><span className="user-avatar">H</span><div><strong>Perencana booth</strong><small>LED & power supply</small></div></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar screen-only">
        <div className="breadcrumb"><span>Ruang kerja</span><ChevronRight size={14}/><strong>{view==='dashboard'?'Dashboard':view==='catalog'?'Katalog PSU':view==='editor'?'Detail proyek':'Proyek booth'}</strong></div>
        <div className="topbar-actions">
          <span className="save-indicator" role="status">{!canSave||saveError?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>}<span>{!canSave?'Penyimpanan dijeda':saveError?'Belum tersimpan':'Tersimpan di perangkat'}</span></span>
          <button className="btn btn-ghost btn-small" onClick={()=>fileRef.current?.click()}><Upload size={16}/>Impor</button>
          <button className="btn btn-secondary btn-small" onClick={downloadBackup}><Download size={16}/>Ekspor cadangan</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Pilih cadangan JSON" onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value='';void importFile(file);}}/>
        </div>
      </header>
      <div className="screen-only">
        {readError && <div className="alert alert-warning"><AlertTriangle size={20}/><div><strong>Data lokal belum dapat dibaca.</strong><p>{readError} Penyimpanan otomatis dijeda agar data lama tidak tertimpa. Tampilan saat ini menggunakan data contoh.</p><div className="page-actions"><button className="btn btn-small btn-secondary" onClick={()=>fileRef.current?.click()}>Impor cadangan</button><button className="btn btn-small btn-ghost" onClick={resetStorage}>Mulai ulang penyimpanan</button></div></div></div>}
        {saveError && <div className="alert alert-error" role="alert"><AlertTriangle size={20}/><span>{saveError}</span></div>}
        <div className="page-heading">
          <div>{view==='editor' && project ? <><button className="btn btn-ghost btn-small" onClick={()=>navigate('projects')}><ArrowLeft size={16}/>Semua proyek</button><h1 className="page-title">{project.name||'Proyek tanpa nama'}</h1><p className="page-description">{project.client||'Klien belum diatur'}<span aria-hidden="true"> · </span>{project.location||'Lokasi belum diatur'}</p></> : <><span className="eyebrow">{view==='catalog'?'PILIHAN KOMPONEN':'RUANG KERJA ANDA'}</span><h1 className="page-title">{view==='dashboard'?'Dashboard kelistrikan':view==='catalog'?'Katalog power supply':'Proyek booth'}</h1><p className="page-description">{view==='catalog'?'Kelola spesifikasi PSU untuk kebutuhan rakitan Anda.':'Rencanakan kebutuhan LED dan daya booth dalam satu tempat.'}</p></>}</div>
          <div className="page-actions">{view==='editor' && project && analysis ? <><Badge status={analysis.status}/><button className="btn btn-secondary" onClick={()=>window.print()}><Printer size={17}/>Cetak rencana</button></> : view!=='catalog' && <button className="btn btn-primary" onClick={showNew}><Plus size={18}/>Proyek baru</button>}</div>
        </div>
        {view==='dashboard' && <section className="hero-card">
          <div className="hero-content"><span className="tag">DARI RENCANA KE RAKITAN</span><h2>Cahaya yang tepat.<br/>Daya yang terencana.</h2><p>Susun rangkaian LED, hitung kebutuhan power supply,<br className="screen-only"/> dan siapkan komponen untuk booth berikutnya.</p><button className="btn btn-primary" onClick={showNew}>Mulai proyek<ArrowRight size={17}/></button></div>
          <div className="hero-art" aria-hidden="true"><div className="hero-grid"><span className="hero-icon"><Zap size={44}/></span><span className="hero-stat">12 / 24 V <small>LED DC</small></span><span className="hero-stat">80% <small>TARGET AWAL</small></span><span className="hero-icon"><Lightbulb size={36}/></span></div></div>
        </section>}
        {view!=='catalog' && <div className="stats-grid">{statItems.map(item=><div className="stat-card" key={item.label}><div className="stat-icon"><item.icon size={21}/></div><div className="stat-body"><span className="stat-label">{item.label}</span><div><strong className="stat-value" data-testid={item.test}>{item.value}</strong><span className="stat-unit">{item.unit}</span></div><small className="stat-foot">{item.foot}</small></div></div>)}</div>}
        {(view==='dashboard'||view==='projects') && <>
          <div className="section-heading"><div><h2 className="section-title">{view==='dashboard'?'Proyek Anda':'Semua proyek'} <span className="tag">{data.projects.length}</span></h2><p className="section-subtitle">Lanjutkan rencana atau mulai booth baru.</p></div><label className="search-box"><Search size={18}/><input aria-label="Cari proyek" placeholder="Cari nama, klien, lokasi..." value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
          {!visibleProjects.length ? <div className="panel empty-state"><FolderOpen className="empty-icon"/><h3>{search?'Proyek tidak ditemukan':'Booth berikutnya dimulai di sini'}</h3><p>{search?'Coba kata kunci lain.':'Buat proyek untuk merencanakan LED dan power supply.'}</p>{!search&&<button className="btn btn-primary" onClick={showNew}><Plus size={17}/>Buat proyek pertama</button>}</div> :
          <div className="project-grid">{visibleProjects.map(p=>{const a=analyses[p.id];return <article className="project-card" key={p.id}><div className="project-card-header"><div className="stat-icon"><CircuitBoard size={22}/></div><div className="project-actions"><button className="icon-button" aria-label={'Salin proyek '+p.name} title="Salin proyek" onClick={()=>duplicate(p)}><Copy size={16}/></button><button className="icon-button" aria-label={'Hapus proyek '+p.name} title="Hapus proyek" onClick={()=>remove(p)}><Trash2 size={16}/></button></div></div><div className="project-card-body">{p.name.startsWith('Contoh')&&<span className="tag tag-demo">DATA CONTOH</span>}<h3 className="project-title">{p.name||'Proyek tanpa nama'}</h3><p className="project-meta">{p.client||'Klien belum diatur'}</p><p className="project-meta"><MapPin size={14}/>{p.location||'Lokasi belum diatur'}</p><p className="project-meta"><CalendarDays size={14}/>{dateLabel(p.eventDate)}</p><div className="project-facts"><div className="project-fact"><small>Beban LED</small><strong>{number(a.totalWatts)} <span>W</span></strong></div><div className="project-fact"><small>Power supply</small><strong>{a.supplies.length} <span>unit</span></strong></div><div className="project-fact"><small>Area</small><strong>{p.zones.length}</strong></div></div></div><div className="project-card-footer"><Badge status={a.status}/><button className="project-open" onClick={()=>openProject(p.id)} aria-label={'Buka proyek '+p.name}>Buka proyek<ArrowRight size={17}/></button></div></article>})}</div>}
          <p className="footer-note"><HardDrive size={15}/>Proyek disimpan pada browser dan perangkat ini. Ekspor cadangan untuk memindahkan atau menyimpan salinannya.</p>
        </>}
        {view==='catalog'&&<CatalogEditor catalog={data.catalog} onChange={catalog=>setData(previous=>({...previous,catalog}))}/>}
        {view==='editor' && project && analysis && <>
          <div className="tabs" role="tablist" aria-label="Bagian perencanaan">{tabs.map(item=><button role="tab" type="button" id={'tab-'+item.id} aria-selected={tab===item.id} aria-controls={'panel-'+item.id} tabIndex={tab===item.id?0:-1} key={item.id} className={'tab'+(tab===item.id?' active':'')} onClick={()=>setTab(item.id)} onKeyDown={event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const current=tabs.findIndex(t=>t.id===tab),next=tabs[(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];setTab(next.id);document.getElementById('tab-'+next.id)?.focus();}}><item.icon size={18}/>{item.label}</button>)}</div>
          {!!analysis.issues.length && <div className={'alert '+(analysis.issues.some(i=>i.severity==='error')?'alert-error':'alert-warning')} role="alert"><AlertTriangle size={19}/><div><strong>{analysis.status==='incomplete'?'Perencanaan perlu dilengkapi':'Periksa kembali pembagian beban'}</strong><ul className="issue-list">{analysis.issues.map((issue,index)=><li key={issue.code+'-'+index}>{issue.message}</li>)}</ul></div></div>}
          <div role="tabpanel" id={'panel-'+tab} aria-labelledby={'tab-'+tab} tabIndex={0}>
            {tab==='setup'&&<ProjectEditor project={project} analysis={analysis} onChange={updateProject}/>}
            {tab==='power'&&<PowerPlan project={project} catalog={data.catalog} analysis={analysis} onChange={updateProject}/>}
            {tab==='wiring'&&<WiringDiagram project={project} analysis={analysis}/>}
            {tab==='cables'&&<CableGuide project={project} analysis={analysis} onChange={updateProject}/>}
            {tab==='bom'&&<BillOfMaterials project={project} analysis={analysis}/>}
          </div>
        </>}
      </div>
      {view==='editor'&&project&&analysis&&<div className="print-only print-report"><div className="report-heading"><div><strong>HUNO · Rencana kelistrikan booth</strong><h1>{project.name||'Proyek tanpa nama'}</h1></div><Badge status={analysis.status}/></div><div className="report-meta"><p>Klien: {project.client||'—'} · Lokasi: {project.location||'—'}</p><p>Pameran: {dateLabel(project.eventDate)} · Dicetak: {new Intl.DateTimeFormat('id-ID',{dateStyle:'medium'}).format(new Date())}</p><p>Beban LED DC: {number(analysis.totalWatts)} W · Target beban PSU: {number(project.targetLoad)}% · PSU: {analysis.supplies.length} unit</p><p>Arus DC: 12 V = {number(analysis.currents[12])} A; 24 V = {number(analysis.currents[24])} A.</p></div>{!!analysis.issues.length&&<div className="report-warning"><strong>Catatan pemeriksaan</strong><ul>{analysis.issues.map((i,index)=><li key={index}>{i.message}</li>)}</ul></div>}<section className="report-section"><BillOfMaterials project={project} analysis={analysis}/></section><section className="report-section"><WiringDiagram project={project} analysis={analysis}/></section><section className="report-section"><CableGuide project={project} analysis={analysis}/></section><p>Perencanaan sisi DC berdasarkan spesifikasi yang dimasukkan. Ukuran kabel, proteksi AC, dan konsumsi listrik AC dihitung terpisah sesuai kebutuhan pemasangan.</p></div>}
    </main>
    {modal&&<Dialog title={modal.kind==='new'?'Buat proyek booth':modal.kind==='import'?'Impor cadangan':modal.title} onClose={()=>setModal(null)}>
      {modal.kind==='new'&&<form onSubmit={create}><div className="modal-body form-grid"><Field label="Nama proyek" wide><input autoFocus className="input" required maxLength={160} placeholder="Contoh: Booth Nusantara Expo" value={newName} onChange={e=>setNewName(e.target.value)}/></Field><Field label="Klien / penyelenggara" wide><input className="input" maxLength={160} placeholder="Opsional" value={newClient} onChange={e=>setNewClient(e.target.value)}/></Field><p className="hint">Anda dapat menambahkan area booth, LED, dan komponen setelah proyek dibuat.</p></div><div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-primary" type="submit" disabled={!newName.trim()}><Plus size={17}/>Buat proyek</button></div></form>}
      {modal.kind==='import'&&<><div className="modal-body"><p>Cadangan memuat <strong>{modal.data.projects.length} proyek</strong> dan <strong>{modal.data.catalog.length} pilihan PSU</strong>.</p><div className="alert alert-warning"><AlertTriangle size={18}/><span>Impor akan mengganti proyek dan katalog pada perangkat ini. Ekspor cadangan pekerjaan saat ini sebelum menggantinya.</span></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={downloadBackup}><Download size={16}/>Ekspor saat ini</button><button className="btn btn-primary" onClick={()=>{setData(modal.data);setCanSave(true);setReadError(null);navigate('dashboard');setModal(null);setToast('Cadangan berhasil diimpor.');}}>Ganti dengan cadangan</button></div></>}
      {modal.kind==='confirm'&&<><div className="modal-body"><p>{modal.description}</p></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-danger" onClick={()=>{modal.action();setModal(null);}}>Ya, lanjutkan</button></div></>}
    </Dialog>}
    {toast&&<div className="toast screen-only" role="status"><Check size={17}/><span>{toast}</span><button className="icon-button" aria-label="Tutup pemberitahuan" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </div>;
}
