export type ConsistencyItem =
 | {type:"stale-score";id:string;uid:string;character:string;reason:string}
 | {type:"duplicate-active-build";uid:string;character:string;count:number}
 | {type:"medal-total-mismatch";uid:string;profile:unknown;standings:unknown};
export function buildDataConsistencyReport(input?:{
 staleScores?:Array<{id:string;uid:string;character:string;reason?:string}>;
 duplicateBuilds?:Array<{uid:string;character:string;count:number}>;
 medalMismatches?:Array<{uid:string;profile:unknown;standings:unknown}>;
 checkedAt?:string;
}):{checkedAt:string;ok:boolean;counts:{staleScores:number;duplicateBuilds:number;medalMismatches:number};issues:ConsistencyItem[]};
