import {randomUUID} from 'node:crypto';

/** Retire older published builds only after a newer build is verified and rankable. Keep all evidence and score history. */
export async function replacePriorResonatorBuilds(tx,{id,uid,character,reviewer,now=new Date().toISOString()}){
 const previous=(await tx.execute({sql:"SELECT id FROM submissions WHERE uid=? AND character=? AND status='approved' AND replaced_by IS NULL AND id<>?",args:[uid,character,id]})).rows;
 for(const row of previous){
  const previousId=String(row.id);
  const updated=await tx.execute({sql:'UPDATE submissions SET replaced_by=? WHERE id=? AND replaced_by IS NULL',args:[id,previousId]});
  if(updated.rowsAffected===1)await tx.execute({sql:'INSERT INTO admin_audit_events VALUES (?,?,?,?,?,?)',args:[randomUUID(),previousId,'build_replaced',reviewer,JSON.stringify({replacedBy:id,character}),now]});
 }
 return {replaced:previous.length};
}
