import { createHash, timingSafeEqual } from "node:crypto";
import { database, migrateOnce } from "./database";
import { HttpError } from "./validation";

export type WorkspaceTitle = "arbiter" | "chief_steward" | "astral_modulator" | "bloom_bearer" | "consultant";
export type WorkspaceActor = { id: string; title: WorkspaceTitle; label: string; technicalRole: "owner" | "hall_of_fame_admin" | "organizer" | "referee" };

const digest = (value: string) => createHash("sha256").update(value).digest();
const equalSecret = (left: string, right: string) => timingSafeEqual(digest(left), digest(right));
export function titleLabel(title: WorkspaceTitle) {
  return ({ arbiter: "Arbiter", chief_steward: "Chief Steward", astral_modulator: "Astral Modulator", bloom_bearer: "Bloom Bearer", consultant: "Consultant" } as const)[title];
}
export function isFullAccess(title: WorkspaceTitle) {
  return title === "arbiter" || title === "chief_steward" || title === "astral_modulator";
}
export function technicalRoleFor(title: Exclude<WorkspaceTitle, "arbiter">): WorkspaceActor["technicalRole"] {
  return title === "chief_steward" || title === "astral_modulator" ? "hall_of_fame_admin" : title === "bloom_bearer" ? "organizer" : "referee";
}
export async function authorizeWorkspace(request: Request): Promise<WorkspaceActor> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new HttpError(401, "Black Shores access token required.");
  const supplied = match[1];
  const owner = process.env.MODERATOR_TOKEN;
  if (owner && owner.length >= 32 && equalSecret(supplied, owner)) {
    return { id: "owner", title: "arbiter", label: "Arbiter", technicalRole: "owner" };
  }
  const db = database();
  await migrateOnce(db);
  const found = await db.execute({
    sql: "SELECT id,label,role,title,revoked_at FROM hof_staff WHERE token_hash=?",
    args: [digest(supplied).toString("hex")],
  });
  const row = found.rows[0];
  const titles: WorkspaceTitle[] = ["chief_steward", "astral_modulator", "bloom_bearer", "consultant"];
  const title = String(row?.title || "") as WorkspaceTitle;
  if (!row || row.revoked_at || !titles.includes(title)) throw new HttpError(401, "Black Shores access token is invalid or revoked.");
  return { id: String(row.id), title, label: String(row.label), technicalRole: String(row.role) as WorkspaceActor["technicalRole"] };
}
