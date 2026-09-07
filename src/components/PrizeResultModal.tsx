"use client";

import { Lottie } from "lottie-react";
import { PrizeBadge } from "@/components/game-icons";
import type { WheelPrize } from "@/lib/wheel";
import confettiAnimation from "../../public/lottie-animation/coffeti.json";

// Pick-a-box, the slot machine, Plinko and Memory Match each carried their
// own byte-identical copy of this modal (plus its confetti overlay), all
// headed by a 🎉 emoji and none of them showing the prize icon the admin
// uploaded. One component now serves all four.
export default function PrizeResultModal({
  open,
  prize,
  alreadyPlayed = false,
  thanksNote,
  onClose,
}: {
  open: boolean;
  prize: WheelPrize;
  alreadyPlayed?: boolean;
  // What to say when the prize isn't a win, e.g. "Thank you for playing
  // Plinko!" — the one line that differed between the four copies.
  thanksNote: string;
  onClose: () => void;
}) {
  if (!open) return null;
  const won = prize.isWin;

  return (
    <>
      {won && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <Lottie
            src={confettiAnimation}
            loop={false}
            autoplay
            className="h-full w-full"
            rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
          />
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm animate-[modal-pop_0.35s_ease-out] rounded-3xl border border-neutral-800 bg-neutral-900 p-6 text-center shadow-2xl">
          <PrizeBadge won={won} iconUrl={prize.iconUrl} label={prize.label} />
          <h3 className={`mt-4 text-2xl font-black ${won ? "text-amber-400" : "text-neutral-200"}`}>
            {won ? "Congratulations!" : "Better luck next time!"}
          </h3>
          <p className="mt-2 text-sm text-neutral-400">
            {won ? `You won: ${prize.label}` : thanksNote}
          </p>
          {alreadyPlayed && (
            <p className="mt-1 text-xs text-neutral-500">You have already used this link.</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl border border-neutral-700 bg-neutral-800 py-3 text-sm font-bold text-white transition-colors hover:bg-neutral-700 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
