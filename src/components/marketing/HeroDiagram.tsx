"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

// The hero motif: one offer at the centre, ringed by the six forms it can
// take. Keeps the site's engineering-drawing language — dashed connectors
// that draw themselves in — but the payload is now the choice of type, so
// a highlight travels around the ring and the picture says "any of these"
// without spending a line of copy on it.
export function HeroDiagram() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const wires = gsap.utils.toArray<SVGPathElement>("[data-wire]");
      const tiles = gsap.utils.toArray<SVGGElement>("[data-tile]");
      const glows = gsap.utils.toArray<SVGRectElement>("[data-glow]");

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set([...wires, ...tiles, "[data-core]"], { opacity: 1, strokeDashoffset: 0 });
        return;
      }

      gsap.set(tiles, { opacity: 0, scale: 0.9, transformOrigin: "center" });
      gsap.set("[data-core]", { opacity: 0, scale: 0.9, transformOrigin: "center" });

      gsap
        .timeline({ delay: 0.25 })
        .to("[data-core]", { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" })
        .from(
          wires,
          {
            // Each wire is authored with its own dash pattern, so animate the
            // offset by the measured length rather than a shared constant.
            strokeDashoffset: (i, target: SVGPathElement) => target.getTotalLength(),
            duration: 1.1,
            stagger: 0.07,
            ease: "power2.inOut",
          },
          "-=0.25",
        )
        .to(
          tiles,
          { opacity: 1, scale: 1, duration: 0.5, stagger: 0.07, ease: "power3.out" },
          "-=0.75",
        );

      // The orbit never stops, so the hero still breathes once the intro
      // has settled.
      gsap.to("[data-orbit]", {
        rotation: 360,
        svgOrigin: "600 190",
        duration: 48,
        repeat: -1,
        ease: "none",
      });

      // Light each type in turn. The tiles are authored in ring order, so
      // document order is the order the highlight travels.
      const cycle = gsap.timeline({ repeat: -1, delay: 1.7 });
      glows.forEach((glow) => {
        cycle
          .to(glow, { opacity: 1, duration: 0.35, ease: "power2.out" })
          .to(glow, { opacity: 0, duration: 0.35, ease: "power2.in" }, "+=0.45");
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 1200 380" fill="none" aria-hidden="true" className="h-full w-full">
      {/* connectors, each running from a type tile into the core */}
      {[
        "M237 78 C 340 78, 410 150, 534 150",
        "M162 190 C 300 190, 400 190, 534 190",
        "M237 302 C 340 302, 410 230, 534 230",
        "M963 302 C 860 302, 790 230, 666 230",
        "M1038 190 C 900 190, 800 190, 666 190",
        "M963 78 C 860 78, 790 150, 666 150",
      ].map((d) => (
        <path
          key={d}
          data-wire
          d={d}
          stroke="var(--site-glyph-faint)"
          strokeWidth="1.5"
          strokeDasharray="5 6"
        />
      ))}

      {/* the offer — the highlighted centre node */}
      <g data-core>
        <text x="566" y="118" fill="var(--site-accent-line)" fontSize="12" fontFamily="var(--font-mono)">
          OFFER
        </text>
        <rect
          x="534"
          y="128"
          width="132"
          height="124"
          rx="6"
          stroke="var(--site-accent-line)"
          strokeWidth="1.5"
          fill="rgba(16,185,129,0.07)"
        />
        <circle
          data-orbit
          cx="600"
          cy="190"
          r="42"
          stroke="rgba(16,185,129,0.4)"
          strokeWidth="1.5"
          strokeDasharray="4 8"
        />
        <circle cx="600" cy="190" r="27" stroke="var(--site-accent-line)" strokeWidth="1.5" />
        <path
          d="M600 177 L603.2 185.6 L612.4 186 L605.1 191.7 L607.6 200.5 L600 195.4 L592.4 200.5 L594.9 191.7 L587.6 186 L596.8 185.6 Z"
          stroke="var(--site-accent-line)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="rgba(16,185,129,0.25)"
        />
        {[
          [534, 128],
          [666, 128],
          [534, 252],
          [666, 252],
        ].map(([cx, cy]) => (
          <rect key={`${cx}-${cy}`} x={cx - 3.5} y={cy - 3.5} width="7" height="7" fill="var(--site-accent-line)" />
        ))}
      </g>

      {/* the six types, authored clockwise from the top left */}
      <TypeTile cx={185} cy={78} label="Wheel">
        <circle r="16" stroke="var(--site-glyph)" strokeWidth="1.5" />
        <path d="M0 -16 L0 16 M-16 0 L16 0" stroke="var(--site-glyph)" strokeWidth="1.5" />
        <path d="M-11 -11 L11 11 M11 -11 L-11 11" stroke="var(--site-glyph-faint)" strokeWidth="1.5" />
        <path d="M-5 -23 L5 -23 L0 -15 Z" fill="var(--site-glyph)" />
      </TypeTile>

      <TypeTile cx={110} cy={190} label="Scratch">
        <rect
          x="-22"
          y="-15"
          width="44"
          height="30"
          rx="4"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
        />
        <path
          d="M-14 5 C -7 -5, 1 9, 8 -2"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M-14 -7 L0 -7" stroke="var(--site-glyph-faint)" strokeWidth="1.5" />
      </TypeTile>

      <TypeTile cx={185} cy={302} label="Slot">
        <rect
          x="-24"
          y="-16"
          width="48"
          height="32"
          rx="4"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
        />
        <path d="M-8 -16 L-8 16 M8 -16 L8 16" stroke="var(--site-glyph-faint)" strokeWidth="1.5" />
        {[-16, 0, 16].map((x) => (
          <circle key={x} cx={x} r="4" stroke="var(--site-glyph)" strokeWidth="1.5" />
        ))}
      </TypeTile>

      <TypeTile cx={1015} cy={302} label="Memory">
        <rect
          x="-22"
          y="-14"
          width="19"
          height="28"
          rx="3"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
        />
        <rect
          x="3"
          y="-14"
          width="19"
          height="28"
          rx="3"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
        />
        <path d="M-12.5 -4 L-12.5 4 M-16.5 0 L-8.5 0" stroke="var(--site-glyph)" strokeWidth="1.5" />
        <circle cx="12.5" r="4" stroke="var(--site-glyph)" strokeWidth="1.5" />
      </TypeTile>

      <TypeTile cx={1090} cy={190} label="Plinko">
        <circle cy="-21" r="4" stroke="var(--site-glyph)" strokeWidth="1.5" />
        {[
          [-12, -9],
          [0, -9],
          [12, -9],
          [-6, 1],
          [6, 1],
          [-12, 11],
          [0, 11],
          [12, 11],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" fill="var(--site-glyph-dim)" />
        ))}
        <path
          d="M-20 18 L-20 24 M-7 18 L-7 24 M7 18 L7 24 M20 18 L20 24"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
        />
      </TypeTile>

      <TypeTile cx={1015} cy={78} label="Gift Box">
        <rect
          x="-19"
          y="-6"
          width="38"
          height="24"
          rx="3"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
        />
        <rect
          x="-23"
          y="-15"
          width="46"
          height="10"
          rx="2"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
        />
        <path d="M0 -15 L0 18" stroke="var(--site-glyph-dim)" strokeWidth="1.5" />
        <path
          d="M0 -15 C -11 -26, -19 -17, 0 -15 C 19 -17, 11 -26, 0 -15 Z"
          stroke="var(--site-glyph)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </TypeTile>
    </svg>
  );
}

function TypeTile({
  cx,
  cy,
  label,
  children,
}: {
  cx: number;
  cy: number;
  label: string;
  children: ReactNode;
}) {
  const w = 104;
  const h = 84;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <g data-tile>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
        stroke="var(--site-hairline)"
        strokeWidth="1.5"
        fill="var(--site-tint)"
      />
      {/* the travelling highlight, faded in and out by the cycle timeline */}
      <rect
        data-glow
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
        stroke="var(--site-accent-line)"
        strokeWidth="1.5"
        fill="rgba(16,185,129,0.06)"
        opacity="0"
      />
      <g transform={`translate(${cx} ${cy - 10})`}>{children}</g>
      <text
        x={cx}
        y={cy + 32}
        textAnchor="middle"
        fill="var(--site-faint)"
        fontSize="11"
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
      {[
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ].map(([px, py]) => (
        <rect
          key={`${px}-${py}`}
          x={px - 2.5}
          y={py - 2.5}
          width="5"
          height="5"
          fill="var(--site-glyph-dim)"
        />
      ))}
    </g>
  );
}
