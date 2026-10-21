import { currentUser } from "@/lib/server/auth";
import { getDb, reminderStatus } from "@/lib/server/database";
import { reminderMessage } from "@/lib/server/push";

/** Text für die Benachrichtigung – der Service Worker fragt ihn ab, sobald ein Push ankommt. */
export async function GET() {
  const fallback = { title: "早安", body: "Zeit für ein paar Minuten Mandarin.", url: "/" };
  try {
    const user = await currentUser();
    const db = user === "owner" ? await getDb() : null;
    if (!db) return Response.json(fallback);
    const status = await reminderStatus(db, "owner");
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    return Response.json(reminderMessage(status, hour >= 17 ? "evening" : "noon"));
  } catch (error) {
    console.error("[push] Nachricht konnte nicht erstellt werden", error);
    return Response.json(fallback);
  }
}
