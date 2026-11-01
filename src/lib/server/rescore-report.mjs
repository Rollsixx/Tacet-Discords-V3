export function recordRescoreSkip(result,reason){
 result.skipped++;
 result.skippedReasons[reason]=(result.skippedReasons[reason]||0)+1;
}
