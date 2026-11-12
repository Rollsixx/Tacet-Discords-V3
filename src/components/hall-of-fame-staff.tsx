"use client";
import {useEffect,useState} from "react";
import type {FormEvent} from "react";
import Link from "next/link";

type Staff={id:string;label:string;role:string;title:string;revoked_at:string|null};
type Actor={id:string;role:string;title:string;label:string};
type Props={initialToken?:string;embedded?:boolean};
const titles={chief_steward:"Chief Steward",astral_modulator:"Astral Modulator",bloom_bearer:"Bloom Bearer",consultant:"Consultant"} as const;
const scopes={
 chief_steward:"Full Black Shores access, including staff tokens.",
 astral_modulator:"Full Black Shores access, including staff tokens.",
 bloom_bearer:"Dashboard, Submissions, and Players & Builds. Can perform review operations in those areas.",
 consultant:"Read-only overview and player build access.",
} as const;
export default function HallOfFameStaff({initialToken="",embedded=false}:Props){
 const[token,setToken]=useState(initialToken),[actor,setActor]=useState<Actor|null>(null),[staff,setStaff]=useState<Staff[]>([]),[oneTime,setOneTime]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(false);
 async function api(method:"GET"|"POST",body?:Record<string,unknown>){
  const response=await fetch("/api/hall-of-fame/admin",{method,headers:{Authorization:"Bearer "+token.trim(),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Black Shores request failed.");return data;
 }
 async function refresh(){setLoading(true);setError("");try{const data=await api("GET");setActor(data.actor);setStaff(data.staff||[]);}catch(cause){setError(cause instanceof Error?cause.message:"Could not load staff tokens.");}finally{setLoading(false);}}
 async function createStaff(event:FormEvent<HTMLFormElement>){event.preventDefault();const formElement=event.currentTarget;const form=new FormData(formElement);setLoading(true);setError("");setMessage("");try{const data=await api("POST",{action:"create_staff",label:form.get("label"),title:form.get("title")});setOneTime(data.token||"");setMessage("Token created. Copy it now; it is shown only once.");formElement.reset();await refresh();}catch(cause){setError(cause instanceof Error?cause.message:"Could not create token.");}finally{setLoading(false);}}
 async function revoke(member:Staff){if(!window.confirm("Revoke this token? The member will lose access immediately."))return;setLoading(true);setError("");setMessage("");try{await api("POST",{action:"revoke_staff",staffId:member.id});setMessage(member.label+"'s token was revoked.");await refresh();}catch(cause){setError(cause instanceof Error?cause.message:"Could not revoke token.");}finally{setLoading(false);}}
 useEffect(()=>{if(token.length>20){void refresh();}},[token]);
 const isFull=actor&&(actor.role==="owner"||actor.role==="hall_of_fame_admin");
 const Container=embedded?"div":"main";
 return <Container className={"hof-admin"+(embedded?" embedded":"")}><style jsx global>{`.hof-admin{max-width:1120px;margin:28px auto 80px;padding:0 20px;color:#edf5f8}.hof-admin h1{font-size:32px}.hof-admin p{color:#9cafbc}.hof-admin section{padding:20px;margin:18px 0;border:1px solid #293c46;border-radius:14px;background:#111922}.hof-admin form{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:end}.hof-admin label{display:grid;gap:6px;color:#aebec8;font-size:13px}.hof-admin input,.hof-admin select{width:100%;background:#080e14;color:#edf5f8;border:1px solid #344651;border-radius:8px;padding:11px}.hof-admin button{background:#183038;border:1px solid #3b6068;color:#eaf7f8;border-radius:8px;padding:11px 14px;cursor:pointer;font-weight:700}.hof-admin button:disabled{opacity:.5}.hof-admin .success{color:#86eadc}.hof-admin .error{color:#ff9b9b}.hof-admin.embedded{max-width:none;margin:0;padding:0}.hof-admin .role-guide{padding:14px 16px;border:1px solid #285963;border-left:4px solid #56d6cb;border-radius:12px;background:#10212b;margin:16px 0}.hof-admin .role-guide strong{color:#b7fff5}.hof-admin .role-guide p{margin:8px 0 0;line-height:1.6}.hof-admin .staff-list{display:grid;gap:10px}.hof-admin .staff-item{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;padding:14px;border:1px solid #293c46;border-radius:10px;background:#0b1219}.hof-admin .staff-item p{margin:4px 0}.hof-admin .staff-token{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px}.hof-admin .staff-token code{max-width:100%;overflow-wrap:anywhere;padding:12px 14px;background:#080e14;border:1px solid #344651;border-radius:8px;color:#a9fff2}.hof-admin button:focus-visible,.hof-admin input:focus-visible,.hof-admin select:focus-visible{outline:2px solid #75e1d6;outline-offset:2px}`}</style>
 {!embedded&&<header><Link href="/BlackShores">← Black Shores admin</Link><h1>Staff tokens</h1><p>Create individual access tokens with clear Black Shores roles.</p></header>}
 {!initialToken&&<section><label>Black Shores access token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste a full-access token"/></label><small>Tokens stay in this tab’s memory. New staff tokens are shown once.</small></section>}
 {actor&&<section className="role-guide"><strong>Hello, {actor.title==="owner"?"Arbiter":actor.label} · {actor.title==="owner"?"Arbiter":titles[actor.title as keyof typeof titles]||actor.title}</strong><p>Issue tokens by choosing a member’s name and title. The title determines which Black Shores pages and actions they can access.</p></section>}
 {(error||message)&&<section aria-live="polite">{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}</section>}
 {token.length>20&&!actor&&loading&&<section role="status">Checking Black Shores access…</section>}
 {token.length>20&&actor&&!isFull&&<section><p>Staff token management is limited to Arbiter, Chief Steward, and Astral Modulator.</p></section>}
 {token.length>20&&isFull&&<>
  <section><h2>Create a staff token</h2><div className="role-guide"><strong>Choose the member’s Black Shores title</strong><p>Chief Steward and Astral Modulator have full access, including staff tokens. Bloom Bearer can use Dashboard, Submissions, and Players & Builds. Consultant has read-only overview and player build access.</p></div><form onSubmit={createStaff}><label>Member name<input name="label" required maxLength={64} placeholder="Discord name or preferred name"/></label><label>Title<select name="title" defaultValue="bloom_bearer"><option value="chief_steward">Chief Steward · Full access</option><option value="astral_modulator">Astral Modulator · Full access</option><option value="bloom_bearer">Bloom Bearer · Review operations</option><option value="consultant">Consultant · Read only</option></select></label><button disabled={loading}>Create token</button></form>
   {oneTime&&<div className="staff-token"><code aria-label="New staff token">{oneTime}</code><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(oneTime);setMessage("Token copied. Send it privately to its owner.");}catch{setError("Clipboard access failed. Select and copy the token manually.");}}}>Copy token</button><button type="button" onClick={()=>setOneTime("")}>Hide token</button><small>Send privately. It cannot be retrieved after you hide it.</small></div>}
  </section>
  <section><h2>Staff access</h2><p>Review titles and revoke access from this list. There is no separate event-assignment step.</p>{staff.length?<div className="staff-list">{staff.map(member=><article className="staff-item" key={member.id}><div><strong>{member.label}</strong><p>{titles[member.title as keyof typeof titles]||member.title} · {member.revoked_at?"Revoked":"Active"}</p><small>{scopes[member.title as keyof typeof scopes]||"Legacy role; review and update this token title."}</small></div>{!member.revoked_at&&<button disabled={loading} onClick={()=>void revoke(member)}>Revoke token</button>}</article>)}</div>:<p>No staff tokens have been created yet.</p>}</section>
 </>}
 </Container>;
}

