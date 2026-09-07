"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type WheelFormField, type WheelPrize } from "@/lib/wheel";
import { firstAnswerProblem } from "@/lib/formFields";
import PlayerFormFields from "@/components/PlayerFormFields";
import PrizeResultModal from "@/components/PrizeResultModal";
import { SLOT_JACKPOT_ID, SLOT_SYMBOLS, slotSymbol } from "@/components/game-icons";
import {
  playNoWinSound,
  playReelStopSound,
  playSlotSpinSound,
  playWinSound,
  unlockAudio,
} from "@/lib/sound";
import { notifyEmbedRegistered } from "@/lib/embedBridge";
import { buildGameHref } from "@/lib/siteUrl";

type SpinResult = {
  prize: WheelPrize;
  alreadySpun: boolean;
};

type Phase = "loading" | "register" | "ready";

type PopupSettings = {
  askName: boolean;
  askPhone: boolean;
};

export interface SlotMachineProps {
  companySlug?: string;
  /** Which offer this page is showing. Without it the server falls
   *  back to the company's newest active offer, so a registration
   *  would bind to the wrong offer whenever ?o= names another. */
  offerId?: string;
  prizes: WheelPrize[];
  bgImageUrl?: string | null;
  initialSettings: PopupSettings;
  formFields: WheelFormField[];
}

// Reels hold symbol ids; the artwork lives in game-icons.tsx.
const SYMBOL_IDS = SLOT_SYMBOLS.map((symbol) => symbol.id);

function randomSymbolId(exclude?: string) {
  const pool = exclude ? SYMBOL_IDS.filter((id) => id !== exclude) : SYMBOL_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// How long the reels tumble before the first one stops, and how much
// longer each reel to its right keeps going.
const REEL_SPIN_MS = 1400;
const REEL_STOP_STAGGER_MS = 320;
const SPIN_TOTAL_MS = REEL_SPIN_MS + 2 * REEL_STOP_STAGGER_MS;

// One reel window. While the reel is turning the symbol blurs and slides;
// on landing it snaps still, which reads as the reel locking in.
function ReelWindow({ symbolId, spinning }: { symbolId: string; spinning: boolean }) {
  const { Icon, className } = slotSymbol(symbolId);
  return (
    <div className="flex h-20 w-16 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-200 shadow-inner">
      <Icon
        className={`size-9 ${className} ${
          spinning ? "animate-[reel-spin_0.18s_linear_infinite] blur-[1px]" : ""
        }`}
        aria-hidden="true"
      />
    </div>
  );
}

export default function SlotMachine({
  companySlug,
  offerId,
  prizes,
  bgImageUrl,
  initialSettings,
  formFields,
}: SlotMachineProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("t");

  function resolvePrize(prizeId: string, fallbackLabel?: string | null): WheelPrize {
    return (
      prizes.find((p) => p.id === prizeId) ?? {
        id: prizeId,
        label: fallbackLabel ?? "Prize",
        weight: 0,
        order: 0,
        isWin: false,
      }
    );
  }

  const registerUrl = companySlug ? `/api/w/${companySlug}/register` : "/api/register";
  const gameHref = (token: string) => buildGameHref(companySlug, offerId, token);

  const [phase, setPhase] = useState<Phase>(tokenParam ? "loading" : "register");
  const [token, setToken] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [popupSettings] = useState<PopupSettings>(initialSettings);

  const [spinning, setSpinning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Reels state
  const [reels, setReels] = useState<string[]>([SYMBOL_IDS[0], SYMBOL_IDS[1], SYMBOL_IDS[2]]);
  // Reels stop left to right, so each needs its own spinning flag.
  const [reelsSpinning, setReelsSpinning] = useState<boolean[]>([false, false, false]);

  // Hydrate session on load if magic code token exists
  useEffect(() => {
    if (!tokenParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/session?token=${encodeURIComponent(tokenParam)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          router.replace(buildGameHref(companySlug, offerId));
          setPhase("register");
          return;
        }
        setSessionName(data.name);
        setToken(tokenParam);
        if (data.hasSpun) {
          const priorPrize = resolvePrize(data.prizeId, data.prizeLabel);
          setResult({ prize: priorPrize, alreadySpun: true });
          // Show the reels as they would have landed: three of a kind only
          // if that earlier spin actually won something.
          const pairId = priorPrize.isWin ? SLOT_JACKPOT_ID : randomSymbolId();
          setReels([pairId, pairId, priorPrize.isWin ? pairId : randomSymbolId(pairId)]);
          setPhase("ready");
        } else {
          setName(data.name ?? "");
          setPhone(data.phone ?? "");
          setExtraFieldValues(data.extraFields ?? {});
          setPhase("register");
        }
      } catch {
        if (!cancelled) setPhase("register");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenParam, router]);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (registering) return;
    setRegisterError(null);

    if (popupSettings.askName && !name.trim()) {
      setRegisterError("Please enter your name.");
      return;
    }
    if (popupSettings.askPhone && !phone.trim()) {
      setRegisterError("Please enter your phone number.");
      return;
    }
    const answerProblem = firstAnswerProblem(formFields, extraFieldValues);
    if (answerProblem) {
      setRegisterError(answerProblem);
      return;
    }

    const isConfirmingExisting = Boolean(token);
    setRegistering(true);
    try {
      const res = await fetch(registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, token, offerId, extraFields: extraFieldValues }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegisterError(data.message ?? "Something went wrong. Please try again.");
        return;
      }
      setSessionName(name.trim());
      setToken(data.token);
      setPhase("ready");
      notifyEmbedRegistered();
      if (!isConfirmingExisting) router.replace(gameHref(data.token));
    } catch {
      setRegisterError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setRegistering(false);
    }
  }

  async function handlePullLever() {
    if (spinning || submitting || !token) return;
    setError(null);

    // Audio Unlock
    unlockAudio();
    setSpinning(true);
    setSubmitting(true);

    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        setError(data.message ?? "Failed to spin. Please try again.");
        setSpinning(false);
        return;
      }

      const activePrize = resolvePrize(data.prizeId);
      const won = activePrize.isWin;

      // Where the reels come to rest: three of a kind for a win, a near
      // miss (two matching, third different) otherwise.
      const pairId = won ? SLOT_JACKPOT_ID : randomSymbolId();
      const landing = [pairId, pairId, won ? pairId : randomSymbolId(pairId)];

      // Started here rather than at click time so the reel sound covers
      // exactly the window the reels are actually turning for.
      playSlotSpinSound(SPIN_TOTAL_MS);
      setReelsSpinning([true, true, true]);

      const stopped = [false, false, false];
      const tumble = setInterval(() => {
        setReels((prev) => prev.map((id, i) => (stopped[i] ? id : randomSymbolId())));
      }, 90);

      landing.forEach((id, i) => {
        setTimeout(() => {
          stopped[i] = true;
          setReels((prev) => prev.map((prevId, j) => (j === i ? id : prevId)));
          setReelsSpinning((prev) => prev.map((was, j) => (j === i ? false : was)));
          playReelStopSound();

          // The rightmost reel landing is the end of the spin.
          if (i < landing.length - 1) return;
          clearInterval(tumble);
          setSpinning(false);
          setResult({ prize: activePrize, alreadySpun: false });
          // Just behind the last clunk, so the two don't collide.
          setTimeout(() => (won ? playWinSound() : playNoWinSound()), 200);
          setShowModal(true);
        }, REEL_SPIN_MS + i * REEL_STOP_STAGGER_MS);
      });

    } catch {
      setSubmitting(false);
      setSpinning(false);
      setError("Network error. Please try again.");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (phase === "register") {
    return (
      <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-900/90 p-6 shadow-2xl backdrop-blur-md">
        <h2 className="text-center text-xl font-bold text-white mb-4">Enter Details to Play!</h2>
        <form onSubmit={handleRegister} className="space-y-4 text-left">
          {popupSettings.askName && (
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Name</label>
              <input
                type="text"
                required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          {popupSettings.askPhone && (
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. +1 555-0199"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}
          <PlayerFormFields
            fields={formFields}
            values={extraFieldValues}
            onChange={(key, value) =>
              setExtraFieldValues((prev) => ({ ...prev, [key]: value }))
            }
            disabled={registering}
          />

          {registerError && <p className="text-xs text-red-500 font-medium">{registerError}</p>}

          <button
            type="submit"
            disabled={registering}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            {registering ? "Registering..." : "Let's Play!"}
          </button>
        </form>
      </div>
    );
  }

  const isAlreadySpun = result?.alreadySpun;

  return (
    <div className="relative flex flex-col items-center gap-6">
      {/* Slot Machine Display */}
      <div className="w-80 rounded-3xl border-4 border-amber-500 bg-gradient-to-b from-neutral-800 to-neutral-950 p-6 shadow-2xl">
        {/* Lights / Header */}
        <div className="flex justify-between mb-4">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse delay-75" />
          <span className="text-xs font-black tracking-widest text-amber-400 uppercase">SLOT MACHINE</span>
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse delay-150" />
          <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse delay-300" />
        </div>

        {/* The Reels Panel */}
        <div className="flex gap-3 justify-center rounded-2xl bg-neutral-900 border border-neutral-700 p-4 shadow-inner">
          {reels.map((symbol, idx) => (
            <ReelWindow key={idx} symbolId={symbol} spinning={reelsSpinning[idx]} />
          ))}
        </div>

        {/* Action Lever / Spin Button */}
        <div className="mt-6 flex flex-col items-center">
          {isAlreadySpun ? (
            <button
              onClick={() => setShowModal(true)}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md active:scale-95"
            >
              View Winning Prize
            </button>
          ) : (
            <button
              onClick={handlePullLever}
              disabled={spinning || submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 py-4 text-base font-black text-neutral-950 shadow-lg border border-amber-400 tracking-wider uppercase active:scale-95 disabled:opacity-50"
            >
              {spinning ? "Spinning..." : "Pull Lever!"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 font-bold">{error}</p>}

      {/* Greeting user */}
      <p className="text-xs text-neutral-400">Playing as: <span className="font-bold text-neutral-200">{sessionName}</span></p>

      {result && (
        <PrizeResultModal
          open={showModal}
          prize={result.prize}
          alreadyPlayed={Boolean(result.alreadySpun)}
          thanksNote="Thank you for spinning the reels!"
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
