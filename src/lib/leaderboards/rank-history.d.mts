export type RankedRow={uid:string;global_rank:number|string};
export type RankHistoryEntry={rank:number;previousRank:number|null;movement:number|null;rankSince:string|null};
export function nextRankHistory(rows:RankedRow[],previous:Record<string,RankHistoryEntry>,now:string):Record<string,RankHistoryEntry>;
