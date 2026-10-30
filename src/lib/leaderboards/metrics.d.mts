export type LeaderboardMetric = { id:string; label:string; field:string; icon:string; percent?:boolean };
export const selectableLeaderboardMetrics: LeaderboardMetric[];
export function attributeMetric(resonator:{element:string}):LeaderboardMetric;
export function damageMetric(resonator:{leaderboardDamageStat:string}):LeaderboardMetric;
export function defaultLeaderboardColumns(resonator:{element:string;leaderboardDamageStat:string}):{primary:LeaderboardMetric;attribute:LeaderboardMetric;damage:LeaderboardMetric;recovery:LeaderboardMetric};
export function formatLeaderboardMetric(value:number|undefined,percent?:boolean):string;
