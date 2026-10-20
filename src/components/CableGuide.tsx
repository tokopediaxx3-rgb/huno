import {Cable,Info,ShieldCheck,TriangleAlert} from 'lucide-react';
import type {Project,ProjectAnalysis,WireColor,WirePlan} from '../types';
import {AC_REFERENCE,WIRE_COLORS,cableConnections,getWireColor,resolveWirePlan} from '../lib/wiring';

export function WireColorLabel({color}:{color:WireColor}) {
  const definition=getWireColor(color);
  return <span className="wire-color-label"><span className="wire-swatch" aria-hidden="true" style={{background:definition.hex}}/>{definition.label}</span>;
}
export function CableGuide({project,analysis,onChange}:{project:Project;analysis:ProjectAnalysis;onChange?:(patch:Partial<Project>)=>void}) {
  const plan=resolveWirePlan(project),connections=cableConnections(project,analysis);
  const placed=new Set(analysis.supplies.flatMap(s=>s.circuits.map(c=>c.id)));
  const unassigned=project.circuits.filter(c=>!placed.has(c.id));
  const change=(patch:Partial<WirePlan>)=>onChange?.({wiring:{...plan,...patch}});
  const sameColors=plan.positiveColor===plan.negativeColor;
  return <section className="panel cable-guide" data-testid="cable-guide">
    <div className="panel-header"><div><h2 className="section-title">Panduan kabel</h2><p>Warna, terminal asal–tujuan, dan fungsi setiap jalur sambungan.</p></div><Cable size={22}/></div>
    <div className="panel-body">
      <div className="alert alert-info"><Info size={18}/><div><strong>Warna adalah rencana proyek; label terminal adalah acuan utama.</strong><p>V+ / +V berarti positif DC; V− / −V berarti negatif DC. Cocokkan label dan datasheet perangkat karena warna kabel pabrik dapat berbeda. Panduan DC ini untuk LED satu warna dua kabel 12/24 V; RGB/RGBW memerlukan controller dan pemetaan terminal tersendiri.</p></div></div>
      <div className="wire-legend" aria-label="Legenda warna kabel DC">
        <div className="wire-legend-item"><span className="wire-terminal">V+ / +V</span><WireColorLabel color={plan.positiveColor}/><p>Positif DC: terminal V+ PSU ke terminal + LED.</p></div>
        <div className="wire-legend-item"><span className="wire-terminal">V− / −V</span><WireColorLabel color={plan.negativeColor}/><p>Negatif DC: terminal V− PSU ke terminal − LED.</p></div>
      </div>
      {onChange&&<div className="wire-plan-editor screen-only"><div className="form-grid">
        <label className="field"><span>Warna kabel positif DC (V+)</span><select className="select" aria-label="Warna kabel positif DC" value={plan.positiveColor} onChange={e=>change({positiveColor:e.target.value as WireColor})}>{WIRE_COLORS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label className="field"><span>Warna kabel negatif DC (V−)</span><select className="select" aria-label="Warna kabel negatif DC" value={plan.negativeColor} onChange={e=>change({negativeColor:e.target.value as WireColor})}>{WIRE_COLORS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      </div><p className="hint">Warna disimpan untuk proyek ini dan dipakai pada skema, daftar sambungan, serta laporan cetak. Hijau-kuning dicadangkan untuk konduktor proteksi.</p></div>}
      {sameColors&&<div className="alert alert-warning" role="alert"><TriangleAlert size={18}/><span>Kedua jalur DC memakai warna yang sama. Bedakan warna atau beri penanda + dan − yang jelas pada kedua ujung kabel.</span></div>}
      <div className="section-heading"><div><h3 className="section-title">Daftar sambungan kabel DC</h3><p className="section-subtitle">Mengikuti penempatan PSU pada proyek ini.</p></div><span className="tag" data-testid="dc-wire-count">{connections.length} jalur DC</span></div>
      {analysis.status!=='ready'&&analysis.issues.length>0&&<div className={'alert '+(analysis.status==='incomplete'?'alert-error':'alert-warning')}><TriangleAlert size={18}/><span>Alokasi listrik masih memiliki catatan pemeriksaan. Perbaiki spesifikasi atau pembagian PSU pada tab Power supply sebelum memakai daftar sambungan ini.</span></div>}
      {connections.length?<div className="table-wrap"><table className="data-table wire-table" data-testid="dc-connection-table"><thead><tr><th scope="col">Area / PSU</th><th scope="col">Dari terminal</th><th scope="col">Ke terminal LED</th><th scope="col">Warna kabel</th><th scope="col">Keterangan</th><th scope="col">Pemeriksaan</th></tr></thead><tbody>{connections.map(row=><tr key={row.id} data-polarity={row.polarity}><td><strong>{row.supplyName}</strong><small className="hint">{row.zoneName}</small></td><td><span className="wire-terminal">{row.source}</span></td><td>{row.target}</td><td><WireColorLabel color={row.color}/></td><td>{row.description}</td><td><span className={'badge badge-'+(row.status==='error'?'error':row.status==='warning'?'warning':'ready')}>{row.status==='error'?'Perbaiki rencana':row.status==='warning'?'Periksa catatan':'Terminal terpetakan'}</span></td></tr>)}</tbody></table></div>:<div className="empty-state"><Cable className="empty-icon"/><h3>Belum ada sambungan DC</h3><p>Tambahkan rangkaian LED dan tempatkan pada PSU untuk menampilkan terminal asal–tujuannya.</p></div>}
      {!!unassigned.length&&<div className="alert alert-error" role="alert"><TriangleAlert size={18}/><div><strong>Rangkaian belum memiliki tujuan PSU:</strong><ul className="issue-list">{unassigned.map(c=><li key={c.id}>{c.name||'Rangkaian tanpa nama'}</li>)}</ul></div></div>}
      <p className="hint">Jumlah jalur di atas bukan panjang kabel. Panjang, penampang, konektor, dan jumlah bahan ditentukan sesuai pemasangan dan dicatat pada Komponen tambahan.</p>
      {onChange?<label className="field wire-notes-editor screen-only"><span>Catatan penyambungan</span><textarea className="textarea" aria-label="Catatan penyambungan" maxLength={4000} value={plan.notes} placeholder="Misalnya penandaan ujung kabel, konektor, atau jalur pemasangan per area." onChange={e=>change({notes:e.target.value})}/></label>:null}
      {plan.notes.trim()&&<div className="wire-notes" data-testid="wire-notes"><strong>Catatan penyambungan proyek</strong><p>{plan.notes}</p></div>}
      <section className="wire-ac-reference" aria-label="Referensi input AC PSU"><div className="section-heading"><div><h3 className="section-title">Referensi input AC PSU</h3><p className="section-subtitle">Khusus perangkat dengan terminal L, N, dan PE/FG berlabel.</p></div><span className="tag">REFERENSI TERPISAH</span></div>
        <p>Berikut acuan warna harmonisasi Eropa pada manual PSU. Warna instalasi setempat bisa berbeda; periksa label terminal dan petunjuk pabrikan. Tabel ini bukan hasil identifikasi kabel aktual.</p>
        <div className="table-wrap"><table className="data-table" data-testid="ac-wire-reference"><thead><tr><th scope="col">Terminal PSU</th><th scope="col">Warna acuan</th><th scope="col">Fungsi</th></tr></thead><tbody>{AC_REFERENCE.map(row=><tr key={row.terminal}><td><span className="wire-terminal">{row.terminal}</span></td><td><span className="wire-color-label"><span className="wire-swatch" aria-hidden="true" style={{background:row.swatch}}/>{row.color}</span></td><td>{row.function}</td></tr>)}</tbody></table></div>
        <div className="alert alert-warning wire-installation-note"><ShieldCheck size={19}/><div><strong>Putuskan sumber listrik sebelum perakitan.</strong><p>N, PE/FG, dan V− memiliki fungsi berbeda; aplikasi tidak menghubungkannya secara otomatis. Untuk adaptor tertutup atau PSU Class II tanpa FG, ikuti petunjuk pabrikan. Sambungan AC ditangani teknisi yang kompeten.</p></div></div>
        <p className="wire-source-note">Acuan: <a href="https://www.meanwell.eu/Upload/PDF/Enclosed_Type_EN.pdf" target="_blank" rel="noreferrer">Manual pemasangan MEAN WELL</a> dan <a href="https://www.electrical-installation.org/enwiki/Cables_and_busways" target="_blank" rel="noreferrer">panduan identifikasi konduktor Schneider Electric</a>.</p>
      </section>
    </div>
  </section>;
}
