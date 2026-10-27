import { database } from "@/lib/server/database";
import { authorize, failure, json, privateHeaders } from "@/lib/server/http";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[a-f0-9-]{36}-[1-5]-(portrait|sonata)$/.test(id)) return json({ error: "Not found." }, 404);
    const result = await database().execute({
      sql: "SELECT a.png,s.status FROM assets a JOIN submissions s ON s.id=a.submission_id WHERE a.id=?",
      args: [id],
    });
    const row = result.rows[0];
    if (!row) return json({ error: "Not found." }, 404);
    if (row.status !== "approved") authorize(request);
    return new Response(row.png as ArrayBuffer, { headers: { ...privateHeaders, "Content-Type": "image/png", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return failure(error); }
}
