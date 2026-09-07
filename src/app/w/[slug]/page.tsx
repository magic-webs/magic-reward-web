import { Suspense } from "react";
import { notFound } from "next/navigation";
import SpinWheel from "@/components/SpinWheel";
import ScratchCard from "@/components/ScratchCard";
import SlotMachine from "@/components/SlotMachine";
import PickBox from "@/components/PickBox";
import Plinko from "@/components/Plinko";
import MemoryMatch from "@/components/MemoryMatch";
import FomoNotifications from "@/components/FomoNotifications";
import { getCompanyBySlug, getPublicWheelConfig } from "@/lib/companies";
import { normalizeFomoConfig } from "@/lib/fomo";
import { getOfferConfigs } from "@/lib/offerConfig";

interface ThemeConfig {
  bgClass: string;
  headerImage: string | null;
  accentText: string;
  decorations: string[];
  snow?: boolean;
}

function getEventTheme(event: string = "none", hasBgImage: boolean): ThemeConfig {
  switch (event) {
    case "halloween":
      return {
        bgClass: hasBgImage ? "" : "bg-gradient-to-b from-neutral-950 via-purple-950 to-orange-950",
        headerImage: null,
        accentText: "text-orange-500 font-serif",
        decorations: ["👻", "🎃", "🦇", "💀", "🕸️"],
      };
    case "christmas":
      return {
        bgClass: hasBgImage ? "" : "bg-gradient-to-b from-neutral-950 via-red-950 to-emerald-950",
        headerImage: null,
        accentText: "text-red-400 font-sans tracking-wide",
        decorations: ["❄️", "🎄", "🎁", "🔔", "⛄"],
        snow: true,
      };
    case "birthday":
      return {
        bgClass: hasBgImage ? "" : "bg-gradient-to-b from-pink-900 via-rose-950 to-purple-950",
        headerImage: null,
        accentText: "text-rose-400 font-sans font-bold",
        decorations: ["🎈", "🎂", "🎉", "🎁", "🍰"],
      };
    case "anniversary":
      return {
        bgClass: hasBgImage ? "" : "bg-gradient-to-b from-neutral-950 via-neutral-900 to-amber-950",
        headerImage: null,
        accentText: "text-amber-500 font-serif font-black tracking-widest",
        decorations: ["✨", "💎", "🥂", "💖", "🌟"],
      };
    default:
      return {
        bgClass: hasBgImage ? "" : "bg-gradient-to-b from-neutral-950 via-neutral-900 to-emerald-950",
        headerImage: null,
        accentText: "text-emerald-500 font-sans tracking-wide",
        decorations: [],
      };
  }
}

export default async function CustomerLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ o?: string; embed?: string }>;
}) {
  const { slug } = await params;
  const { o: offerId, embed } = await searchParams;
  // Rendered inside the embed popup on a merchant site: drop the outer
  // breathing room, and leave the social proof to the loader, which is
  // already showing it on the page behind the modal.
  const embedded = embed === "1";
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const config = company.isActive ? await getPublicWheelConfig(company.id, offerId) : null;

  const bgStyle = config?.bgImageUrl
    ? { backgroundImage: `url(${config.bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  const theme = getEventTheme(config?.event, !!config?.bgImageUrl);

  const fomo = config?.offerId && !embedded
    ? normalizeFomoConfig((await getOfferConfigs(config.offerId)).fomo)
    : null;

  return (
    <div
      className={`relative flex flex-col items-center overflow-hidden px-4 ${
        embedded ? "min-h-full py-6" : "min-h-screen py-10"
      } ${theme.bgClass}`}
      style={bgStyle}
    >
      {/* CSS Keyframes for seasonal animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(0.8) rotate(0deg); opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { transform: translateY(-105vh) scale(1.2) rotate(45deg); opacity: 0; }
        }
      `}} />

      {/* Seasonal decorations/snow effect */}
      {theme.snow && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          {Array.from({ length: 25 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-white/40 select-none pointer-events-none"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                fontSize: `${Math.random() * 14 + 12}px`,
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: `${Math.random() * 6 + 6}s`,
                animationName: "fall",
                animationIterationCount: "infinite",
                animationTimingFunction: "linear",
              }}
            >
              ❄️
            </span>
          ))}
        </div>
      )}

      {theme.decorations.length > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          {Array.from({ length: 15 }).map((_, i) => (
            <span
              key={i}
              className="absolute select-none pointer-events-none opacity-20 text-3xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `100vh`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${Math.random() * 8 + 8}s`,
                animationName: "float-up",
                animationIterationCount: "infinite",
                animationTimingFunction: "linear",
              }}
            >
              {theme.decorations[i % theme.decorations.length]}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center text-center animate-[fade-in-up_0.5s_ease-out] z-10">
        {theme.headerImage ? (
          <img src={theme.headerImage} alt="Offer Campaign" className="w-full max-w-md" />
        ) : (
          <div className="py-4">
            <h1 className={`text-4xl font-extrabold tracking-tight md:text-6xl ${theme.accentText} drop-shadow-md`}>
              {config?.title ?? "EXCLUSIVE OFFER"}
            </h1>
            <p className="mt-2 text-sm text-gray-400 font-semibold tracking-wide uppercase">
              Presented by {company.name}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 z-10">
        {!company.isActive && <p className="text-sm text-gray-400">This campaign isn&apos;t currently active.</p>}
        {company.isActive && !config && (
          <p className="text-sm text-gray-400">This game isn&apos;t set up yet — check back soon!</p>
        )}
        {config && (
          <Suspense fallback={null}>
            {config.gameType === "scratch" ? (
              <ScratchCard
                companySlug={slug}
                offerId={config.offerId}
                prizes={config.prizes}
                bgImageUrl={config.bgImageUrl}
                initialSettings={{ askName: config.askName, askPhone: config.askPhone }}
                formFields={config.fields}
              />
            ) : config.gameType === "slot" ? (
              <SlotMachine
                companySlug={slug}
                offerId={config.offerId}
                prizes={config.prizes}
                bgImageUrl={config.bgImageUrl}
                initialSettings={{ askName: config.askName, askPhone: config.askPhone }}
                formFields={config.fields}
              />
            ) : config.gameType === "giftbox" ? (
              <PickBox
                companySlug={slug}
                offerId={config.offerId}
                prizes={config.prizes}
                bgImageUrl={config.bgImageUrl}
                initialSettings={{ askName: config.askName, askPhone: config.askPhone }}
                formFields={config.fields}
              />
            ) : config.gameType === "plinko" ? (
              <Plinko
                companySlug={slug}
                offerId={config.offerId}
                prizes={config.prizes}
                bgImageUrl={config.bgImageUrl}
                initialSettings={{ askName: config.askName, askPhone: config.askPhone }}
                formFields={config.fields}
              />
            ) : config.gameType === "memory" ? (
              <MemoryMatch
                companySlug={slug}
                offerId={config.offerId}
                prizes={config.prizes}
                bgImageUrl={config.bgImageUrl}
                initialSettings={{ askName: config.askName, askPhone: config.askPhone }}
                formFields={config.fields}
              />
            ) : (
              <SpinWheel
                companySlug={slug}
                offerId={config.offerId}
                prizes={config.prizes}
                wheelImageUrl={config.wheelImageUrl ?? ""}
                pinImageUrl={config.pinImageUrl ?? undefined}
                initialSettings={{ askName: config.askName, askPhone: config.askPhone }}
                formFields={config.fields}
              />
            )}
          </Suspense>
        )}
      </div>

      {fomo?.enabled && config?.offerId && (
        <FomoNotifications companySlug={slug} offerId={config.offerId} />
      )}
    </div>
  );
}
