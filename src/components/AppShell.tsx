"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { onLocalChange } from "@/lib/db";
import { useMeta } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { scheduleSync, syncNow } from "@/lib/sync";
import { CalendarIcon, CardsIcon, ChartIcon, ChatIcon, PinIcon } from "./Icons";

const FULLSCREEN = ["/login", "/lernen", "/wiederholen", "/rollenspiel/", "/toene", "/hoeren", "/sprechen", "/schreiben", "/schilder", "/woerter", "/wortschatz/lernen", "/einstellungen"];

const TABS = [
  { href: "/", label: "Heute", labelEn: "Today", Icon: CalendarIcon },
  { href: "/szenarien", label: "Szenarien", labelEn: "Scenarios", Icon: PinIcon },
  { href: "/rollenspiel", label: "Rollenspiel", labelEn: "Role-play", Icon: ChatIcon },
  { href: "/wortschatz", label: "Wortschatz", labelEn: "Vocabulary", Icon: CardsIcon },
  { href: "/fortschritt", label: "Fortschritt", labelEn: "Progress", Icon: ChartIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const loggedIn = useMeta<boolean>("loggedIn", false);
  const english = t("de", "en");

  useEffect(() => {
    document.documentElement.lang = english;
  }, [english]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (loggedIn === false && pathname !== "/login") router.replace("/login");
  }, [loggedIn, pathname, router]);

  useEffect(() => {
    if (!loggedIn) return;
    const run = () => void syncNow();
    run();
    const offChange = onLocalChange(() => scheduleSync());
    const onVisible = () => document.visibilityState === "visible" && run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offChange();
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loggedIn]);

  if (loggedIn === undefined) return null;
  if (!loggedIn && pathname !== "/login") return null;

  const showTabs = loggedIn && !FULLSCREEN.some((prefix) => pathname.startsWith(prefix));
  return (
    <>
      {children}
      {showTabs && (
        <nav className="tabbar">
          <div className="tabbar-inner">
            {TABS.map(({ href, label, labelEn, Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={active ? "tab active" : "tab"}>
                  <Icon />
                  <span>{t(label, labelEn)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
