"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// three.js has no SSR — split it into its own chunk, loaded only in browser.
const OrbeCanvas = dynamic(() => import("@/components/OrbeCanvas"), {
  ssr: false,
});

export default function Home() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      if (reduce) return;
      gsap.from(".orbe-fade", {
        y: 24,
        opacity: 0,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.15,
      });
    },
    { scope: container }
  );

  return (
    <div
      ref={container}
      className="flex min-h-dvh flex-col bg-white text-black antialiased"
    >
      <main className="grid flex-1 place-items-center px-6">
        <div className="orbe-fade w-[min(400px,85vw)]">
          <OrbeCanvas />
        </div>
      </main>

      <footer className="px-6 pb-[8vh]">
        <p className="orbe-fade mx-auto max-w-5xl text-center font-mono text-[15px] leading-[1.4] uppercase">
          Orbe Labs is an independent design and development studio for ideas
          with somewhere to go. We give them shape, character, and a life
          beyond the screen. Our new home is taking shape. We&rsquo;ll be here
          soon.
        </p>
      </footer>
    </div>
  );
}
