export type VisualReportSlot={slot:number;cost:number;echo:string|null;set:string|null;problem:string|null};
export type ScoringReadiness={stats:boolean;rolls?:boolean|null;echoes:number;sonatas:number;ready:boolean;awaitingRotation?:boolean;equipmentReady?:boolean;reason:string};
export function visualReadiness(report:VisualReportSlot[],stats=true):ScoringReadiness{
 const echoes=report.filter(s=>s.echo).length,sonatas=report.filter(s=>s.set).length;
 return {stats,echoes,sonatas,ready:stats&&echoes===5&&sonatas===5,reason:report.find(s=>s.problem)?.problem||(!stats?'Stats need a new scan.':'Preliminary visual checks passed. The server verifies the original screenshot on upload.')};
}

export function assessmentReadiness(a:{eligible?:boolean;awaitingRotation?:boolean;statsVerified?:boolean;rollsVerified?:boolean;reason?:string;visualReport?:VisualReportSlot[];calculation?:{identities:{echo:string;set:string}[]}}|undefined):ScoringReadiness{
 const report=a?.visualReport||a?.calculation?.identities.map((s,i)=>({slot:i+1,cost:0,echo:s.echo,set:s.set,problem:null}))||[];
 const equipmentReady=(a?.statsVerified===true||a?.eligible===true)&&a?.rollsVerified!==false&&report.length===5&&report.every(s=>s.echo&&s.set&&!s.problem);
 const awaitingRotation=a?.eligible!==true&&equipmentReady&&(a?.awaitingRotation===true||/awaiting.*(?:published|official|owner).*rotation/i.test(a?.reason||''));
 return {...visualReadiness(report,a?.statsVerified===true||a?.eligible===true),rolls:a?.rollsVerified??(a?.eligible===true?true:null),ready:a?.eligible===true,equipmentReady,awaitingRotation,reason:a?.reason||'Scoring evidence is unavailable.'};
}
