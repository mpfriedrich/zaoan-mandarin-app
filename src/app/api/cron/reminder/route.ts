import { timingSafeEqual } from "node:crypto";
import { getDb, reminderStatus } from "@/lib/server/database";
import { notifyUser, type ReminderSlot } from "@/lib/server/push";

// Von Vercel Cron aufgerufen (siehe vercel.json): 04:00 UTC = 12:00 Taiwan, 12:00 UTC = 20:00 Taiwan.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const slot: ReminderSlot = new URL(request.url).searchParams.get("slot") === "evening" ? "evening" : "noon";
  const db = await getDb();
  if (!db) return Response.json({ error: "no-db" }, { status: 503 });

  const status = await reminderStatus(db, "owner");
  if (status.studiedToday) return Response.json({ slot, skipped: "studied-today" });
  // Abends nur, wenn eine Serie auf dem Spiel steht.
  if (slot === "evening" && status.streak === 0) return Response.json({ slot, skipped: "no-streak" });

  const result = await notifyUser(db, "owner");
  console.log("[erinnerung]", slot, JSON.stringify(result));
  return Response.json({ slot, ...result });
}
