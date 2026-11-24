"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { LogoMark } from "../ui/brand";

const chip = "bg-lk-bg/80 px-2.5 py-1.5 font-plex text-[11px] font-semibold tracking-[1.5px] text-lk-fg uppercase sm:text-[12.5px]";

/**
 * The landing page's 16:9 player: a poster with a lime play button, which swaps to the video (with sound and
 * controls) on click. Without a `src` there is nothing to play yet, so the poster stands alone and the button is
 * disabled. The box keeps its aspect ratio either way, so nothing shifts.
 */
export function VideoPlayer({ src, poster, duration, title }: { src?: string; poster: string; duration?: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black shadow-[5px_5px_0_var(--color-lk-lime)] outline outline-1 -outline-offset-1 outline-lk-gray sm:shadow-[8px_8px_0_var(--color-lk-lime)]">
      {src && playing ? (
        <video src={src} poster={poster} controls autoPlay playsInline aria-label={title} className="absolute inset-0 size-full bg-black object-contain" />
      ) : (
        <>
          <Image src={poster} alt="" fill sizes="(min-width: 1088px) 960px, 100vw" className="object-cover object-[77%_center] opacity-60" />
          <span aria-hidden className="absolute top-3 left-3 flex items-center gap-[5px] sm:top-[22px] sm:left-6">
            <LogoMark size={24} />
            <span className="font-pixel text-[10px] tracking-[1px] text-lk-fg sm:text-[14px]">MEERKO</span>
          </span>
          {src && duration && (
            <span className="absolute top-3 right-3 bg-lk-lime px-1.5 py-[3px] font-plex text-[9px] font-semibold tracking-[0.8px] text-lk-bg sm:top-[22px] sm:right-6 sm:text-[11px]">
              {duration}
            </span>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <button
              type="button"
              disabled={!src}
              aria-label={src ? `Play video: ${title}` : "Video coming soon"}
              onClick={() => setPlaying(true)}
              className="grid size-16 place-items-center bg-lk-lime text-lk-bg shadow-[5px_5px_0_#000] transition enabled:hover:translate-x-px enabled:hover:translate-y-px enabled:hover:shadow-[4px_4px_0_#000] disabled:cursor-default sm:size-[92px]"
            >
              <Play aria-hidden className="size-7 sm:size-10" strokeWidth={2} />
            </button>
            <span className={`${chip} hidden sm:inline`}>{src ? "Play · sound on" : "Video coming soon"}</span>
          </div>
        </>
      )}
    </div>
  );
}
