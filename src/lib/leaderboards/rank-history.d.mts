export type RankedRow={uid:string;global_rank:number|string;id?:string;score?:number|string};
export type RankHistoryEntry={rank:number;previousRank:number|null;movement:number|null;movementSince?:string|null;newSince?:string|null;snapshotAt?:string;rankSince:string|null;trackingSince?:string;buildId?:string;score?:number};
export function nextRankHistory(rows:RankedRow[],previous:Record<string,RankHistoryEntry>,now:string,previousSnapshotAt?:string|null,hasBaseline?:boolean):Record<string,RankHistoryEntry>;
export type RankHistoryEvent={uid:string;type:"moved"|"entered"|"left";oldRank:number|null;newRank:number|null;oldScore:number|null;newScore:number|null;oldBuildId:string|null;newBuildId:string|null;changedAt:string};
export function rankHistoryEvents(rows:RankedRow[],previous:Record<string,RankHistoryEntry>,hasBaseline:boolean,now:string):RankHistoryEvent[];
