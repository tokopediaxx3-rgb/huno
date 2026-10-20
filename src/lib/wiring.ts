import type {Project,ProjectAnalysis,WireColor,WirePlan} from '../types';

export const WIRE_COLORS:{id:WireColor;label:string;hex:string}[]=[
  {id:'red',label:'Merah',hex:'#dc2626'},
  {id:'black',label:'Hitam',hex:'#202a35'},
  {id:'blue',label:'Biru',hex:'#2563eb'},
  {id:'white',label:'Putih',hex:'#ffffff'},
  {id:'brown',label:'Cokelat',hex:'#92400e'},
  {id:'gray',label:'Abu-abu',hex:'#64748b'},
  {id:'orange',label:'Oranye',hex:'#ea580c'}
];
export const DEFAULT_WIRING:WirePlan={positiveColor:'red',negativeColor:'black',notes:''};
export function isWireColor(value:unknown):value is WireColor {return WIRE_COLORS.some(c=>c.id===value);}
export function getWireColor(value:WireColor){return WIRE_COLORS.find(c=>c.id===value)!;}
export function resolveWirePlan(project:Pick<Project,'wiring'>):WirePlan {return {...DEFAULT_WIRING,...project.wiring};}

export interface CableConnection {
  id:string;supplyId:string;circuitId:string;supplyName:string;circuitName:string;zoneName:string;
  source:string;target:string;polarity:'positive'|'negative';color:WireColor;description:string;
  status:'ready'|'warning'|'error';
}
/** Derive connections from the effective PSU allocation, never from aggregate watts. */
export function cableConnections(project:Project,analysis:ProjectAnalysis):CableConnection[] {
  const plan=resolveWirePlan(project),rows:CableConnection[]=[];
  const invalidPlan=analysis.issues.some(issue=>issue.severity==='error'&&!issue.circuitId&&!issue.supplyId);
  const sameColors=plan.positiveColor===plan.negativeColor;
  for(const [index,supply] of analysis.supplies.entries()){
    const supplyName='PSU '+(index+1),zoneName=project.zones.find(z=>z.id===supply.assignment.zoneId)?.name||'Area tidak ditemukan';
    for(const circuit of supply.circuits){
      const related=analysis.issues.filter(issue=>issue.circuitId===circuit.id||issue.supplyId===supply.assignment.id);
      const status:CableConnection['status']=invalidPlan||related.some(i=>i.severity==='error')?'error':supply.status==='error'?'error':sameColors?'warning':supply.status;
      const circuitName=circuit.name||'Rangkaian tanpa nama';
      const shared={supplyId:supply.assignment.id,circuitId:circuit.id,supplyName,circuitName,zoneName,status};
      rows.push({...shared,id:supply.assignment.id+':'+circuit.id+':positive',source:supplyName+' · V+',target:circuitName+' · +',polarity:'positive',color:plan.positiveColor,description:'Positif DC menuju terminal + LED. Tegangan PSU dan LED harus sesuai.'});
      rows.push({...shared,id:supply.assignment.id+':'+circuit.id+':negative',source:supplyName+' · V−',target:circuitName+' · −',polarity:'negative',color:plan.negativeColor,description:'Jalur kembali DC dari terminal − LED ke V− PSU. Ini bukan netral AC atau PE.'});
    }
  }
  return rows;
}
export const AC_REFERENCE=[
  {terminal:'L / AC-L',color:'Cokelat',swatch:'#92400e',function:'Fasa input AC; cocokkan dengan label L pada PSU.'},
  {terminal:'N / AC-N',color:'Biru',swatch:'#2563eb',function:'Netral input AC; cocokkan dengan label N pada PSU.'},
  {terminal:'PE / FG / ⏚',color:'Hijau-kuning',swatch:'repeating-linear-gradient(135deg,#15803d 0 5px,#facc15 5px 10px)',function:'Konduktor proteksi ke terminal pembumian/FG yang ditentukan pabrikan.'}
];
