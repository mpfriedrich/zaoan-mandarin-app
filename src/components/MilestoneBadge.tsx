"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect } from "react";
import { db, getMeta, setMeta } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { computeMilestones, type Milestone, type MilestoneIcon } from "@/lib/milestones";
import { CardsIcon, ChatFilledIcon, FlameIcon, MicIcon, PinFilledIcon, ToneContour } from "./Icons";

const COLORS: Record<MilestoneIcon, string> = {
  tone: "var(--orange)",
  pin: "var(--green)",
  flame: "var(--orange)",
  cards: "var(--blue)",
  mic: "var(--red)",
  chat: "var(--indigo)",
};

/** Rundes Symbol eines Meilensteins – farbig, sobald er erreicht ist. */
export function MilestoneBadge({ milestone, size = 44 }: { milestone: Milestone; size?: number }) {
  const icon = Math.round(size * 0.45);
  const style = { color: milestone.reached ? "#FFF" : "var(--label3)" };
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: milestone.reached ? COLORS[milestone.icon] : "var(--fill)",
      }}
    >
      {milestone.icon === "tone" && <ToneContour tone={3} size={icon} style={style} />}
      {milestone.icon === "pin" && <PinFilledIcon size={icon} style={style} />}
      {milestone.icon === "flame" && <FlameIcon size={icon} style={style} />}
      {milestone.icon === "cards" && <CardsIcon size={icon} style={style} />}
      {milestone.icon === "mic" && <MicIcon size={icon} style={style} />}
      {milestone.icon === "chat" && <ChatFilledIcon size={icon} style={style} />}
    </span>
  );
}

/** Hinweis auf „Heute“, wenn seit dem letzten Besuch ein Meilenstein neu erreicht wurde. */
export function MilestoneBanner() {
  const t = useT();
  const data = useLiveQuery(async () => {
    const [days, lessons, reviewCount, scores, roleplays, seen] = await Promise.all([
      db.days.toArray(),
      db.lessons.toArray(),
      db.reviews.count(),
      db.scores.toArray(),
      db.roleplays.toArray(),
      getMeta<string[] | null>("milestonesSeen", null),
    ]);
    return { milestones: computeMilestones({ days, lessons, reviewCount, scores, roleplays }), seen };
  }, []);

  // Beim ersten Mal (neues Gerät, nach dem Update) alles Erreichte still als gesehen merken.
  useEffect(() => {
    if (data && data.seen === null) void setMeta("milestonesSeen", data.milestones.filter((m) => m.reached).map((m) => m.id));
  }, [data]);

  if (!data?.seen) return null;
  const fresh = data.milestones.filter((m) => m.reached && !data.seen!.includes(m.id));
  if (fresh.length === 0) return null;
  const milestone = fresh[0];

  return (
    <section className="card" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <MilestoneBadge milestone={milestone} size={48} />
      <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="eyebrow">{t("Neuer Meilenstein", "New milestone")}</span>
        <span className="headline">{t(...milestone.title)}</span>
        <span className="sub muted">{t(...milestone.detail)}</span>
        <Link href="/fortschritt" className="sub" style={{ color: "var(--blue)" }}>
          {t("Alle Meilensteine", "All milestones")}
        </Link>
      </div>
      <button
        className="btn btn-tinted"
        style={{ width: "auto", padding: "0 14px", minHeight: 36 }}
        onClick={() => void setMeta("milestonesSeen", [...data.seen!, ...fresh.map((m) => m.id)])}
      >
        {t("Super!", "Nice!")}
      </button>
    </section>
  );
}
