import { Plus, Trash2, Layers3, SlidersHorizontal, Cable, Lightbulb, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Project, LedCircuit, ProjectAnalysis, PsuSpec, Voltage } from '../types';
import { circuitWatts } from '../lib/electrical';
import { uuid } from '../lib/storage';

export const number = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
export function Field({label,children,hint,wide=false}:{label:string;children:ReactNode;hint?:string;wide?:boolean}) {
  return <label className={'field' + (wide ? ' field-wide' : '')}><span>{label}</span>{children}{hint && <small className="hint">{hint}</small>}</label>;
}
const num = (value: string) => { const parsed=Number(value); return Number.isFinite(parsed) ? parsed : 0; };

export function ProjectEditor({project,analysis,onChange}:{project:Project;analysis:ProjectAnalysis;onChange:(patch:Partial<Project>)=>void}) {
  function patchCircuit(id:string,patch:Partial<LedCircuit>) { onChange({circuits:project.circuits.map(c=>c.id===id?{...c,...patch}:c)}); }
  function removeCircuit(id:string) { onChange({circuits:project.circuits.filter(c=>c.id!==id),assignments:project.assignments.map(a=>({...a,circuitIds:a.circuitIds.filter(c=>c!==id)}))}); }
  function removeZone(id:string) {
    const removed=project.circuits.filter(c=>c.zoneId===id);
    if(removed.length && !window.confirm('Hapus area beserta '+removed.length+' rangkaian LED di dalamnya?')) return;
    const removedIds=new Set(removed.map(c=>c.id));
    onChange({zones:project.zones.filter(z=>z.id!==id),circuits:project.circuits.filter(c=>c.zoneId!==id),assignments:project.assignments.filter(a=>a.zoneId!==id).map(a=>({...a,circuitIds:a.circuitIds.filter(c=>!removedIds.has(c))}))});
  }
  function addCircuit() {
    if(!project.zones.length)return;
    onChange({circuits:[...project.circuits,{id:uuid(),name:'LED baru',zoneId:project.zones[0].id,kind:'strip',voltage:24,quantity:1,powerPerUnit:0}]});
  }
  return <>
    <div className="editor-grid">
      <section className="panel">
        <div className="panel-header"><div><h2 className="section-title">Detail proyek</h2><p className="section-subtitle">Identitas booth dan pengaturan perencanaan.</p></div><SlidersHorizontal size={20}/></div>
        <div className="panel-body form-grid">
          <Field label="Nama proyek" wide><input className="input" value={project.name} onChange={e=>onChange({name:e.target.value})} maxLength={160}/></Field>
          <Field label="Klien / penyelenggara"><input className="input" value={project.client} onChange={e=>onChange({client:e.target.value})} maxLength={160} placeholder="Nama klien"/></Field>
          <Field label="Tanggal pameran"><input className="input" type="date" value={project.eventDate} onChange={e=>onChange({eventDate:e.target.value})}/></Field>
          <Field label="Lokasi booth"><input className="input" value={project.location} onChange={e=>onChange({location:e.target.value})} maxLength={200} placeholder="Venue atau nomor booth"/></Field>
          <Field label="Target beban PSU (%)" hint="80% berarti beban LED menggunakan maksimal 80% kapasitas PSU.">
            <input className="input" type="number" min="1" max="100" step="1" value={project.targetLoad||''} onChange={e=>onChange({targetLoad:num(e.target.value)})}/>
          </Field>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><div><h2 className="section-title">Area booth</h2><p className="section-subtitle">PSU direncanakan terpisah untuk setiap area.</p></div><Layers3 size={20}/></div>
        <div className="panel-body">
          <div className="area-list">{project.zones.map((zone,i)=><div className="area-row" key={zone.id}><span className="tag">{String(i+1).padStart(2,'0')}</span><input className="input" aria-label={'Nama area '+(i+1)} value={zone.name} maxLength={120} onChange={e=>onChange({zones:project.zones.map(z=>z.id===zone.id?{...z,name:e.target.value}:z)})}/><button className="icon-button" type="button" aria-label={'Hapus area '+zone.name} onClick={()=>removeZone(zone.id)}><Trash2 size={17}/></button></div>)}</div>
          {!project.zones.length && <p className="hint">Tambahkan area untuk mulai menyusun rangkaian LED.</p>}
          <button className="btn btn-secondary btn-small" type="button" onClick={()=>onChange({zones:[...project.zones,{id:uuid(),name:'Area '+(project.zones.length+1)}]})}><Plus size={16}/>Tambah area</button>
        </div>
      </section>
    </div>
    <section className="panel">
      <div className="panel-header"><div><h2 className="section-title">Rangkaian LED</h2><p className="section-subtitle">Masukkan daya sesuai datasheet. Satu baris merupakan satu rangkaian ke satu PSU.</p></div><button className="btn btn-primary btn-small" type="button" disabled={!project.zones.length} onClick={addCircuit}><Plus size={17}/>Tambah LED</button></div>
      {!project.circuits.length ? <div className="empty-state"><Lightbulb className="empty-icon"/><h3>Mulai dari kebutuhan cahaya</h3><p>Tambahkan LED strip atau modul untuk menghitung kebutuhan daya booth.</p></div> :
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Nama rangkaian</th><th>Area</th><th>Jenis</th><th>Tegangan</th><th>Panjang / jumlah</th><th>Daya satuan</th><th className="numeric">Total DC</th><th><span className="sr-only">Tindakan</span></th></tr></thead><tbody>
        {project.circuits.map((c,i)=>{const issue=analysis.issues.find(x=>x.circuitId===c.id);return <tr key={c.id}>
          <td><input className="input" aria-label={'Nama rangkaian '+(i+1)} value={c.name} maxLength={160} onChange={e=>patchCircuit(c.id,{name:e.target.value})}/>{issue && <small className="form-error">{issue.message}</small>}</td>
          <td><select className="select" aria-label={'Area rangkaian '+(i+1)} value={c.zoneId} onChange={e=>patchCircuit(c.id,{zoneId:e.target.value})}>{project.zones.map(z=><option key={z.id} value={z.id}>{z.name||'Area tanpa nama'}</option>)}</select></td>
          <td><select className="select" aria-label={'Jenis rangkaian '+(i+1)} value={c.kind} onChange={e=>patchCircuit(c.id,{kind:e.target.value as LedCircuit['kind']})}><option value="strip">Strip</option><option value="module">Modul</option></select></td>
          <td><select className="select" aria-label={'Tegangan rangkaian '+(i+1)} value={c.voltage} onChange={e=>patchCircuit(c.id,{voltage:Number(e.target.value) as Voltage})}><option value={12}>12 V</option><option value={24}>24 V</option></select></td>
          <td><input className="input" type="number" min="0" step={c.kind==='strip'?'0.1':'1'} aria-label={(c.kind==='strip'?'Panjang':'Jumlah')+' rangkaian '+(i+1)} value={c.quantity||''} onChange={e=>patchCircuit(c.id,{quantity:num(e.target.value)})}/><small className="hint">{c.kind==='strip'?'meter':'unit modul'}</small></td>
          <td><input className="input" type="number" min="0" step="any" aria-label={'Daya satuan rangkaian '+(i+1)} value={c.powerPerUnit||''} onChange={e=>patchCircuit(c.id,{powerPerUnit:num(e.target.value)})}/><small className="hint">{c.kind==='strip'?'W / meter':'W / modul'}</small></td>
          <td className="numeric"><strong>{circuitWatts(c)>0?number(circuitWatts(c))+' W':'—'}</strong></td>
          <td><button className="icon-button" type="button" aria-label={'Hapus rangkaian '+c.name} onClick={()=>removeCircuit(c.id)}><Trash2 size={17}/></button></td>
        </tr>})}
      </tbody></table></div>}
      <div className="panel-body connection-note"><Info size={17}/><span>Strip: panjang × W/m. Modul: jumlah × W/unit. Arus DC: watt ÷ volt. Beban 12 V dan 24 V memakai PSU yang sesuai masing-masing.</span></div>
    </section>
    <section className="panel">
      <div className="panel-header"><div><h2 className="section-title">Komponen tambahan</h2><p className="section-subtitle">Catat kabel, konektor, terminal, atau perlengkapan lain secara manual.</p></div><button className="btn btn-secondary btn-small" type="button" onClick={()=>onChange({extras:[...project.extras,{id:uuid(),name:'Komponen baru',specification:'',quantity:1,unit:'pcs'}]})}><Plus size={17}/>Tambah komponen</button></div>
      {!project.extras.length ? <div className="panel-body connection-note"><Cable size={19}/><span>Spesifikasi dan panjang kabel ditentukan dari kebutuhan pemasangan Anda.</span></div> :
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Komponen</th><th>Spesifikasi / catatan</th><th>Jumlah</th><th>Satuan</th><th><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{project.extras.map((extra,i)=><tr key={extra.id}>
        <td><input className="input" aria-label={'Nama komponen '+(i+1)} value={extra.name} onChange={e=>onChange({extras:project.extras.map(x=>x.id===extra.id?{...x,name:e.target.value}:x)})}/></td>
        <td><input className="input" aria-label={'Spesifikasi komponen '+(i+1)} value={extra.specification} placeholder="Diisi manual" onChange={e=>onChange({extras:project.extras.map(x=>x.id===extra.id?{...x,specification:e.target.value}:x)})}/></td>
        <td><input className="input" type="number" min="0" step="any" aria-label={'Jumlah komponen '+(i+1)} value={extra.quantity||''} onChange={e=>onChange({extras:project.extras.map(x=>x.id===extra.id?{...x,quantity:num(e.target.value)}:x)})}/></td>
        <td><input className="input" aria-label={'Satuan komponen '+(i+1)} value={extra.unit} placeholder="pcs / m / set" onChange={e=>onChange({extras:project.extras.map(x=>x.id===extra.id?{...x,unit:e.target.value}:x)})}/></td>
        <td><button className="icon-button" type="button" aria-label={'Hapus komponen '+extra.name} onClick={()=>onChange({extras:project.extras.filter(x=>x.id!==extra.id)})}><Trash2 size={17}/></button></td>
      </tr>)}</tbody></table></div>}
    </section>
  </>;
}

function CatalogWattsInput({watts,label,onChange}:{watts:number;label:string;onChange:(value:number)=>void}) {
  const [draft,setDraft]=useState(String(watts));
  useEffect(()=>setDraft(String(watts)),[watts]);
  const valid=draft.trim()!=='' && Number.isFinite(Number(draft)) && Number(draft)>0;
  return <><input className="input" type="number" min="0" step="any" aria-label={label} aria-invalid={!valid} value={draft} onChange={e=>{const next=e.target.value;setDraft(next);if(next.trim()!==''&&Number.isFinite(Number(next))&&Number(next)>0)onChange(Number(next));}} onBlur={()=>{if(!valid)setDraft(String(watts));}}/>{!valid&&<small className="form-error">Isi kapasitas lebih dari 0 W.</small>}</>;
}

export function CatalogEditor({catalog,onChange}:{catalog:PsuSpec[];onChange:(catalog:PsuSpec[])=>void}) {
  const patch=(id:string,values:Partial<PsuSpec>)=>onChange(catalog.map(p=>p.id===id?{...p,...values}:p));
  function remove(spec:PsuSpec) {if(window.confirm('Hapus '+spec.name+' dari katalog? Proyek manual yang memakainya akan ditandai untuk diperiksa.'))onChange(catalog.filter(p=>p.id!==spec.id));}
  return <section className="panel">
    <div className="panel-header"><div><h2 className="section-title">Katalog power supply</h2><p className="section-subtitle">{catalog.length} pilihan kapasitas untuk rekomendasi proyek.</p></div><button className="btn btn-primary btn-small" type="button" onClick={()=>onChange([...catalog,{id:uuid(),name:'PSU baru',voltage:24,watts:100}])}><Plus size={17}/>Tambah PSU</button></div>
    <div className="panel-body"><div className="alert alert-info"><Info size={18}/><span>Daftar awal berisi kapasitas contoh. Sesuaikan tegangan dan kapasitas dengan nameplate PSU yang akan Anda gunakan. Perubahan katalog langsung diperiksa pada seluruh proyek.</span></div></div>
    {!catalog.length ? <div className="empty-state"><SlidersHorizontal className="empty-icon"/><h3>Katalog masih kosong</h3><p>Tambahkan kapasitas PSU untuk mendapatkan rekomendasi.</p></div> :
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Nama PSU</th><th>Tegangan keluaran</th><th>Kapasitas (W)</th><th className="numeric">Arus nominal DC</th><th><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{catalog.map((spec,i)=><tr key={spec.id}>
      <td><input className="input" aria-label={'Nama katalog PSU '+(i+1)} value={spec.name} maxLength={160} onChange={e=>patch(spec.id,{name:e.target.value})}/></td>
      <td><select className="select" aria-label={'Tegangan katalog PSU '+(i+1)} value={spec.voltage} onChange={e=>patch(spec.id,{voltage:Number(e.target.value) as Voltage})}><option value={12}>12 V DC</option><option value={24}>24 V DC</option></select></td>
      <td><CatalogWattsInput watts={spec.watts} label={'Kapasitas katalog PSU '+(i+1)} onChange={watts=>patch(spec.id,{watts})}/></td>
      <td className="numeric">{number(spec.watts/spec.voltage)} A</td>
      <td><button className="icon-button" type="button" aria-label={'Hapus katalog '+spec.name} onClick={()=>remove(spec)}><Trash2 size={17}/></button></td>
    </tr>)}</tbody></table></div>}
  </section>;
}
