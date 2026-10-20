import type {BomItem,Issue,LedCircuit,Project,ProjectAnalysis,PsuAssignment,PsuSpec,SupplyAnalysis,Voltage} from '../types';
const positive=(n:number)=>Number.isFinite(n)&&n>0;
const validVoltage=(n:number):n is Voltage=>n===12||n===24;
const fits=(load:number,limit:number)=>load<=limit||(limit>0&&(load-limit)/Math.max(Math.abs(load),Math.abs(limit))<=1e-10);
const validTarget=(n:number)=>positive(n)&&n<=100;
const validSpec=(s:PsuSpec)=>Boolean(s.id.trim()&&s.name.trim()&&validVoltage(s.voltage)&&positive(s.watts));
const validCircuit=(c:LedCircuit)=>Boolean(c.id.trim()&&c.name.trim()&&validVoltage(c.voltage)&&(c.kind==='strip'||c.kind==='module')&&positive(c.quantity)&&positive(c.powerPerUnit)&&(c.kind!=='module'||Number.isInteger(c.quantity))&&Number.isFinite(c.quantity*c.powerPerUnit));
const error=(code:string,message:string,extra:Partial<Issue>={}):Issue=>({code,message,severity:'error',...extra});
const warning=(code:string,message:string,extra:Partial<Issue>={}):Issue=>({code,message,severity:'warning',...extra});
const order=(a:string,b:string)=>a<b?-1:a>b?1:0;
/** Invalid drafts stay numeric; analysis reports their validation errors. */
export function circuitWatts(c:LedCircuit):number {return validCircuit(c)?c.quantity*c.powerPerUnit:0;}
function validate(project:Project,catalog:PsuSpec[]):Issue[] {
  const issues:Issue[]=[];
  if(!validTarget(project.targetLoad))issues.push(error('INVALID_TARGET','Target beban harus lebih dari 0% dan maksimal 100%.'));
  const zones=new Set<string>(),circuits=new Set<string>(),specs=new Set<string>();
  for(const z of project.zones){if(!z.id.trim()||zones.has(z.id))issues.push(error('DUPLICATE_ZONE','Identitas area tidak valid atau berulang.'));if(!z.name.trim())issues.push(error('EMPTY_ZONE_NAME','Lengkapi nama setiap area booth.'));zones.add(z.id);}
  for(const c of project.circuits){
    if(!c.id.trim()||circuits.has(c.id))issues.push(error('DUPLICATE_CIRCUIT','Identitas rangkaian tidak valid atau berulang.',{circuitId:c.id}));circuits.add(c.id);
    if(!validCircuit(c))issues.push(error('INVALID_CIRCUIT','Lengkapi '+(c.name||'rangkaian LED')+': nama, tegangan, jumlah/panjang, dan daya harus valid. Jumlah modul harus bilangan bulat.',{circuitId:c.id}));
    if(!zones.has(c.zoneId))issues.push(error('UNKNOWN_ZONE','Area untuk '+(c.name||'rangkaian LED')+' tidak ditemukan.',{circuitId:c.id}));
  }
  for(const s of catalog){if(!validSpec(s)||specs.has(s.id))issues.push(error('INVALID_CATALOG','Spesifikasi katalog '+(s.name||'PSU')+' tidak valid atau identitasnya berulang.'));specs.add(s.id);}
  for(const e of project.extras)if(!e.name.trim()||!e.unit.trim()||!positive(e.quantity))issues.push(error('INVALID_EXTRA','Lengkapi nama, jumlah positif, dan satuan komponen tambahan.'));
  return issues;
}
function finiteSum(numbers:number[],issues:Issue[],label:string,supplyId?:string):number {
  const total=numbers.reduce((sum,n)=>sum+n,0);if(Number.isFinite(total))return total;
  issues.push(error('NUMERIC_OVERFLOW',label+' terlalu besar untuk dihitung. Kurangi nilai spesifikasi.',supplyId?{supplyId}:{}));return 0;
}
/** Deterministic best-fit decreasing, isolated by area and voltage. Circuits are indivisible. */
export function recommendPowerSupplies(project:Project,catalog:PsuSpec[]):{assignments:PsuAssignment[];issues:Issue[]} {
  const issues=validate(project,catalog),assignments:PsuAssignment[]=[];
  if(!validTarget(project.targetLoad))return {assignments,issues};
  const groups=new Map<string,LedCircuit[]>(),seen=new Set<string>();
  for(const c of project.circuits){if(!validCircuit(c)||seen.has(c.id)||!project.zones.some(z=>z.id===c.zoneId))continue;seen.add(c.id);const key=c.zoneId+':'+c.voltage;groups.set(key,[...(groups.get(key)||[]),c]);}
  for(const [key,circuits] of [...groups].sort(([a],[b])=>order(a,b))){
    const first=circuits[0],candidates=catalog.filter(s=>validSpec(s)&&s.voltage===first.voltage).sort((a,b)=>a.watts-b.watts||order(a.id,b.id));
    if(!candidates.length){for(const c of circuits)issues.push(error('NO_COMPATIBLE_PSU','Tambahkan PSU '+c.voltage+' V ke katalog untuk '+c.name+'.',{circuitId:c.id}));continue;}
    const limit=candidates[candidates.length-1].watts*(project.targetLoad/100),bins:{watts:number;ids:string[]}[]=[];
    for(const c of [...circuits].sort((a,b)=>circuitWatts(b)-circuitWatts(a)||order(a.id,b.id))){
      const watts=circuitWatts(c);
      if(!fits(watts,limit)){issues.push(error('CIRCUIT_TOO_LARGE',c.name+' melebihi kapasitas PSU terbesar pada target beban. Bagi menjadi beberapa rangkaian atau tambahkan PSU yang lebih besar.',{circuitId:c.id}));continue;}
      let best=-1,remaining=Infinity;
      for(let i=0;i<bins.length;i++){const sum=bins[i].watts+watts;if(Number.isFinite(sum)&&fits(sum,limit)&&limit-sum<remaining){best=i;remaining=limit-sum;}}
      if(best===-1)bins.push({watts,ids:[c.id]});else{bins[best].watts+=watts;bins[best].ids.push(c.id);}
    }
    bins.forEach((bin,i)=>{const spec=candidates.find(s=>fits(bin.watts,s.watts*(project.targetLoad/100)));if(spec)assignments.push({id:'auto-'+key+'-'+(i+1),zoneId:first.zoneId,catalogId:spec.id,circuitIds:bin.ids});});
  }
  return {assignments,issues};
}
export function analyzeProject(project:Project,catalog:PsuSpec[]):ProjectAnalysis {
  const recommended=project.mode==='auto'?recommendPowerSupplies(project,catalog):{assignments:project.assignments,issues:validate(project,catalog)};
  const assignments=recommended.assignments,issues=[...recommended.issues],unique=[...new Map(project.circuits.map(c=>[c.id,c])).values()];
  const totalWatts=finiteSum(unique.map(circuitWatts),issues,'Total daya LED'),capacityIds=new Set<string>(),usedCircuits=new Map<string,number>();
  const supplies:SupplyAnalysis[]=assignments.map(assignment=>{
    const local:Issue[]=[],supplyId=assignment.id,spec=catalog.find(s=>s.id===assignment.catalogId);
    if(!supplyId.trim()||capacityIds.has(supplyId))local.push(error('DUPLICATE_SUPPLY','Identitas PSU tidak valid atau berulang.',{supplyId}));capacityIds.add(supplyId);
    if(!spec||!validSpec(spec))local.push(error('UNKNOWN_PSU','PSU tidak ditemukan atau spesifikasi katalog tidak valid.',{supplyId}));
    if(!project.zones.some(z=>z.id===assignment.zoneId))local.push(error('UNKNOWN_SUPPLY_ZONE','Area pemasangan PSU tidak ditemukan.',{supplyId}));
    const circuits:LedCircuit[]=[],localIds=new Set<string>();
    for(const id of assignment.circuitIds){
      usedCircuits.set(id,(usedCircuits.get(id)||0)+1);
      if(localIds.has(id)){local.push(error('DUPLICATE_ASSIGNMENT','Satu rangkaian dicantumkan berulang pada PSU yang sama.',{supplyId,circuitId:id}));continue;}localIds.add(id);
      const c=project.circuits.find(item=>item.id===id);if(!c){local.push(error('UNKNOWN_CIRCUIT','PSU mengacu ke rangkaian yang sudah tidak tersedia.',{supplyId,circuitId:id}));continue;}circuits.push(c);
      if(!validCircuit(c))local.push(error('INVALID_ASSIGNED_CIRCUIT','Spesifikasi '+(c.name||'rangkaian')+' belum valid.',{supplyId,circuitId:id}));
      if(c.zoneId!==assignment.zoneId)local.push(error('ZONE_MISMATCH',c.name+' dan PSU harus berada dalam area yang sama.',{supplyId,circuitId:id}));
      if(spec&&c.voltage!==spec.voltage)local.push(error('VOLTAGE_MISMATCH','Tegangan '+c.name+' tidak sesuai dengan keluaran PSU.',{supplyId,circuitId:id}));
    }
    if(!assignment.circuitIds.length)local.push(warning('EMPTY_SUPPLY','PSU belum memiliki rangkaian LED.',{supplyId}));
    const watts=finiteSum(circuits.map(circuitWatts),local,'Beban PSU',supplyId),amps=spec&&validVoltage(spec.voltage)?watts/spec.voltage:0;
    const rawUtilization=spec&&positive(spec.watts)?(watts/spec.watts)*100:0,utilization=Number.isFinite(rawUtilization)?rawUtilization:0;
    if(!Number.isFinite(rawUtilization))local.push(error('NUMERIC_OVERFLOW','Perbandingan beban dan kapasitas PSU terlalu besar.',{supplyId}));
    if(spec&&validSpec(spec)&&!fits(watts,spec.watts))local.push(error('PSU_OVERLOAD','Beban LED melebihi kapasitas nominal PSU.',{supplyId}));
    else if(spec&&validSpec(spec)&&validTarget(project.targetLoad)&&!fits(watts,spec.watts*(project.targetLoad/100)))local.push(warning('ABOVE_TARGET','Beban melampaui target pemakaian PSU yang Anda tetapkan.',{supplyId}));
    issues.push(...local);const status:SupplyAnalysis['status']=local.some(i=>i.severity==='error')?'error':local.length?'warning':'ready';
    return {assignment,spec,circuits,watts,amps,utilization,issues:local,status};
  });
  for(const c of unique){const count=usedCircuits.get(c.id)||0;if(!count)issues.push(error('UNASSIGNED_CIRCUIT',(c.name||'Rangkaian LED')+' belum terhubung ke PSU.',{circuitId:c.id}));if(count>1)issues.push(error('DUPLICATE_ASSIGNMENT',(c.name||'Rangkaian LED')+' harus terhubung tepat ke satu PSU.',{circuitId:c.id}));}
  const capacityWatts=finiteSum([...new Map(supplies.map(s=>[s.assignment.id,s])).values()].map(s=>s.spec&&validSpec(s.spec)?s.spec.watts:0),issues,'Total kapasitas PSU');
  const requested=validTarget(project.targetLoad)?totalWatts/(project.targetLoad/100):0,requiredWatts=Number.isFinite(requested)?requested:0;
  if(!Number.isFinite(requested))issues.push(error('NUMERIC_OVERFLOW','Kebutuhan kapasitas PSU terlalu besar untuk dihitung.'));
  const currents={12:finiteSum(unique.filter(c=>c.voltage===12).map(c=>circuitWatts(c)/12),issues,'Arus LED 12 V'),24:finiteSum(unique.filter(c=>c.voltage===24).map(c=>circuitWatts(c)/24),issues,'Arus LED 24 V')};
  const status:ProjectAnalysis['status']=issues.some(i=>i.severity==='error')?'incomplete':!project.circuits.length?'empty':issues.some(i=>i.severity==='warning')?'warning':'ready';
  return {assignments,supplies,issues,totalWatts,requiredWatts,capacityWatts,currents,status};
}
export function bomForProject(project:Project,analysis:ProjectAnalysis):BomItem[] {
  const rows=new Map<string,BomItem>();
  for(const c of project.circuits){if(!validCircuit(c))continue;const key='led-'+c.kind+'-'+c.voltage+'-'+c.powerPerUnit+'-'+c.name.trim(),quantity=(rows.get(key)?.quantity||0)+c.quantity;if(!Number.isFinite(quantity))continue;rows.set(key,{key,name:c.name.trim(),specification:c.voltage+' V DC · '+c.powerPerUnit+' W/'+(c.kind==='strip'?'m':'unit'),quantity,unit:c.kind==='strip'?'m':'unit'});}
  const seen=new Set<string>();
  for(const supply of analysis.supplies){if(!supply.spec||!validSpec(supply.spec)||seen.has(supply.assignment.id))continue;seen.add(supply.assignment.id);const s=supply.spec,key='psu-'+s.id;rows.set(key,{key,name:s.name,specification:s.voltage+' V DC · '+s.watts+' W',quantity:(rows.get(key)?.quantity||0)+1,unit:'unit'});}
  for(const e of project.extras){if(!e.name.trim()||!e.unit.trim()||!positive(e.quantity))continue;rows.set('extra-'+e.id,{key:'extra-'+e.id,name:e.name,specification:e.specification,quantity:e.quantity,unit:e.unit});}
  return [...rows.values()];
}
