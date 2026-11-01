export function queueReadiness(build){
 const assessment=build?.data?.assessment||{};
 if(build?.status==='approved')return build.score!=null?{label:'Ranked',state:'ready'}:{label:'Published · unranked',state:'blocked'};
 if(assessment.awaitingRotation)return {label:'Awaiting rotation',state:'waiting'};
 const report=assessment.visualReport||[];
 const equipmentReady=assessment.equipmentReady===true||assessment.eligible===true||assessment.calculation?.identities?.length===5||(report.length===5&&report.every(slot=>slot.echo&&slot.set&&!slot.problem));
 if(!assessment.statsVerified&&!assessment.eligible)return {label:'Blocked',state:'blocked'};
 if(!equipmentReady||build?.identityVerified!==true)return {label:'Needs identity review',state:'review'};
 if(assessment.eligible===true)return {label:'Ready to approve',state:'ready'};
 return {label:'Blocked',state:'blocked'};
}
