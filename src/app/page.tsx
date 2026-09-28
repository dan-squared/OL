import Image from "next/image";
import CursorTrail from "@/components/CursorTrail";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-black antialiased">
      <CursorTrail />
      <main className="grid flex-1 place-items-center px-6 py-10">
        <div data-cursor-off className="grid place-items-center p-8">
          <Image
          src="/orbe-mark.png"
          alt="Orbe Labs"
          width={300}
          height={300}
          priority
          sizes="(max-width: 640px) 60vw, 300px"
          className="orbe-enter h-auto w-[min(300px,60vw)]"
          />
        </div>
      </main>

      <footer className="px-6 pb-[max(2rem,8vh)]">
        <p
          className="orbe-enter mx-auto max-w-5xl text-center font-mono uppercase"
          style={{ animationDelay: "150ms" }}
        >
          Orbe Labs is an independent design and development studio for ideas
          with somewhere to go. We give them shape, character, and a life
          beyond the screen. Our new home is taking shape. We&rsquo;ll be here
          soon.
        </p>
      </footer>
    </div>
  );
}
