import { database } from "@/lib/server/database";
import { authorize, failure, json, privateHeaders } from "@/lib/server/http";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^(?:[a-f0-9-]{36}-[1-5]-(?:portrait|sonata)|[a-f0-9-]{36}-weapon)$/.test(id)) return json({ error: "Not found." }, 404);
    const isWeapon = id.endsWith("-weapon");
    const result = await database().execute({
      sql: isWeapon
        ? "SELECT a.png,s.status FROM submission_profile_assets a JOIN submissions s ON s.id=a.submission_id WHERE a.id=?"
        : "SELECT a.png,s.status FROM assets a JOIN submissions s ON s.id=a.submission_id WHERE a.id=?",
      args: [id],
    });
    const row = result.rows[0];
    if (!row) return json({ error: "Not found." }, 404);
    if (row.status !== "approved") authorize(request);
    const headers = row.status === "approved"
      ? {
          ...privateHeaders,
          // Keep browser revalidation while explicitly caching only on Vercel's
          // edge. This avoids exposing stale Echo images in local browser caches.
          "Cache-Control": "public, max-age=0, must-revalidate",
          "Vercel-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        }
      : privateHeaders;
    return new Response(row.png as ArrayBuffer, { headers: { ...headers, "Content-Type": "image/png", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return failure(error); }
}
