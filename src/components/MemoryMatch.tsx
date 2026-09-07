"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lottie } from "lottie-react";
import { type WheelFormField, type WheelPrize } from "@/lib/wheel";
import { firstAnswerProblem } from "@/lib/formFields";
import PlayerFormFields from "@/components/PlayerFormFields";
import { playCardFlipSound, playMatchSuccessSound, playWinSound, unlockAudio } from "@/lib/sound";
import { notifyEmbedRegistered } from "@/lib/embedBridge";
import confettiAnimation from "../../public/lottie-animation/coffeti.json";

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
  prizes: WheelPrize[];
  bgImageUrl?: string | null;
  initialSettings: PopupSettings;
  formFields: WheelFormField[];
}

type CardState = {
  id: number;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
};

const DEFAULT_EMOJIS = ["🎈", "🎁", "🎉", "👑", "💎", "⭐"];

export default function MemoryMatch({
  companySlug,
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

    // Use prize labels or default emojis to fill 6 pairs
    const pool = prizes.map((p) => p.label).filter(Boolean);
    while (pool.length < 6) {
      pool.push(DEFAULT_EMOJIS[pool.length % DEFAULT_EMOJIS.length]);
    }
    const selectedLabels = pool.slice(0, 6);
    const doublePool = [...selectedLabels, ...selectedLabels];
    
    // Simple shuffle
    const shuffled = doublePool
      .map((label, index) => ({ id: index, label, isFlipped: false, isMatched: false }))
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
        body: JSON.stringify({ name, phone, token, extraFields: extraFieldValues }),
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
      if (cards[firstIdx].label === cards[secondIdx].label) {
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
    const spinUrl = companySlug ? `/api/w/${companySlug}/spin` : "/api/spin";
    try {
      const res = await fetch(spinUrl, {
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
      playWinSound();
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

  return (
    <div className="relative flex flex-col items-center gap-4">
      <h2 className="text-lg font-black text-amber-400 tracking-wider uppercase">Memory Match Pairs</h2>

      {isAlreadySpun ? (
        <div className="flex flex-col items-center">
          <p className="text-sm text-neutral-400 mb-4">You have already completed this game!</p>
          <button
            onClick={() => setShowModal(true)}
            className="w-full max-w-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md active:scale-95"
          >
            View Winning Prize
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-4">
          {cards.map((card, idx) => {
            const flipped = card.isFlipped || card.isMatched;

            return (
              <button
                key={card.id}
                disabled={flipped || submitting}
                onClick={() => handleFlipCard(idx)}
                className={`flex h-16 w-16 items-center justify-center rounded-xl border text-center text-xs font-bold transition-all duration-300 ${
                  flipped
                    ? "bg-white border-neutral-200 text-neutral-900 rotate-y-180"
                    : "bg-neutral-800 border-neutral-700 hover:border-amber-400 active:scale-95"
                }`}
              >
                {flipped ? (
                  <span className="line-clamp-2 px-1 text-[10px] leading-tight">{card.label}</span>
                ) : (
                  <span className="text-xl text-neutral-500">❓</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
      <p className="text-xs text-neutral-400">Playing as: <span className="font-bold text-neutral-200">{sessionName}</span></p>

      {/* Confetti Overlay */}
      {showModal && result?.prize.isWin && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <Lottie
            src={confettiAnimation}
            loop={false}
            autoplay
            className="w-full h-full"
            rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
          />
        </div>
      )}

      {/* Winning Prize Modal */}
      {showModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-900 p-6 text-center shadow-2xl">
            <h3 className="text-2xl font-black text-amber-400">
              {result.prize.isWin ? "🎉 CONGRATULATIONS!" : "Better luck next time!"}
            </h3>
            <p className="mt-3 text-sm text-neutral-400">
              {result.prize.isWin
                ? `You won: ${result.prize.label}`
                : "Thank you for playing Memory Match!"}
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="mt-6 w-full rounded-xl bg-neutral-800 hover:bg-neutral-700 py-3 text-sm font-bold text-white border border-neutral-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
