"use client";

import { Bot, Inbox, PanelsTopLeft, Pause, Play, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// The hero's "Meerko OS" window as a short looping demo of the four main use cases. It plays like a video
// (play/pause, clickable chapters), but it's drawn in code, so it stays sharp and weighs nothing.
// The tool names are the real MCP tools; the people and companies are made up.

const CHAPTERS = [
  { id: "find", label: "Find leads", start: 0, end: 8 },
  { id: "send", label: "Send", start: 8, end: 15 },
  { id: "catch", label: "Catch replies", start: 15, end: 21 },
  { id: "approve", label: "Approve", start: 21, end: 28 },
] as const;
type ChapterId = (typeof CHAPTERS)[number]["id"];
const DURATION = CHAPTERS[CHAPTERS.length - 1].end;
// The script above is timed for reading at 1x; it plays faster so the loop doesn't drag.
const SPEED = 2.6;

const apps = [
  { name: "Leads", icon: PanelsTopLeft, chapter: "find" },
  { name: "Sequences", icon: Send, chapter: "send" },
  { name: "Inbox", icon: Inbox, chapter: "catch" },
  { name: "Agent", icon: Bot, chapter: "approve" },
] as const;

type Line = { at: number; text: string; kind: "you" | "tool" | "reply" | "note"; type?: number };
const terminal: Record<ChapterId, Line[]> = {
  find: [
    { at: 0.3, text: "> Find 50 Series A fintech CTOs in Spain, enrich + verify them.", kind: "you", type: 2.2 },
    { at: 2.9, text: "● meerko.find_people      → 50 leads", kind: "tool" },
    { at: 3.8, text: "● meerko.enrich_rows      → 47/50 emails", kind: "tool" },
    { at: 5.6, text: "  3 misses, 0 credits charged for them", kind: "note" },
  ],
  send: [
    { at: 0.3, text: "> Write a 3-step sequence and send it from my Outlook.", kind: "you", type: 2.0 },
    { at: 2.6, text: "● meerko.create_sequence  → 3 steps, Outlook", kind: "tool" },
    { at: 3.4, text: "● meerko.start_sequence   → sending", kind: "tool" },
    { at: 4.2, text: "  within each mailbox's daily limit", kind: "note" },
  ],
  catch: [
    { at: 0.3, text: "● meerko.list_replies     → 4 new", kind: "tool" },
    { at: 1.2, text: "◆ Lucía M. · CTO @ Ledgr  interested", kind: "reply" },
    { at: 2.0, text: "◆ Pau R. · Tallyo         not now", kind: "reply" },
    { at: 2.8, text: "◆ Marta G. · Monea        question", kind: "reply" },
    { at: 3.6, text: "◆ Ana L. · Fondo          interested", kind: "reply" },
  ],
  approve: [
    { at: 0.3, text: "◆ Lucía M. replied: “Good timing — can we talk Thursday?”", kind: "reply" },
    { at: 1.3, text: "● meerko.draft_reply      → draft ready", kind: "tool" },
    { at: 1.8, text: "  waiting for your approval", kind: "note" },
    { at: 5.2, text: "● sent from your Outlook  ✓", kind: "tool" },
  ],
};
const lineColor = { you: "text-lk-fg", tool: "text-lk-muted", reply: "text-lk-lime", note: "text-lk-dim" };

const typed = (text: string, u: number, at: number, dur?: number) =>
  !dur ? text : text.slice(0, Math.max(0, Math.min(text.length, Math.round(((u - at) / dur) * text.length))));
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

// ------------------------------------------------------------------ the app windows, one per chapter

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-lk-paper-hi shadow-[5px_5px_0_var(--color-lk-ink)] outline-[1.5px] -outline-offset-[0.75px] outline-lk-ink outline">
      <div className="flex justify-between border-b-[1.5px] border-lk-ink px-3 py-[7px] text-[10px] text-lk-ink">
        <span className="font-pixel">{title}</span>
        <span className="font-plex">[x]</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const leads = [
  ["Lucía M.", "Ledgr", true],
  ["Pau R.", "Tallyo", true],
  ["Marta G.", "Monea", true],
  ["Jordi S.", "Clearbook", false],
  ["Ana L.", "Fondo", true],
] as const;

function LeadsPanel({ u }: { u: number }) {
  return (
    <Panel title="LEADS — fintech-ctos-es">
      <div className="flex flex-col font-plex text-[12.5px] text-lk-ink">
        {leads.map(([name, company, found], i) => {
          const shown = u > 3.0 + i * 0.25;
          const enriched = u > 4.0 + i * 0.35;
          return (
            <div key={name} className={`flex gap-2 border-t border-lk-ink/20 py-[7px] transition-opacity duration-300 first:border-0 ${shown ? "opacity-100" : "opacity-0"}`}>
              <span className="w-[72px] shrink-0">{name}</span>
              <span className="flex-1 truncate">{company}</span>
              <span className={!enriched ? "text-lk-dim" : found ? "" : "text-lk-dim"}>{!enriched ? "…" : found ? "verified" : "no email"}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const steps = [
  ["DAY 0", "Intro: ledger reconciliation", 47],
  ["DAY 3", "Follow-up: a 2-minute teardown", 0],
  ["DAY 7", "Last note: worth a call?", 0],
] as const;

function SequencePanel({ u }: { u: number }) {
  const sent = Math.round(clamp01((u - 3.6) / 3) * 47);
  return (
    <Panel title="SEQUENCE — 3 steps">
      <div className="flex flex-col">
        {steps.map(([day, subject], i) => (
          <div key={day} className={`flex items-center gap-2.5 border-t border-lk-ink/20 py-2.5 transition-opacity duration-300 first:border-0 ${u > 2.7 + i * 0.3 ? "opacity-100" : "opacity-0"}`}>
            <span className="shrink-0 bg-lk-ink px-1.5 py-0.5 font-plex text-[12px] text-lk-lime">{day}</span>
            <span className="flex-1 truncate text-[15px] text-lk-ink">{subject}</span>
            <span className="shrink-0 font-plex text-[12px] text-lk-gray">{i === 0 ? `sent ${sent}` : "queued"}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const replies = [
  ["Lucía M.", "Good timing — can we talk Thursday?", "interested"],
  ["Pau R.", "Not this quarter, try me in Jan.", "not now"],
  ["Marta G.", "Does it work with NetSuite?", "question"],
  ["Ana L.", "Send me the teardown.", "interested"],
] as const;

function InboxPanel({ u }: { u: number }) {
  return (
    <Panel title="INBOX — replies">
      <div className="flex flex-col">
        {replies.map(([who, text, intent], i) => (
          <div key={who} className={`flex flex-col gap-1 border-t border-lk-ink/20 py-2 transition-all duration-300 first:border-0 ${u > 1.2 + i * 0.8 ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-lk-ink">{who}</span>
              <span className={`px-1.5 py-0.5 font-plex text-[9.5px] ${intent === "interested" ? "bg-lk-ink text-lk-lime" : "text-lk-gray outline outline-1 -outline-offset-1 outline-lk-gray/50"}`}>{intent}</span>
            </div>
            <span className="truncate text-[11.5px] text-lk-gray">“{text}”</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const DRAFT = "Thursday works. 10:00 or 15:00 your time? I’ll send an invite.";

function DraftPanel({ u }: { u: number }) {
  const pressed = u > 4.6;
  const sent = u > 5.0;
  return (
    <Panel title={sent ? "DRAFT · SENT" : "DRAFT · NEEDS YOU"}>
      <div className="flex flex-col gap-3">
        <p className="min-h-[60px] text-[15px] leading-5 text-lk-ink">
          {typed(DRAFT, u, 1.6, 1.8)}
          {u > 1.6 && u < 3.4 && <span className="ml-px inline-block h-[13px] w-[6px] translate-y-[2px] animate-pulse bg-lk-ink" />}
        </p>
        <div className={`flex gap-2 transition-opacity duration-300 ${u > 3.5 ? "opacity-100" : "opacity-0"}`}>
          <span
            className={`flex-1 px-2.5 py-2 text-center font-plex text-[11px] font-semibold transition-colors ${pressed ? "bg-lk-lime text-lk-ink" : "bg-lk-ink text-lk-lime"}`}
          >
            {sent ? "SENT ✓" : "APPROVE"}
          </span>
          <span className="flex-1 px-2.5 py-2 text-center font-plex text-[12.5px] text-lk-ink outline-[1.5px] -outline-offset-[0.75px] outline-lk-ink outline">
            DISCARD
          </span>
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ the player

export function DemoPlayer() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  // Visitors who ask for less motion get a still frame they can step through.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      setT(CHAPTERS[0].end - 0.01);
    }
  }, []);

  // Don't burn frames while the hero is scrolled away.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      setT((x) => (x + ((now - last) / 1000) * SPEED) % DURATION);
      last = now;
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, visible]);

  const chapter = CHAPTERS.find((c) => t >= c.start && t < c.end) ?? CHAPTERS[0];
  const u = t - chapter.start;
  const repliesIn = chapter.id === "catch" ? replies.filter((_, i) => u > 1.2 + i * 0.8).length : chapter.id === "approve" ? 4 : 0;
  const lines = terminal[chapter.id].filter((l) => u >= l.at);
  const time = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

  return (
    <div ref={root} className="mx-auto w-full max-w-[1140px] bg-lk-frame px-3 pt-3 shadow-[12px_12px_0_#000] sm:px-[22px] sm:pt-[22px]">
      <div className="flex flex-col bg-lk-paper lg:h-[540px]" aria-label={`Meerko demo: ${chapter.label}`} role="group">
        <div className="flex items-center gap-6 border-b border-lk-ink px-3.5 py-2 text-lk-ink">
          <span className="font-pixel text-[13.5px]">MEERKO OS</span>
          {["File", "Leads", "Sequences", "Agent"].map((m) => (
            <span key={m} className="hidden font-plex text-[13px] sm:inline">
              {m}
            </span>
          ))}
        </div>
        <div className="flex flex-1 items-start gap-6 p-4 sm:p-7">
          <div className="hidden w-24 shrink-0 flex-col items-center gap-[26px] md:flex">
            {apps.map(({ name, icon: Icon, chapter: c }) => {
              const active = c === chapter.id;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setT(CHAPTERS.find((x) => x.id === c)!.start)}
                  aria-label={`Jump to ${CHAPTERS.find((x) => x.id === c)!.label}`}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span
                    className={`grid size-11 place-items-center outline-[1.5px] -outline-offset-[0.75px] outline-lk-ink outline transition-colors duration-300 ${active ? "bg-lk-ink text-lk-lime" : "text-lk-ink group-hover:bg-lk-ink/10"}`}
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="font-pixel text-[13px] text-lk-ink">{name === "Inbox" && repliesIn ? `Inbox (${repliesIn})` : name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex min-h-[300px] min-w-0 flex-1 flex-col self-stretch bg-lk-ink outline-[1.5px] -outline-offset-[0.75px] outline-lk-ink outline">
            <div className="flex justify-between border-b-[1.5px] border-lk-ink bg-lk-paper px-3 py-[7px] font-plex text-[12.5px] text-lk-ink">
              <span>claude — ~/outbound</span>
              <span>[x]</span>
            </div>
            <div className="flex flex-col gap-[11px] overflow-hidden p-4 font-plex text-[13px] sm:p-[22px] sm:text-[14px]">
              {lines.map((l) => (
                <div key={l.text} className={`whitespace-pre-wrap ${lineColor[l.kind]}`}>
                  {typed(l.text, u, l.at, l.type)}
                </div>
              ))}
              <span className="inline-block h-[15px] w-[8px] animate-pulse bg-lk-lime" />
            </div>
          </div>
          <div className="hidden w-[300px] shrink-0 lg:block">
            {chapter.id === "find" && <LeadsPanel u={u} />}
            {chapter.id === "send" && <SequencePanel u={u} />}
            {chapter.id === "catch" && <InboxPanel u={u} />}
            {chapter.id === "approve" && <DraftPanel u={u} />}
          </div>
        </div>
      </div>
      <div className="flex h-[52px] items-center gap-3 px-1.5 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause demo" : "Play demo"}
          className="grid size-7 shrink-0 place-items-center text-lk-fg transition hover:text-lk-lime"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <div className="flex flex-1 gap-1.5">
          {CHAPTERS.map((c) => {
            const fill = clamp01((t - c.start) / (c.end - c.start));
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setT(c.start)}
                className="group flex flex-1 flex-col gap-1.5 text-left"
                style={{ flexGrow: c.end - c.start }}
              >
                <span className="h-[3px] w-full bg-lk-line">
                  <span className="block h-full bg-lk-lime" style={{ width: `${fill * 100}%` }} />
                </span>
                <span className={`hidden uppercase transition group-hover:text-lk-fg sm:block ${c.id === chapter.id ? "text-lk-fg" : ""}`}>{c.label}</span>
              </button>
            );
          })}
        </div>
        <span className="shrink-0 tabular-nums">
          {time(t / SPEED)} / {time(DURATION / SPEED)}
        </span>
      </div>
    </div>
  );
}
