export type RankedRow={uid:string;global_rank:number|string;id?:string;score?:number|string};
export type RankHistoryEntry={rank:number;previousRank:number|null;movement:number|null;rankSince:string|null;trackingSince?:string;buildId?:string;score?:number};
export function nextRankHistory(rows:RankedRow[],previous:Record<string,RankHistoryEntry>,now:string):Record<string,RankHistoryEntry>;
