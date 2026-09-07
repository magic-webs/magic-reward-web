"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type WheelFormField, type WheelPrize } from "@/lib/wheel";
import { firstAnswerProblem } from "@/lib/formFields";
import PlayerFormFields from "@/components/PlayerFormFields";
import PrizeResultModal from "@/components/PrizeResultModal";
import { CardBackIcon, MEMORY_SYMBOLS, memorySymbol } from "@/components/game-icons";
import {
  playCardFlipSound,
  playMatchSuccessSound,
  playMismatchSound,
  playNoWinSound,
  playWinSound,
  unlockAudio,
} from "@/lib/sound";
import { notifyEmbedRegistered } from "@/lib/embedBridge";

type SpinResult = {
  prize: WheelPrize;
  alreadySpun: boolean;
};

type Phase = "loading" | "register" | "ready";

type PopupSettings = {
  askName: boolean;
  askPhone: boolean;
};

export interface MemoryMatchProps {
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

type CardState = {
  id: number;
  // Which of the six shared symbols this card shows. Cards used to be
  // faced with prize labels padded out with emoji, which meant matching
  // two lines of truncated 10px text; a memory game wants a picture.
  symbolId: string;
  isFlipped: boolean;
  isMatched: boolean;
};

const PAIR_COUNT = 6;

// A real two-sided flip: the old card swapped its contents and applied
// rotate-y-180 to the whole button, which mirrored the face rather than
// turning the card over.
function MemoryCard({
  card,
  disabled,
  onFlip,
}: {
  card: CardState;
  disabled: boolean;
  onFlip: () => void;
}) {
  const faceUp = card.isFlipped || card.isMatched;
  const { Icon, className } = memorySymbol(card.symbolId);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onFlip}
      aria-label={faceUp ? `Card showing ${card.symbolId}` : "Flip card"}
      className="aspect-square w-full perspective-normal"
    >
      <span
        className={`relative block size-full transform-3d transition-transform duration-500 ${
          faceUp ? "rotate-y-180" : ""
        }`}
      >
        {/* back */}
        <span className="absolute inset-0 flex items-center justify-center rounded-xl border border-neutral-700 bg-gradient-to-b from-neutral-800 to-neutral-900 backface-hidden transition-colors hover:border-amber-400">
          <CardBackIcon className="size-5" />
        </span>
        {/* face */}
        <span
          className={`absolute inset-0 flex rotate-y-180 items-center justify-center rounded-xl border bg-white backface-hidden ${
            card.isMatched ? "border-emerald-400 ring-2 ring-emerald-400/40" : "border-neutral-200"
          }`}
        >
          <Icon className={`size-7 ${className}`} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

export default function MemoryMatch({
  companySlug,
  offerId,
  prizes,
  bgImageUrl,
  initialSettings,
  formFields,
}: MemoryMatchProps) {
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
  const gameHref = (token: string) => (companySlug ? `/w/${companySlug}?t=${token}` : `/?t=${token}`);

  const [phase, setPhase] = useState<Phase>(tokenParam ? "loading" : "register");
  const [token, setToken] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [popupSettings] = useState<PopupSettings>(initialSettings);

  const [cards, setCards] = useState<CardState[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Setup cards
  useEffect(() => {
    if (phase !== "ready") return;

    const symbolIds = MEMORY_SYMBOLS.slice(0, PAIR_COUNT).map((symbol) => symbol.id);
    const doublePool = [...symbolIds, ...symbolIds];

    // Simple shuffle
    const shuffled = doublePool
      .map((symbolId, index) => ({ id: index, symbolId, isFlipped: false, isMatched: false }))
      .sort(() => Math.random() - 0.5);

    setCards(shuffled);
  }, [phase, prizes]);

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
          router.replace("/");
          setPhase("register");
          return;
        }
        setSessionName(data.name);
        setToken(tokenParam);
        if (data.hasSpun) {
          setResult({ prize: resolvePrize(data.prizeId, data.prizeLabel), alreadySpun: true });
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

  async function handleFlipCard(idx: number) {
    if (cards[idx].isFlipped || cards[idx].isMatched || selectedIndices.length >= 2 || submitting || !token) return;
    
    unlockAudio();
    playCardFlipSound();

    const newIndices = [...selectedIndices, idx];
    setCards((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, isFlipped: true } : c))
    );
    setSelectedIndices(newIndices);

    if (newIndices.length === 2) {
      const [firstIdx, secondIdx] = newIndices;
      if (cards[firstIdx].symbolId === cards[secondIdx].symbolId) {
        // Matched
        playMatchSuccessSound();
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === firstIdx || i === secondIdx ? { ...c, isMatched: true } : c
            )
          );
          setSelectedIndices([]);
          
          // Check if all matched
          const isComplete = cards.every((c, i) =>
            i === firstIdx || i === secondIdx ? true : c.isMatched
          );
          if (isComplete) {
            triggerWin();
          }
        }, 600);
      } else {
        // Discrepancy - flip back
        playMismatchSound();
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === firstIdx || i === secondIdx ? { ...c, isFlipped: false } : c
            )
          );
          setSelectedIndices([]);
        }, 1200);
      }
    }
  }

  async function triggerWin() {
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
        setError(data.message ?? "Failed to claim reward. Please try again.");
        return;
      }

      const activePrize = resolvePrize(data.prizeId);
      setResult({ prize: activePrize, alreadySpun: false });
      if (activePrize.isWin) playWinSound();
      else playNoWinSound();
      setShowModal(true);
    } catch {
      setSubmitting(false);
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

  const matchedPairs = cards.filter((c) => c.isMatched).length / 2;

  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-5">
      <div className="text-center">
        <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">Memory Match Pairs</h2>
        <p className="mt-1 text-xs text-neutral-400">
          {isAlreadySpun
            ? "You have already completed this game."
            : `Find all ${PAIR_COUNT} pairs — ${matchedPairs} of ${PAIR_COUNT} matched.`}
        </p>
      </div>

      {isAlreadySpun ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full max-w-xs rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95"
        >
          View Winning Prize
        </button>
      ) : (
        <div className="grid w-full grid-cols-4 gap-2.5 rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 backdrop-blur-sm sm:gap-3">
          {cards.map((card, idx) => (
            <MemoryCard
              key={card.id}
              card={card}
              disabled={card.isFlipped || card.isMatched || submitting}
              onFlip={() => handleFlipCard(idx)}
            />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
      <p className="text-xs text-neutral-400">Playing as: <span className="font-bold text-neutral-200">{sessionName}</span></p>

      {result && (
        <PrizeResultModal
          open={showModal}
          prize={result.prize}
          alreadyPlayed={Boolean(result.alreadySpun)}
          thanksNote="Thank you for playing Memory Match!"
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
