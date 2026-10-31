// Only the submission endpoint loads server OCR and canonical screenshot verification.
import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import type {Client} from '@libsql/client';
import {database} from './database.ts';
import {HttpError,type SubmissionInput} from './validation.ts';
import {assessSource} from './source-evidence.mjs';
import {visualReadiness,assessmentReadiness} from '../scanner/scoring-readiness.ts';
import {POLICY_VERSION} from './scoring-versions.mjs';
import {applyPublishedRotation} from './rotations/store.mjs';
import {autoApproveVerifiedSubmission} from './approval-workflow.mjs';
export async function submit(input: SubmissionInput, db: Client = database(), requireSourceUid = false) {
  const sourceAssessment = await assessSource(input);
  const retainedAssessment={...sourceAssessment};delete retainedAssessment.ocrReadings;
  const assessment = {...retainedAssessment, ...(sourceAssessment.statsVerified && input.sourceImage ? {cropEvidenceVersion:'source-crops/1'} : {})};
  if (requireSourceUid && assessment.reason.startsWith("Scoring worker busy")) throw new HttpError(429, "Scanner is busy. Please try again in a moment.");
  if (requireSourceUid && assessment.failure?.code==='OCR_SERVICE_UNAVAILABLE')throw new HttpError(503,assessment.failure.message);
  if (requireSourceUid && assessment.sourceUid !== input.uid) throw new HttpError(400, "Screenshot UID could not be confirmed. Upload a clear original card; UID cannot be changed.");
  // Retain server-derived visual evidence. Client crops never establish scoring identity.
  const sourceCrops = input.sourceImage && assessment.sourceUid === input.uid ? await Promise.all(input.slots.map(async (slot,index)=>({
    ...slot,
    portrait:await sharp(input.sourceImage).extract({left:22+index*374,top:650,width:192,height:182}).png().toBuffer(),
    sonata:await sharp(input.sourceImage).extract({left:264+index*374,top:660,width:56,height:56}).png().toBuffer(),
  }))) : input.slots;
  let data = {
    assessment,
    character: input.character,
    slots: requireSourceUid && assessment.statsVerified ? assessment.sourceSlots : input.slots.map(({ slot, cost, mainStat, substats }) => ({ slot, cost, mainStat, substats })),
    recognition: "unverified",
  };
  data=await applyPublishedRotation(db,input.character,data);
  const hash = createHash("sha256").update(input.uid).update(input.character.toLowerCase());
  for (const slot of sourceCrops) {
    hash.update(JSON.stringify([slot.cost.value, slot.mainStat.value, slot.substats.map(x => x.value)]));
    hash.update(slot.portrait).update(slot.sonata);
  }
  // A new scoring policy/evidence can be resubmitted; duplicates within it cannot.
  hash.update(data.assessment.eligible ? POLICY_VERSION : "unscored");
  const fingerprint = hash.digest("hex");
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const tx = await db.transaction("write");
  try {
    const duplicate = await tx.execute({ sql: "SELECT id FROM submissions WHERE fingerprint=?", args: [fingerprint] });
    if (duplicate.rows.length) throw new HttpError(409, "This build has already been submitted.");
    const recent = await tx.execute({ sql: "SELECT COUNT(*) AS count FROM submissions WHERE uid=? AND created_at>?", args: [input.uid, new Date(Date.now() - 60000).toISOString()] });
    if (Number(recent.rows[0].count) >= 10) throw new HttpError(429, "Please wait before submitting another build for this UID.");
    await tx.execute({ sql: "INSERT INTO players(uid,created_at) VALUES (?,?) ON CONFLICT(uid) DO NOTHING", args: [input.uid, createdAt] });
    if(input.avatarCharacter && assessment.sourceUid === input.uid) await tx.execute({sql:"UPDATE players SET avatar_character=? WHERE uid=?",args:[input.avatarCharacter,input.uid]});
    await tx.execute({ sql: "INSERT INTO submissions(id,uid,ign,character,fingerprint,data,created_at,identity_verified) VALUES (?,?,?,?,?,?,?,(SELECT identity_verified FROM players WHERE uid=?))", args: [id, input.uid, input.ign, input.character, fingerprint, JSON.stringify(data), createdAt, input.uid] });
    if(input.sourceImage&&assessment.sourceUid===input.uid)await tx.execute({sql:'INSERT INTO submission_source_evidence VALUES (?,?,?,?,?,?,?)',args:[id,input.sourceImage,assessment.sourceHash||createHash('sha256').update(input.sourceImage).digest('hex'),JSON.stringify(sourceAssessment.ocrReadings||[]),JSON.stringify(assessment.sourceSlots||[]),JSON.stringify(input.slots.map(({slot,cost,mainStat,substats})=>({slot,cost,mainStat,substats}))),createdAt]});
    for (const slot of sourceCrops) {
      for (const kind of ["portrait", "sonata"] as const) {
        await tx.execute({ sql: "INSERT INTO assets(id,submission_id,slot,kind,png) VALUES (?,?,?,?,?)", args: [`${id}-${slot.slot}-${kind}`, id, slot.slot, kind, slot[kind]] });
      }
    }
    await tx.commit();
    let status:"pending"|"approved"="pending";
    if(requireSourceUid){
      try{if(await autoApproveVerifiedSubmission(id,db))status="approved";}
      catch{ /* A durable submission remains pending if automatic scoring or audit work is unavailable. */ }
    }
    return { ok: true, id, status, createdAt, readiness:{...visualReadiness(assessment.visualReport||[],assessment.statsVerified===true),rolls:assessment.rollsVerified??(assessment.eligible?true:null),ready:data.assessment.eligible,awaitingRotation:assessmentReadiness(data.assessment).awaitingRotation,reason:data.assessment.reason} };
  } finally { tx.close(); }
}
