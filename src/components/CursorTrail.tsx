"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Pill = { text: string; bg: string; fg: string };

/* Palette extracted from your snippet — positions/sizes dropped, colors kept. */
const P = {
  orange: "#FFA25E",
  lime: "#CDF138",
  lavender: "#DCCBFF",
  sky: "#A9D6FB",
  paleCyan: "#CDEFF3",
  purple: "#8B5CF6",
  tan: "#D9C19E",
  gold: "#F7C948",
  lightGreen: "#B9F5B9",
  peach: "#FFB59D",
  pink: "#F471B5",
  mustard: "#E8B90B",
  paleYellow: "#FFF3A3",
  green: "#9FF0C4",
  terracotta: "#E2603C",
} as const;

const INK = "#1a1a1a";
const PAPER = "#ffffff";

/* Words + colors from your list — order kept, no positions. */
const PILLS: Pill[] = [
  { text: "CLARITY", bg: P.orange, fg: INK },
  { text: "USER-FRIENDLY", bg: P.lime, fg: INK },
  { text: "PRECISION", bg: P.lavender, fg: INK },
  { text: "CLEAR PATH", bg: P.sky, fg: INK },
  { text: "FLOW", bg: P.paleCyan, fg: INK },
  { text: "CLEAR PATH", bg: P.purple, fg: PAPER },
  { text: "FUNCTION-FIRST", bg: P.tan, fg: INK },
  { text: "FRICTIONLESS", bg: P.paleCyan, fg: INK },
  { text: "INTUITION", bg: "#F6F3E7", fg: INK },
  { text: "FOCUS", bg: P.gold, fg: INK },
  { text: "SMART LAYOUT", bg: P.lightGreen, fg: INK },
  { text: "PURPOSEFUL", bg: P.peach, fg: INK },
  { text: "FLOW", bg: P.paleCyan, fg: INK },
  { text: "UI DESIGN", bg: P.sky, fg: INK },
  { text: "SEAMLESS UX", bg: P.pink, fg: PAPER },
  { text: "EFFICIENCY", bg: P.lavender, fg: INK },
  { text: "FOCUS", bg: P.mustard, fg: INK },
  { text: "WHAT MATTERS", bg: P.paleYellow, fg: INK },
  { text: "EFFORTLESS", bg: P.lavender, fg: INK },
  { text: "HARMONY", bg: P.green, fg: INK },
  { text: "CLEAN UI", bg: P.paleCyan, fg: INK },
  { text: "MINIMALISM", bg: P.terracotta, fg: PAPER },
  { text: "SEAMLESS UX", bg: P.pink, fg: PAPER },
  { text: "STREAMLINED", bg: P.peach, fg: INK },
  { text: "PRECISION", bg: P.lavender, fg: INK },
];

export default function CursorTrail() {
  const pillRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    // Desktop-only flourish: no touch, no reduced-motion.
    if (
      typeof window === "undefined" ||
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const pills = pillRefs.current.filter(
      (el): el is HTMLSpanElement => el !== null,
    );
    if (pills.length === 0) return;

    // Park every pill offscreen, centered on its own coordinates, hidden.
    gsap.set(pills, {
      xPercent: -50,
      yPercent: -50,
      x: -200,
      y: -200,
      scale: 0,
      opacity: 0,
    });

    // Emitter state: each tag pops out once near the cursor, holds, fades.
    // Nothing follows the cursor — so tags never bunch into a stacked tail.
    // Gap exceeds typical tag width (~100px) so neighbours can't overlap.
    const MIN_DIST = 80; // px of travel before the next tag drops
    const HOLD = 0.6; // s a tag stays readable before fading
    let next = 0;
    let lastEmitX: number | null = null;
    let lastEmitY: number | null = null;

    const emit = (x: number, y: number) => {
      const slot = next;
      const el = pills[slot];
      next = (next + 1) % pills.length;

      // Small 3-lane fan (±14px) for an organic feel — horizontal travel gap
      // does the real separation work, so lanes stay well clear of each other.
      const lane = ((slot % 3) - 1) * 14;
      const jx = (Math.random() - 0.5) * 8;
      const jy = (Math.random() - 0.5) * 6;
      const px = x + 18 + jx;
      const py = y - 26 + lane + jy;

      gsap.killTweensOf(el);
      gsap.set(el, { x: px, y: py, rotation: 0, scale: 0.7, opacity: 0 });
      gsap
        .timeline({ defaults: { overwrite: "auto" } })
        // Soft fluid entrance — slow expo ease, no bounce pop.
        .to(el, {
          scale: 1,
          opacity: 1,
          duration: 0.55,
          ease: "expo.out",
        })
        // Gentle upward drift while readable.
        .to(
          el,
          { y: py - 10, duration: HOLD + 0.8, ease: "sine.out" },
          0.05,
        )
        // Slow smooth dissolve out.
        .to(
          el,
          {
            scale: 0.95,
            opacity: 0,
            duration: 0.6,
            ease: "sine.inOut",
          },
          `+=${HOLD}`,
        );
    };

    const hideAll = () => {
      // Kill per-tag timelines first so nothing lingers on its hold/fade,
      // then dissolve smoothly with the same sine ease as the trail itself.
      gsap.killTweensOf(pills);
      gsap.to(pills, {
        scale: 0.9,
        opacity: 0,
        duration: 0.4,
        ease: "sine.inOut",
        overwrite: "auto",
      });
      lastEmitX = null;
      lastEmitY = null;
    };

    // No tags over the logo — a dedicated zone flag beats mousemove-target
    // sniffing, which can miss fast entries and leave tags lingering.
    let overLogo = false;
    const zones = Array.from(
      document.querySelectorAll("[data-cursor-off]"),
    );
    const onZoneEnter = () => {
      overLogo = true;
      hideAll();
    };
    const onZoneLeave = () => {
      overLogo = false;
      lastEmitX = null;
      lastEmitY = null;
    };
    zones.forEach((z) => {
      z.addEventListener("mouseenter", onZoneEnter);
      z.addEventListener("mouseleave", onZoneLeave);
    });

    const onMove = (e: MouseEvent) => {
      if (overLogo) return;

      const { clientX: x, clientY: y } = e;

      if (lastEmitX === null || lastEmitY === null) {
        // First move: instant feedback, one tag pops right at the cursor.
        lastEmitX = x;
        lastEmitY = y;
        emit(x, y);
        return;
      }

      const dx = x - lastEmitX;
      const dy = y - lastEmitY;
      if (Math.hypot(dx, dy) >= MIN_DIST) {
        lastEmitX = x;
        lastEmitY = y;
        emit(x, y);
      }
    };

    const onLeave = () => {
      hideAll();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      zones.forEach((z) => {
        z.removeEventListener("mouseenter", onZoneEnter);
        z.removeEventListener("mouseleave", onZoneLeave);
      });
      gsap.killTweensOf(pills);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 hidden [@media(pointer:fine)]:block"
    >
      {PILLS.map((pill, i) => (
        <span
          key={`${pill.text}-${i}`}
          ref={(el) => {
            pillRefs.current[i] = el;
          }}
          className="absolute top-0 left-0 font-mono text-[10px] leading-[1.3] font-medium tracking-[0.04em] whitespace-nowrap uppercase rounded-[2px] px-[7px] py-[4px] opacity-0 will-change-transform"
          style={{ backgroundColor: pill.bg, color: pill.fg }}
        >
          {pill.text}
        </span>
      ))}
    </div>
  );
}
