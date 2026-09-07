"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lottie } from "lottie-react";
import { type WheelFormField, type WheelPrize } from "@/lib/wheel";
import { firstAnswerProblem } from "@/lib/formFields";
import PlayerFormFields from "@/components/PlayerFormFields";
import { playPlinkoDropSound, playPlinkoBounceSound, playWinSound, unlockAudio } from "@/lib/sound";
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

export interface PlinkoProps {
  companySlug?: string;
  prizes: WheelPrize[];
  bgImageUrl?: string | null;
  initialSettings: PopupSettings;
  formFields: WheelFormField[];
}

const BOARD_WIDTH = 320;
const BOARD_HEIGHT = 380;
const PEG_RADIUS = 3;
const BALL_RADIUS = 7;

export default function Plinko({
  companySlug,
  prizes,
  bgImageUrl,
  initialSettings,
  formFields,
}: PlinkoProps) {
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

  const [dropping, setDropping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Set up board rendering loop
  useEffect(() => {
    if (phase !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw Board (static state)
    drawBoard(ctx, null);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [phase]);

  function drawBoard(ctx: CanvasRenderingContext2D, ballPos: { x: number; y: number } | null) {
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Draw background board outline
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Draw Slots dividers at the bottom
    const slotCount = Math.max(3, prizes.length);
    const slotWidth = BOARD_WIDTH / slotCount;
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    for (let i = 1; i < slotCount; i++) {
      ctx.beginPath();
      ctx.moveTo(i * slotWidth, BOARD_HEIGHT - 60);
      ctx.lineTo(i * slotWidth, BOARD_HEIGHT);
      ctx.stroke();
    }

    // Draw labels in slots
    ctx.fillStyle = "#a3a3a3";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    prizes.forEach((p, idx) => {
      const x = idx * slotWidth + slotWidth / 2;
      ctx.fillText(p.label.substring(0, 8), x, BOARD_HEIGHT - 15);
    });

    // Draw Pegs (7 rows)
    ctx.fillStyle = "#fbbf24"; // golden pegs
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const pinsInRow = r + 3;
      const spacing = BOARD_WIDTH / (pinsInRow - 1);
      const y = 80 + r * 35;
      for (let c = 0; c < pinsInRow; c++) {
        const x = c * spacing;
        // Avoid rendering outermost off-board pins
        if (x < 10 || x > BOARD_WIDTH - 10) continue;
        ctx.beginPath();
        ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Ball
    if (ballPos) {
      ctx.fillStyle = "#ef4444"; // red Plinko ball
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      // Highlight glow
      ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, BALL_RADIUS + 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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

  async function handleDropBall() {
    if (dropping || submitting || !token) return;
    setError(null);

    unlockAudio();
    playPlinkoDropSound();
    setDropping(true);
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
        setError(data.message ?? "Failed to spin. Please try again.");
        setDropping(false);
        return;
      }

      const activePrize = resolvePrize(data.prizeId);
      const targetSlotIdx = prizes.findIndex((p) => p.id === activePrize.id);
      const slotCount = Math.max(3, prizes.length);
      const slotWidth = BOARD_WIDTH / slotCount;
      const targetX = targetSlotIdx * slotWidth + slotWidth / 2;

      // Animate Plinko fall
      animateBall(targetX, activePrize);

    } catch {
      setSubmitting(false);
      setDropping(false);
      setError("Network error. Please try again.");
    }
  }

  function animateBall(targetX: number, activePrize: WheelPrize) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let ballX = BOARD_WIDTH / 2;
    let ballY = 20;
    let velX = 0;
    let velY = 2;
    const gravity = 0.15;
    const bounceFactor = -0.3;

    // Pre-calculate path segments through rows
    const rowsCount = 7;
    const rowHeights = Array.from({ length: rowsCount }).map((_, i) => 80 + i * 35);

    function update() {
      velY += gravity;
      ballX += velX;
      ballY += velY;

      // Boundary bounds
      if (ballX - BALL_RADIUS < 0) {
        ballX = BALL_RADIUS;
        velX *= bounceFactor;
      }
      if (ballX + BALL_RADIUS > BOARD_WIDTH) {
        ballX = BOARD_WIDTH - BALL_RADIUS;
        velX *= bounceFactor;
      }

      // Check hits on peg rows
      rowHeights.forEach((pegY) => {
        if (Math.abs(ballY - pegY) < 6 && velY > 0) {
          // Add a random offset or guide the ball towards targetX as it falls
          const distanceToTarget = targetX - ballX;
          const correction = distanceToTarget / (BOARD_HEIGHT - ballY) * 1.5;
          velX = (Math.random() - 0.5) * 3 + correction;
          velY = -velY * 0.4; // Bounce up slightly
          playPlinkoBounceSound();
        }
      });

      // Bottom boundary slot landing
      if (ballY >= BOARD_HEIGHT - 35) {
        // Snap to target slot smoothly
        ballX = targetX;
        ballY = BOARD_HEIGHT - BALL_RADIUS;
        drawBoard(ctx!, { x: ballX, y: ballY });
        
        // Done
        setDropping(false);
        setResult({ prize: activePrize, alreadySpun: false });
        playWinSound();
        setShowModal(true);
        return;
      }

      drawBoard(ctx!, { x: ballX, y: ballY });
      animationFrameRef.current = requestAnimationFrame(update);
    }

    update();
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
        <h2 className="text-center text-xl font-bold text-white mb-4">Enter Details to Drop the Ball!</h2>
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
      <h2 className="text-lg font-black text-amber-400 tracking-wider uppercase">Plinko Drop</h2>

      {/* Canvas Plinko Board */}
      <canvas
        ref={canvasRef}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        className="rounded-3xl border-4 border-neutral-800 shadow-2xl bg-neutral-950"
      />

      <div className="w-full max-w-xs mt-2">
        {isAlreadySpun ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md active:scale-95"
          >
            View Winning Prize
          </button>
        ) : (
          <button
            onClick={handleDropBall}
            disabled={dropping || submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 py-4 text-base font-black text-neutral-950 shadow-lg border border-amber-400 tracking-wider uppercase active:scale-95 disabled:opacity-50"
          >
            {dropping ? "Dropping..." : "Drop Ball!"}
          </button>
        )}
      </div>

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
                : "Thank you for playing Plinko!"}
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
