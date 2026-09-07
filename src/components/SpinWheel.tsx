"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type SVGProps,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lottie } from "lottie-react";
import { getPrizeArcs, type WheelFormField, type WheelPrize } from "@/lib/wheel";
import { firstAnswerProblem } from "@/lib/formFields";
import PlayerFormFields from "@/components/PlayerFormFields";
import { GiftBoxIcon, PrizeBadge } from "@/components/game-icons";
import { playNoWinSound, playSpinSound, playWinSound, unlockAudio } from "@/lib/sound";
import { notifyEmbedRegistered } from "@/lib/embedBridge";
import confettiAnimation from "../../public/lottie-animation/coffeti.json";

const WHEEL_SIZE = 320;
const SPIN_DURATION_MS = 4200;

type SpinResult = {
  prize: WheelPrize;
  alreadySpun: boolean;
};

type Phase = "loading" | "register" | "ready";

type PopupSettings = {
  askName: boolean;
  askPhone: boolean;
};

export interface SpinWheelProps {
  // undefined => the legacy default company, hits the flat /api routes.
  companySlug?: string;
  /** Which offer this page is showing. Without it the server falls
   *  back to the company's newest active offer, so a registration
   *  would bind to the wrong offer whenever ?o= names another. */
  offerId?: string;
  // Pre-ordered ascending by `order`.
  prizes: WheelPrize[];
  wheelImageUrl: string;
  pinImageUrl?: string;
  initialSettings: PopupSettings;
  formFields: WheelFormField[];
}

// Picks a random point inside the winning wedge (away from its edges) and
// works out how far the wheel must rotate — on top of however much it has
// already turned — so that point ends up under the fixed pointer at the top.
function computeTargetRotation(currentRotation: number, arcs: ReturnType<typeof getPrizeArcs>, prizeId: string) {
  const arc = arcs.find((a) => a.id === prizeId)!;
  const span = arc.end - arc.start;
  const margin = span * 0.15;
  const rawPoint = arc.start + margin + Math.random() * (span - margin * 2);
  const point = ((rawPoint % 360) + 360) % 360;

  const currentMod = ((currentRotation % 360) + 360) % 360;
  const neededMod = (360 - point) % 360;
  let delta = neededMod - currentMod;
  if (delta <= 0) delta += 360;

  const extraSpins = 5 + Math.floor(Math.random() * 3);
  return currentRotation + delta + extraSpins * 360;
}

export default function SpinWheel({
  companySlug,
  offerId,
  prizes,
  wheelImageUrl,
  pinImageUrl,
  initialSettings,
  formFields,
}: SpinWheelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("t");

  const arcs = useMemo(() => getPrizeArcs(prizes), [prizes]);
  // Falls back to a minimal placeholder if a prize was deleted from the
  // admin after this token already won it — keeps old magic links working.
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
  const wheelHref = (token: string) => (companySlug ? `/w/${companySlug}?t=${token}` : `/?t=${token}`);

  const [phase, setPhase] = useState<Phase>(tokenParam ? "loading" : "register");
  const [token, setToken] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [extraFieldValues, setExtraFieldValues] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [popupSettings] = useState<PopupSettings>(initialSettings);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const pendingResultRef = useRef<SpinResult | null>(null);

  // A `?t=` in the URL is a magic link from a previous registration — look
  // it up so returning visitors never have to type their name/phone again.
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
          // Not spun yet — always show the confirm form, pre-filled with
          // whatever's already on file, rather than skipping straight to
          // the wheel.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // A confirm/update on an already-issued link keeps the same URL —
      // only a brand-new registration needs the token appended.
      if (!isConfirmingExisting) router.replace(wheelHref(data.token));
    } catch {
      setRegisterError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleSpin() {
    if (spinning || submitting || !token) return;
    setError(null);

    // Must happen synchronously inside this gesture handler, before any
    // `await`, or browsers won't let the AudioContext start.
    unlockAudio();

    setSubmitting(true);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Something went wrong. Please try again.");
        return;
      }
      const prize = resolvePrize(data.prizeId, data.prizeLabel);
      pendingResultRef.current = { prize, alreadySpun: Boolean(data.alreadySpun) };
      setRotation((prev) => computeTargetRotation(prev, arcs, prize.id));
      setSpinning(true);
      playSpinSound(SPIN_DURATION_MS);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTransitionEnd() {
    if (!spinning) return;
    setSpinning(false);
    if (pendingResultRef.current) {
      const landed = pendingResultRef.current;
      setResult(landed);
      setShowModal(true);
      pendingResultRef.current = null;
      if (!landed.alreadySpun) {
        if (landed.prize.isWin) playWinSound();
        else playNoWinSound();
      }
    }
  }

  const won = result != null && result.prize.isWin;

  if (prizes.length === 0) {
    return <p className="text-sm text-gray-400">This wheel isn&apos;t set up yet — check back soon!</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="[animation-play-state:running]"
        style={{
          animation: spinning ? "none" : "wheel-idle 3.2s ease-in-out infinite",
        }}
      >
        <Wheel
          wheelImageUrl={wheelImageUrl}
          pinImageUrl={pinImageUrl}
          rotation={rotation}
          spinning={spinning}
          onTransitionEnd={handleTransitionEnd}
        />
      </div>

      {phase === "loading" && <p className="text-sm text-gray-400">Loading your spin…</p>}

      {phase === "register" && (
        <RegisterModal
          name={name}
          phone={phone}
          onNameChange={setName}
          onPhoneChange={setPhone}
          settings={popupSettings}
          formFields={formFields}
          extraFieldValues={extraFieldValues}
          onExtraFieldChange={(key, value) =>
            setExtraFieldValues((prev) => ({ ...prev, [key]: value }))
          }
          registering={registering}
          error={registerError}
          onSubmit={handleRegister}
        />
      )}

      {phase === "ready" && (
        <div className="w-full max-w-sm animate-[fade-in-up_0.4s_ease-out] space-y-3 text-center">
          {sessionName && (
            <p className="text-sm font-semibold text-emerald-300">
              Welcome back, {sessionName.split(" ")[0]}!
            </p>
          )}

          {result ? (
            <ClaimCard result={result} won={won} />
          ) : (
            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning || submitting}
              className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-4 py-4 text-base font-bold text-neutral-900 transition-all duration-150 ease-out hover:brightness-105 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0 shadow-[0_6px_0_#78350f,0_10px_18px_rgba(120,53,15,0.45)] active:shadow-[0_2px_0_#78350f,0_4px_10px_rgba(120,53,15,0.4)]"
            >
              <Sparkle className="left-4 top-2 h-2.5 w-2.5 opacity-60" color="#78350f" />
              <Sparkle className="bottom-2 right-6 h-2 w-2 opacity-50" color="#78350f" />
              <span className="relative flex items-center justify-center gap-2">
                <RetryIcon className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />
                {spinning ? "Spinning…" : submitting ? "Checking…" : "Spin the Wheel"}
              </span>
            </button>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {showModal && result && (
        <ResultModal result={result} won={won} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

function ClaimCard({ result, won }: { result: SpinResult; won: boolean }) {
  return (
    <div className="animate-[fade-in-up_0.4s_ease-out] rounded-2xl border border-amber-400/20 bg-neutral-900 p-5 text-center shadow-lg">
      <PrizeBadge won={won} iconUrl={result.prize.iconUrl} label={result.prize.label} />
      <p className="mt-2 font-bold text-white">
        {won ? `You won: ${result.prize.label}` : "Better luck next time!"}
      </p>
      {result.alreadySpun && (
        <p className="mt-1 text-xs text-gray-500">You've already used your spin.</p>
      )}
    </div>
  );
}

function RegisterModal({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  settings,
  formFields,
  extraFieldValues,
  onExtraFieldChange,
  registering,
  error,
  onSubmit,
}: {
  name: string;
  phone: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  settings: PopupSettings;
  formFields: WheelFormField[];
  extraFieldValues: Record<string, string>;
  onExtraFieldChange: (key: string, value: string) => void;
  registering: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/70" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm animate-[modal-pop_0.35s_ease-out] space-y-3 rounded-2xl border border-amber-400/20 bg-neutral-900 p-6 shadow-2xl"
        >
          <h3 className="flex items-center justify-center gap-2 text-center text-lg font-bold text-white">
            <GiftBoxIcon className="size-6" /> Enter to Spin
          </h3>

          {settings.askName && (
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-amber-400" />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                disabled={registering}
                autoFocus
                className="w-full rounded-2xl border border-emerald-800/60 bg-white/5 py-3 pl-11 pr-4 text-sm text-white shadow-sm outline-none placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-60"
              />
            </div>
          )}
          {settings.askPhone && (
            <div className="relative">
              <PhoneIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-amber-400" />
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                disabled={registering}
                className="w-full rounded-2xl border border-emerald-800/60 bg-white/5 py-3 pl-11 pr-4 text-sm text-white shadow-sm outline-none placeholder:text-gray-500 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-60"
              />
            </div>
          )}
          <PlayerFormFields
            fields={formFields}
            values={extraFieldValues}
            onChange={onExtraFieldChange}
            disabled={registering}
            variant="amber"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={registering}
            className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-4 py-4 text-base font-bold text-neutral-900 transition-all duration-150 ease-out hover:brightness-105 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0 shadow-[0_6px_0_#78350f,0_10px_18px_rgba(120,53,15,0.45)] active:shadow-[0_2px_0_#78350f,0_4px_10px_rgba(120,53,15,0.4)]"
          >
            <Sparkle className="left-4 top-2 h-2.5 w-2.5 opacity-60" color="#78350f" />
            <Sparkle className="bottom-2 right-6 h-2 w-2 opacity-50" color="#78350f" />
            <span className="relative flex items-center justify-center gap-2">
              <RetryIcon className="h-5 w-5" />
              {registering ? "Please wait…" : "Unlock My Spin"}
            </span>
          </button>
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-gray-400">
            <LockIcon className="h-3.5 w-3.5" />
            We respect your privacy. Your details are safe with us.
          </p>
        </form>
      </div>
    </>
  );
}

function Wheel({
  wheelImageUrl,
  pinImageUrl,
  rotation,
  spinning,
  onTransitionEnd,
}: {
  wheelImageUrl: string;
  pinImageUrl?: string;
  rotation: number;
  spinning: boolean;
  onTransitionEnd: () => void;
}) {
  return (
    <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
      <img
        src={wheelImageUrl}
        alt="Prize wheel"
        draggable={false}
        className="pointer-events-none h-full w-full select-none object-contain"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.65, 0.1, 1)`
            : "none",
        }}
        onTransitionEnd={onTransitionEnd}
      />
      <Pointer pinImageUrl={pinImageUrl} />
    </div>
  );
}

function Pointer({ pinImageUrl }: { pinImageUrl?: string }) {
  if (pinImageUrl) {
    return (
      <img
        src={pinImageUrl}
        alt="Pointer"
        draggable={false}
        className="pointer-events-none absolute -top-2 left-1/2 z-20 h-10 w-10 -translate-x-1/2 select-none object-contain drop-shadow-lg"
      />
    );
  }

  return (
    <div className="absolute -top-2 left-1/2 z-20 -translate-x-1/2">
      <div className="flex h-10 w-10 rotate-[-45deg] items-center justify-center rounded-[50%_50%_50%_0] bg-gradient-to-br from-amber-400 to-yellow-600 shadow-lg">
        <div className="h-3.5 w-3.5 rounded-full bg-white" />
      </div>
    </div>
  );
}

function Sparkle({ className = "", color }: { className?: string; color: string }) {
  return (
    <span
      className={`absolute block ${className}`}
      style={{
        background: color,
        clipPath:
          "polygon(50% 0%, 61% 35%, 100% 50%, 61% 65%, 50% 100%, 39% 65%, 0% 50%, 39% 35%)",
      }}
    />
  );
}

function ResultModal({
  result,
  won,
  onClose,
}: {
  result: SpinResult;
  won: boolean;
  onClose: () => void;
}) {
  const celebrate = won && !result.alreadySpun;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/70" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm animate-[modal-pop_0.35s_ease-out] rounded-2xl border border-amber-400/20 bg-neutral-900 p-6 text-center shadow-2xl">
          <PrizeBadge
            won={won}
            iconUrl={result.prize.iconUrl}
            label={result.prize.label}
            size="lg"
          />
          <h3 className="mt-3 text-lg font-bold text-white">
            {result.alreadySpun
              ? "You've already spun!"
              : won
                ? "Congratulations!"
                : "So close!"}
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            {result.alreadySpun
              ? `This link already claimed: ${result.prize.label}.`
              : won
                ? `You won: ${result.prize.label}`
                : `${result.prize.label} — come back and try again soon!`}
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-emerald-600 active:translate-y-1 shadow-[0_5px_0_#064e3b,0_8px_14px_rgba(6,78,59,0.35)] active:shadow-[0_1px_0_#064e3b,0_2px_6px_rgba(6,78,59,0.3)]"
          >
            Done
          </button>
        </div>
      </div>
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          <Lottie
            src={confettiAnimation}
            loop={false}
            autoplay
            className="h-full w-full"
            rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
          />
        </div>
      )}
    </>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6.5 3.5c-1 0-1.8.8-1.8 1.8 0 7.7 6.3 14 14 14 1 0 1.8-.8 1.8-1.8v-2.4c0-.5-.3-.9-.8-1l-3-1c-.4-.1-.9 0-1.2.4l-.9 1.1a11 11 0 0 1-5.2-5.2l1.1-.9c.3-.3.5-.8.4-1.2l-1-3c-.1-.5-.5-.8-1-.8H6.5Z" />
    </svg>
  );
}

function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function RetryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 12a8 8 0 0 1 14.5-4.5M20 12a8 8 0 0 1-14.5 4.5" />
      <path d="M18 4v4h-4M6 20v-4h4" />
    </svg>
  );
}
