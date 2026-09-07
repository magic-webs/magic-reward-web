"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type WheelFormField, type WheelPrize } from "@/lib/wheel";
import { firstAnswerProblem } from "@/lib/formFields";
import PlayerFormFields from "@/components/PlayerFormFields";
import PrizeResultModal from "@/components/PrizeResultModal";
import { GiftBoxIcon } from "@/components/game-icons";
import {
  playBoxOpenSound,
  playBoxSuspenseSound,
  playBoxTapSound,
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

// How long the box shakes before it gives up its prize.
const REVEAL_DELAY_MS = 1200;

const BOX_COUNT = 6;

type PopupSettings = {
  askName: boolean;
  askPhone: boolean;
};

export interface PickBoxProps {
  companySlug?: string;
  prizes: WheelPrize[];
  bgImageUrl?: string | null;
  initialSettings: PopupSettings;
  formFields: WheelFormField[];
}

export default function PickBox({
  companySlug,
  prizes,
  bgImageUrl,
  initialSettings,
  formFields,
}: PickBoxProps) {
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

  const [openingIdx, setOpeningIdx] = useState<number | null>(null);
  const [openedIdx, setOpenedIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showModal, setShowModal] = useState(false);

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
          setOpenedIdx(0); // Mark box 0 as opened by default for returning spun users
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

  async function handleOpenBox(idx: number) {
    if (openedIdx !== null || openingIdx !== null || submitting || !token) return;
    setError(null);

    unlockAudio();
    playBoxTapSound();
    setOpeningIdx(idx);
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
        setError(data.message ?? "Failed to open box. Please try again.");
        setOpeningIdx(null);
        return;
      }

      const activePrize = resolvePrize(data.prizeId);

      // The riser is started here rather than at click time so it lands on
      // the reveal however long the request took.
      playBoxSuspenseSound(REVEAL_DELAY_MS);
      setTimeout(() => {
        setOpeningIdx(null);
        setOpenedIdx(idx);
        setResult({ prize: activePrize, alreadySpun: false });
        playBoxOpenSound();
        // Just behind the lid pop, so the two don't fight each other.
        setTimeout(() => (activePrize.isWin ? playWinSound() : playNoWinSound()), 180);
        setShowModal(true);
      }, REVEAL_DELAY_MS);

    } catch {
      setSubmitting(false);
      setOpeningIdx(null);
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
        <h2 className="text-center text-xl font-bold text-white mb-4">Enter Details to Pick a Box!</h2>
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
    <div className="relative flex w-full max-w-md flex-col items-center gap-5">
      <div className="text-center">
        <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">Pick a Box to Win!</h2>
        <p className="mt-1 text-xs text-neutral-400">
          {isAlreadySpun
            ? "You have already opened your box."
            : openedIdx !== null
              ? "That was your box — here is what was inside."
              : `One of these ${BOX_COUNT} is holding your prize.`}
        </p>
      </div>

      {/* Grid of Boxes */}
      <div className="grid w-full grid-cols-2 gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 backdrop-blur-sm sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: BOX_COUNT }).map((_, idx) => {
          const isOpening = openingIdx === idx;
          const isOpened = openedIdx === idx;
          // Once any box is open the rest are out of play, so they read as
          // inactive rather than staying invitingly clickable.
          const isSpent = !isOpened && (openedIdx !== null || isAlreadySpun);

          return (
            <button
              key={idx}
              type="button"
              disabled={isOpened || isSpent || submitting}
              onClick={() => handleOpenBox(idx)}
              aria-label={isOpened ? `Box ${idx + 1}, opened` : `Open box ${idx + 1}`}
              className={`group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border transition-all duration-300 ${
                isOpened
                  ? "border-amber-400/70 bg-amber-400/10 shadow-[0_0_30px_-8px_rgba(251,191,36,0.8)]"
                  : isOpening
                    ? "border-amber-400 bg-amber-400/10"
                    : isSpent
                      ? "border-neutral-800 bg-neutral-900/50 opacity-40"
                      : "border-neutral-700 bg-gradient-to-b from-neutral-800 to-neutral-900/80 hover:-translate-y-1 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-400/10 active:translate-y-0 active:scale-95"
              }`}
            >
              <GiftBoxIcon state={isOpened ? "opened" : isOpening ? "opening" : "closed"} />
              <span
                className={`line-clamp-2 px-1 text-center text-[10px] font-bold tracking-wide ${
                  isOpened
                    ? result?.prize.isWin
                      ? "text-emerald-400"
                      : "text-neutral-300"
                    : isOpening
                      ? "text-amber-400"
                      : "text-neutral-400"
                }`}
              >
                {isOpened
                  ? (result?.prize.label ?? "Revealed")
                  : isOpening
                    ? "Opening…"
                    : `Box #${idx + 1}`}
              </span>
            </button>
          );
        })}
      </div>

      {isAlreadySpun && (
        <button
          onClick={() => setShowModal(true)}
          className="w-full max-w-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md active:scale-95"
        >
          View Winning Prize
        </button>
      )}

      {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
      <p className="text-xs text-neutral-400">Playing as: <span className="font-bold text-neutral-200">{sessionName}</span></p>

      {result && (
        <PrizeResultModal
          open={showModal}
          prize={result.prize}
          alreadyPlayed={Boolean(result.alreadySpun)}
          thanksNote="Thank you for picking a box!"
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
