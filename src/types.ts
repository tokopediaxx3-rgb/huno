export type Voltage=12|24;
export type WireColor='red'|'black'|'blue'|'white'|'brown'|'gray'|'orange';
export interface WirePlan {positiveColor:WireColor;negativeColor:WireColor;notes:string}
export type LedKind='strip'|'module';
export interface Zone {id:string;name:string}
export interface LedCircuit {id:string;name:string;zoneId:string;kind:LedKind;voltage:Voltage;quantity:number;powerPerUnit:number}
export interface PsuSpec {id:string;name:string;voltage:Voltage;watts:number}
export interface PsuAssignment {id:string;zoneId:string;catalogId:string;circuitIds:string[]}
export interface ExtraComponent {id:string;name:string;specification:string;quantity:number;unit:string}
export interface Project {id:string;name:string;client:string;location:string;eventDate:string;createdAt:string;updatedAt:string;targetLoad:number;mode:'auto'|'manual';zones:Zone[];circuits:LedCircuit[];assignments:PsuAssignment[];extras:ExtraComponent[];wiring?:WirePlan}
export interface AppData {version:1;catalog:PsuSpec[];projects:Project[]}
export interface Issue {code:string;message:string;severity:'error'|'warning';circuitId?:string;supplyId?:string}
export interface SupplyAnalysis {assignment:PsuAssignment;spec:PsuSpec|undefined;circuits:LedCircuit[];watts:number;amps:number;utilization:number;issues:Issue[];status:'ready'|'warning'|'error'}
export interface ProjectAnalysis {assignments:PsuAssignment[];supplies:SupplyAnalysis[];issues:Issue[];totalWatts:number;requiredWatts:number;capacityWatts:number;currents:{12:number;24:number};status:'empty'|'incomplete'|'warning'|'ready'}
export interface BomItem {key:string;name:string;specification:string;quantity:number;unit:string}
