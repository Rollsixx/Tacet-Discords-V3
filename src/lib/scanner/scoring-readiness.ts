export type VisualReportSlot={slot:number;cost:number;echo:string|null;set:string|null;problem:string|null};
export type ScoringReadiness={stats:boolean;echoes:number;sonatas:number;ready:boolean;reason:string};
export function visualReadiness(report:VisualReportSlot[],stats=true):ScoringReadiness{
 const echoes=report.filter(s=>s.echo).length,sonatas=report.filter(s=>s.set).length;
 return {stats,echoes,sonatas,ready:stats&&echoes===5&&sonatas===5,reason:report.find(s=>s.problem)?.problem||(!stats?'Stats need a new scan.':'Preliminary visual checks passed. The server verifies the original screenshot on upload.')};
}

export function assessmentReadiness(a:{eligible?:boolean;statsVerified?:boolean;reason?:string;visualReport?:VisualReportSlot[];calculation?:{identities:{echo:string;set:string}[]}}|undefined):ScoringReadiness{
 const report=a?.visualReport||a?.calculation?.identities.map((s,i)=>({slot:i+1,cost:0,echo:s.echo,set:s.set,problem:null}))||[];
 return {...visualReadiness(report,a?.statsVerified===true||a?.eligible===true),ready:a?.eligible===true,reason:a?.reason||'Scoring evidence is unavailable.'};
}
