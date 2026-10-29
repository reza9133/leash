// The 3D hero. three.js is loaded on demand; until it is ready, or when WebGL is missing, a drawn fallback shows.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, useTheme } from "../lib/theme";
import { LeashMark } from "./Logo";

type SceneHandle = { setTheme(t: "light" | "dim" | "dark"): void; dispose(): void };

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroScene({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const theme = useTheme();
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!webglAvailable()) {
      setState("fallback");
      return;
    }
    let cancelled = false;
    import("../three/heroScene")
      .then(({ createHeroScene }) => {
        if (cancelled || !host.current) return;
        try {
          handle.current = createHeroScene(host.current, { theme, reducedMotion: prefersReducedMotion() });
          setState("ready");
        } catch {
          setState("fallback");
        }
      })
      .catch(() => !cancelled && setState("fallback"));
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
    // the scene is created once; theme changes go through setTheme below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // wait one frame so the new CSS variables are applied before the scene reads them
    const id = requestAnimationFrame(() => handle.current?.setTheme(theme));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  return (
    <div className={`scene ${className}`.trim()} role="img" aria-label="A cord running from a held ring to a bead, passing through three gates. It goes slack, then pulls taut at the limit.">
      <div ref={host} className={`scene__canvas ${state === "ready" ? "is-ready" : ""}`} />
      {state !== "ready" && (
        <div className="scene__fallback" aria-hidden>
          <LeashMark size={220} />
        </div>
      )}
    </div>
  );
}
