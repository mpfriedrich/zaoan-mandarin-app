import Anthropic from "@anthropic-ai/sdk";
import { roleplaysById } from "@/lib/content";
import { ROLEPLAY_MODELS, type ChatTurn, type RoleplayModel } from "@/lib/roleplay-types";
import { currentUser } from "@/lib/server/auth";
import { countUsage } from "@/lib/server/database";
import { generateTurn, RoleplayError } from "@/lib/server/roleplay";

export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.ROLEPLAY_DAILY_LIMIT ?? 30);
/** Demo: günstigeres Modell und ein gemeinsames Tageslimit für alle Demo-Nutzer. */
const DEMO_DAILY_LIMIT = Number(process.env.DEMO_ROLEPLAY_DAILY_LIMIT ?? 20);
const DEMO_MODEL: RoleplayModel = "claude-sonnet-5";

function validTurns(turns: unknown): turns is ChatTurn[] {
  if (!Array.isArray(turns) || turns.length > 80) return false;
  return turns.every(
    (t) =>
      (t?.role === "user" && typeof t.text === "string" && t.text.length <= 500) ||
      (t?.role === "assistant" && typeof t.data === "object" && t.data !== null),
  );
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { roleplayId?: string; turns?: unknown; model?: string; language?: string } | null;
  const entry = body?.roleplayId ? roleplaysById.get(body.roleplayId) : undefined;
  if (!entry || !validTurns(body?.turns)) return Response.json({ error: "invalid" }, { status: 400 });
  const turns = body.turns;
  if (turns.length > 0 && turns[turns.length - 1].role !== "user") {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const model: RoleplayModel =
    user === "demo"
      ? DEMO_MODEL
      : ROLEPLAY_MODELS.includes(body.model as RoleplayModel)
        ? (body.model as RoleplayModel)
        : "claude-opus-5";
  const limit = user === "demo" ? DEMO_DAILY_LIMIT : DAILY_LIMIT;

  try {
    if ((await countUsage(user)) > limit) {
      return Response.json({ error: "limit", limit }, { status: 429 });
    }
  } catch (error) {
    console.error("[rollenspiel] Tageslimit konnte nicht geprüft werden", error);
  }

  try {
    const language = body.language === "en" ? "en" : "de";
    const data = await generateTurn({ scenario: entry.scenario, roleplay: entry.roleplay, turns, model, language });
    return Response.json({ data });
  } catch (error) {
    if (error instanceof RoleplayError) {
      return Response.json({ error: error.code, message: error.message }, { status: 502 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[rollenspiel] API-Key ungültig");
      return Response.json({ error: "config" }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return Response.json({ error: "busy" }, { status: 503 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[rollenspiel] API-Fehler", error.status, error.message);
      return Response.json({ error: "api", message: error.message }, { status: 502 });
    }
    console.error("[rollenspiel] Unerwarteter Fehler", error);
    return Response.json({ error: "unknown" }, { status: 500 });
  }
}
