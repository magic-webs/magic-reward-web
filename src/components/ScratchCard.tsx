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
import { type WheelFormField, type WheelPrize } from "@/lib/wheel";
import { firstAnswerProblem } from "@/lib/formFields";
import PlayerFormFields from "@/components/PlayerFormFields";
import { GiftBoxIcon, PrizeBadge } from "@/components/game-icons";
import { Pointer } from "lucide-react";
import { playNoWinSound, playScratchSound, playWinSound, unlockAudio } from "@/lib/sound";
import { notifyEmbedRegistered } from "@/lib/embedBridge";
import confettiAnimation from "../../public/lottie-animation/coffeti.json";

const CARD_WIDTH = 320;
const CARD_HEIGHT = 180;

type SpinResult = {
  prize: WheelPrize;
  alreadySpun: boolean;
};

type Phase = "loading" | "register" | "ready";

type PopupSettings = {
  askName: boolean;
  askPhone: boolean;
};

export interface ScratchCardProps {
  companySlug?: string;
  prizes: WheelPrize[];
  bgImageUrl?: string | null;
  initialSettings: PopupSettings;
  formFields: WheelFormField[];
}

export default function ScratchCard({
  companySlug,
  prizes,
  bgImageUrl,
  initialSettings,
  formFields,
}: ScratchCardProps) {
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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isScratching, setIsScratching] = useState(false);
  const [percentScratched, setPercentScratched] = useState(0);
  const [revealedComplete, setRevealedComplete] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const apiTriggeredRef = useRef(false);

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
          setRevealedComplete(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenParam, router]);

  // Draw the scratch overlay when ready
  useEffect(() => {
    if (phase !== "ready" || revealedComplete) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear previous drawing
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw gold foil gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#f59e0b"); // amber-500
    grad.addColorStop(0.5, "#d97706"); // amber-600
    grad.addColorStop(1, "#b45309"); // amber-700
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw speckles
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 3 + 1,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = "rgba(251, 191, 36, 0.6)"; // amber-400/60
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Card text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 5;
    ctx.fillText("SCRATCH TO REVEAL", canvas.width / 2, canvas.height / 2);

    // Small drawn diamonds either side of the label, in place of the two
    // gift emoji that used to render differently on every platform.
    const labelWidth = ctx.measureText("SCRATCH TO REVEAL").width;
    ctx.fillStyle = "rgba(251, 191, 36, 0.9)"; // amber-400
    for (const offset of [-labelWidth / 2 - 18, labelWidth / 2 + 18]) {
      const cx = canvas.width / 2 + offset;
      const cy = canvas.height / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 5, cy);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx - 5, cy);
      ctx.closePath();
      ctx.fill();
    }
  }, [phase, revealedComplete]);

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

  async function triggerRevealPrize() {
    if (apiTriggeredRef.current || !token) return;
    apiTriggeredRef.current = true;
    setSubmitting(true);
    unlockAudio();

    try {
      playScratchSound(); // Scratching sound effect
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Something went wrong. Please try again.");
        apiTriggeredRef.current = false;
        return;
      }
      const prize = resolvePrize(data.prizeId, data.prizeLabel);
      setResult({ prize, alreadySpun: Boolean(data.alreadySpun) });
    } catch {
      setError("Couldn't reach the server. Check connection.");
      apiTriggeredRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  const checkPercentScratched = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let cleared = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) cleared++;
    }
    const percent = (cleared / (pixels.length / 4)) * 100;
    setPercentScratched(percent);

    if (percent > 45 && !revealedComplete) {
      setRevealedComplete(true);
      if (result && !result.alreadySpun) {
        if (result.prize.isWin) playWinSound();
        else playNoWinSound();
      }
      setShowModal(true);
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startScratch = (e: React.MouseEvent | React.TouchEvent) => {
    if (revealedComplete || submitting) return;
    setIsScratching(true);
    const pt = getCoordinates(e);
    if (pt) {
      lastPointRef.current = pt;
      drawScratch(pt.x, pt.y);
    }
  };

  const drawScratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "destination-out";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 32;

    ctx.beginPath();
    if (lastPointRef.current) {
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    lastPointRef.current = { x, y };

    if (!apiTriggeredRef.current) {
      void triggerRevealPrize();
    }
  };

  const handleScratchMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isScratching || revealedComplete) return;
    const pt = getCoordinates(e);
    if (pt) {
      drawScratch(pt.x, pt.y);
      if (Math.random() < 0.15) {
        checkPercentScratched();
      }
    }
  };

  const stopScratch = () => {
    setIsScratching(false);
    lastPointRef.current = null;
    checkPercentScratched();
  };

  const won = result != null && result.prize.isWin;

  if (prizes.length === 0) {
    return <p className="text-sm text-gray-400">This card isn&apos;t set up yet — check back soon!</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {phase === "ready" && (
        <div 
          className="relative select-none overflow-hidden rounded-2xl bg-neutral-900 shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
          style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        >
          {/* Revealed Prize (Behind Canvas) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center border border-amber-400/20 bg-neutral-900 p-4 text-center">
            {result ? (
              <div className="animate-[fade-in-up_0.3s_ease-out] space-y-1">
                  <PrizeBadge
                    won={won}
                    iconUrl={result.prize.iconUrl}
                    label={result.prize.label}
                    size="sm"
                  />
                <p className="font-bold text-white text-sm">
                  {result.prize.isWin ? `You won: ${result.prize.label}!` : "Better luck next time!"}
                </p>
                <p className="text-xxs text-amber-400/80 font-medium">
                  {result.prize.isWin ? "CLAIM CODE UNLOCKED" : "THANK YOU FOR PLAYING"}
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-gray-500 animate-pulse">Scratching reveals prize...</p>
            )}
          </div>

          {/* Foil Scratch Layer */}
          {!revealedComplete && (
            <canvas
              ref={canvasRef}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              onMouseDown={startScratch}
              onMouseMove={handleScratchMove}
              onMouseUp={stopScratch}
              onMouseLeave={stopScratch}
              onTouchStart={startScratch}
              onTouchMove={handleScratchMove}
              onTouchEnd={stopScratch}
              className="absolute inset-0 z-10 cursor-pointer touch-none"
            />
          )}
        </div>
      )}

      {phase === "loading" && <p className="text-sm text-gray-400">Loading your card…</p>}

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
          {sessionName && !revealedComplete && (
            <p className="text-sm font-semibold text-amber-300">
              <Pointer className="mr-1 inline size-4 align-[-2px]" aria-hidden="true" />
              Go ahead, {sessionName.split(" ")[0]}! Swipe to scratch the card.
            </p>
          )}

          {revealedComplete && result && (
            <div className="animate-[fade-in-up_0.4s_ease-out] rounded-2xl border border-amber-400/20 bg-neutral-900 p-5 text-center shadow-lg">
                <PrizeBadge
                  won={won}
                  iconUrl={result.prize.iconUrl}
                  label={result.prize.label}
                  size="sm"
                />
              <p className="mt-2 font-bold text-white">
                {won ? `You won: ${result.prize.label}` : "Better luck next time!"}
              </p>
              {result.alreadySpun && (
                <p className="mt-1 text-xs text-gray-500">You've already used your scratch code.</p>
              )}
            </div>
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

// Reusable subcomponents from SpinWheel
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
            <GiftBoxIcon className="size-6" /> Enter to Play
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
              {registering ? "Please wait…" : "Unlock My Card"}
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
              ? "You've already played!"
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
