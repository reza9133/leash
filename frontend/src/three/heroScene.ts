// The hero picture: a ring held at one end of a cord, a bead (the agent) at the other, and three gates (the limits)
// between them. The cord goes slack, then pulls taut as the bead moves away, then relaxes again.
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  QuadraticBezierCurve3,
  Scene,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  DoubleSide,
} from "three";

export type SceneTheme = "light" | "dim" | "dark";

interface Palette {
  accent: Color;
  ink: Color;
  bg: Color;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => new Color(css.getPropertyValue(name).trim() || fallback);
  return { accent: get("--accent", "#ff5a1f"), ink: get("--ink", "#16181d"), bg: get("--bg", "#f6f7f9") };
}

const RING = new Vector3(-3.3, 1.5, 0);
const LENGTH = 8.4;

export function createHeroScene(container: HTMLElement, opts: { theme: SceneTheme; reducedMotion: boolean }): { setTheme(t: SceneTheme): void; dispose(): void } {
  let palette = readPalette();
  const reduced = opts.reducedMotion;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 0.2, 12);

  const ambient = new AmbientLight(0xffffff, 0.9);
  const sun = new DirectionalLight(0xffffff, 1.5);
  sun.position.set(4, 6, 8);
  const glow = new PointLight(palette.accent, 24, 14, 1.6);
  glow.position.set(2.2, -0.8, 3);
  scene.add(ambient, sun, glow);

  const world = new Group();
  scene.add(world);

  // the hand: a ring
  const ringMat = new MeshStandardMaterial({ color: palette.ink, roughness: 0.38, metalness: 0.15 });
  const ring = new Mesh(new TorusGeometry(0.95, 0.2, 28, 72), ringMat);
  ring.position.copy(RING);
  ring.rotation.set(0.15, -0.35, 0);
  world.add(ring);

  // the agent: a bead
  const beadMat = new MeshStandardMaterial({ color: palette.accent, roughness: 0.28, metalness: 0.05, emissive: palette.accent, emissiveIntensity: 0.18 });
  const bead = new Mesh(new SphereGeometry(0.42, 40, 28), beadMat);
  world.add(bead);

  // the cord
  const cordMat = new MeshStandardMaterial({ color: palette.accent, roughness: 0.5, metalness: 0 });
  const cord = new Mesh(new TubeGeometry(new QuadraticBezierCurve3(RING, RING, RING), 2, 0.1, 6, false), cordMat);
  world.add(cord);

  // the limits: three translucent gates across the cord's path
  const gateGeo = new PlaneGeometry(2.0, 3.4);
  const gateEdges = new EdgesGeometry(new BoxGeometry(0.001, 3.4, 2.0));
  const gateFill = new MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.07, side: DoubleSide, depthWrite: false });
  const gateLine = new LineBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.55 });
  const gates: Group[] = [];
  [-0.9, 0.9, 2.7].forEach((x, i) => {
    const g = new Group();
    const plane = new Mesh(gateGeo, gateFill);
    plane.rotation.y = Math.PI / 2;
    g.add(plane, new LineSegments(gateEdges, gateLine));
    g.position.set(x, -0.45 - i * 0.12, 0);
    world.add(g);
    gates.push(g);
  });

  let disposed = false;
  let visible = true;
  let raf = 0;
  let size = { w: 1, h: 1 };
  const pointer = { x: 0, y: 0 };
  const cam = { x: 0, y: 0 };
  let tube: TubeGeometry | null = cord.geometry as TubeGeometry;
  const start = performance.now();

  function fit() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    size = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole scene in view on tall and narrow containers
    const s = Math.max(0.5, Math.min(1, camera.aspect / 1.55));
    world.scale.setScalar(s);
    world.position.set(0.3 * s, 0.1, 0);
    camera.updateProjectionMatrix();
  }

  function pose(time: number) {
    // 0 = slack, 1 = taut. One calm cycle every 10 s with a small tug at the end of the pull.
    const phase = (time % 10) / 10;
    const pull = phase < 0.45 ? phase / 0.45 : phase < 0.62 ? 1 : 1 - (phase - 0.62) / 0.38;
    const t = pull * pull * (3 - 2 * pull);
    const tug = phase >= 0.45 && phase < 0.62 ? Math.sin(((phase - 0.45) / 0.17) * Math.PI * 5) * 0.05 * (1 - (phase - 0.45) / 0.17) : 0;

    const bx = 0.4 + (LENGTH - 2.2) * (0.35 + 0.65 * t) + tug * 2;
    const by = -1.5 + Math.sin(time * 0.9) * 0.08 * (1 - t);
    const target = new Vector3(RING.x + bx - 1.2, by, 0.2);
    // sag from the cord length: the closer the bead, the more slack hangs
    const d = RING.distanceTo(target);
    const sag = Math.sqrt(Math.max(0, LENGTH * LENGTH - d * d)) * 0.62;
    const start3 = new Vector3(RING.x, RING.y - 0.95, RING.z);
    const mid = new Vector3((start3.x + target.x) / 2, (start3.y + target.y) / 2 - sag, 0.1);
    const next = new TubeGeometry(new QuadraticBezierCurve3(start3, mid, target), 72, 0.1, 7, false);
    tube?.dispose();
    tube = next;
    cord.geometry = next;
    bead.position.copy(target);
    ring.rotation.z = Math.sin(time * 0.6) * 0.05;
    gates.forEach((g, i) => {
      g.rotation.x = Math.sin(time * 0.5 + i) * 0.03;
    });
    gateLine.opacity = 0.4 + 0.3 * t;
  }

  function frame(now: number) {
    if (disposed) return;
    raf = 0;
    const time = (now - start) / 1000;
    cam.x += (pointer.x * 0.9 - cam.x) * 0.05;
    cam.y += (pointer.y * 0.5 - cam.y) * 0.05;
    camera.position.x = cam.x;
    camera.position.y = 0.2 + cam.y;
    camera.lookAt(0, -0.2, 0);
    pose(time);
    renderer.render(scene, camera);
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function renderOnce() {
    pose(5.2);
    camera.lookAt(0, -0.2, 0);
    renderer.render(scene, camera);
  }

  function kick() {
    if (disposed || reduced) return;
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  const onMove = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1);
  };
  const onLeave = () => {
    pointer.x = 0;
    pointer.y = 0;
  };
  const onVisibility = () => kick();

  const ro = new ResizeObserver(() => {
    fit();
    if (reduced) renderOnce();
  });
  ro.observe(container);
  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    kick();
  });
  io.observe(container);
  if (!reduced) {
    window.addEventListener("pointermove", onMove, { passive: true });
    container.addEventListener("pointerleave", onLeave);
  }
  document.addEventListener("visibilitychange", onVisibility);

  fit();
  if (reduced) renderOnce();
  else kick();

  return {
    setTheme() {
      palette = readPalette();
      ringMat.color.copy(palette.ink);
      beadMat.color.copy(palette.accent);
      beadMat.emissive.copy(palette.accent);
      cordMat.color.copy(palette.accent);
      gateFill.color.copy(palette.accent);
      gateLine.color.copy(palette.accent);
      glow.color.copy(palette.accent);
      if (reduced) renderOnce();
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      tube?.dispose();
      ring.geometry.dispose();
      bead.geometry.dispose();
      gateGeo.dispose();
      gateEdges.dispose();
      [ringMat, beadMat, cordMat, gateFill, gateLine].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      void size;
    },
  };
}
