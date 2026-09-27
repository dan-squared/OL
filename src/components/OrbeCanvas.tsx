"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Lean three.js viewer for the Orbe mark.
 * - No react-three-fiber: raw three.js, one canvas, on-demand rendering.
 * - Custom in-code studio HDRI (black room + large soft panels) so the
 *   chrome reads as clean mirror metal with no boxy stripe reflections.
 * - The GLB is authored lying flat (thin Y); REST pose tips it face-on
 *   to match the 2D mark. Drag to spin/tilt, release to spring back.
 * - Falls back to the PNG if WebGL / load fails.
 */

// GLB lies flat in XZ (thin Y) — tip it up to face the camera like the mark.
const REST_X = Math.PI / 2;
const REST_Y = 0;
// Vertical tilt range around the rest pose.
const TILT = 0.6;
// Pixels of drag for one full spin.
const SPIN_PX = 320;

/**
 * Minimal bright-grey studio: just enough tonal range for full metal
 * to read as chrome — bright overall, zero black, zero blowout.
 * Still fully procedural, zero network.
 */
const buildStudioEnv = () => {
  const scene = new THREE.Scene();
  // Neutral mid-grey base: reflections stay luminous, never muddy/pale.
  scene.background = new THREE.Color(0.3, 0.3, 0.3);
  const panel = (
    w: number,
    h: number,
    brightness: number,
    pos: [number, number, number],
    rot: [number, number, number]
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(brightness, brightness, brightness),
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    scene.add(mesh);
  };
  // Big soft overhead — broad silky top highlight.
  panel(10, 4.5, 13, [0, 7, 1], [Math.PI / 2, 0, 0]);
  // Bright frontal wash — keeps faces luminous.
  panel(14, 8, 1.0, [0, 2, 9], [0, Math.PI, 0]);
  // Slim side strips — crisp edge definition.
  panel(2, 10, 2.4, [-7, 2, 1], [0, Math.PI / 2.5, 0]);
  panel(2, 10, 2.0, [7, 1, 0], [0, -Math.PI / 2.5, 0]);
  // Gentle back lift.
  panel(14, 8, 1.0, [0, 3, -9], [0, 0, 0]);
  // Bright floor: downward-facing curves pick up light too.
  panel(14, 14, 0.6, [0, -6, 0], [-Math.PI / 2, 0, 0]);
  return scene;
};

export default function OrbeCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let raf = 0;
    let visible = true;
    let dragging = false;
    let disposed = false;
    const disposables: { dispose(): void }[] = [];

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // Defer: react-hooks/set-state-in-effect forbids sync setState here.
      queueMicrotask(() => {
        if (!disposed) setFailed(true);
      });
      return;
    }
    const gl = renderer;
    gl.setClearColor(0x000000, 0);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

    // No environment/room at all — plain three-point studio lighting.
    // Hemisphere base fill means no side ever falls to black.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdcdcdc, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 7, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(-6, 1, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(-1, 3, -6);
    scene.add(rim);

    // Compact grey-studio reflections for true full-metal chrome.
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = buildStudioEnv();
    const env = pmrem.fromScene(envScene, 0.03).texture;
    scene.environment = env;
    envScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    disposables.push(pmrem);
    disposables.push({ dispose: () => env.dispose() });

    const model = new THREE.Group();
    model.rotation.set(REST_X, REST_Y, 0);
    scene.add(model);

    const fitCamera = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      object.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist =
        (maxDim / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) *
        1.33;
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      gl.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    // On-demand loop: runs while interacting, snapping, or still settling.
    const tick = () => {
      raf = 0;
      if (disposed || !visible) return;
      model.rotation.x += (pose.x - model.rotation.x) * DAMP;
      model.rotation.y += (pose.y - model.rotation.y) * DAMP;
      gl.render(scene, camera);
      const settling =
        Math.abs(pose.x - model.rotation.x) > 1e-4 ||
        Math.abs(pose.y - model.rotation.y) > 1e-4;
      if (dragging || gsap.isTweening(pose) || settling) {
        raf = requestAnimationFrame(tick);
      }
    };
    const kick = () => {
      if (!raf && visible && !disposed) raf = requestAnimationFrame(tick);
    };

    // --- Drag to rotate, release to spring home ---
    // Damped follow: pointer drives a target pose, the model eases toward
    // it every frame — no sticking, no jumps.
    const DAMP = reduceMotion ? 1 : 0.28;
    const pose = { x: REST_X, y: REST_Y };
    let lastX = 0;
    let lastY = 0;

    const snapHome = () => {
      // Shortest path back to the rest spin (handles multi-turn drags).
      const d = THREE.MathUtils.euclideanModulo(
        REST_Y - pose.y + Math.PI,
        Math.PI * 2
      ) - Math.PI;
      gsap.to(pose, {
        x: REST_X,
        y: pose.y + d,
        duration: reduceMotion ? 0 : 1.4,
        ease: "elastic.out(1, 0.45)",
        onUpdate: kick,
        onComplete: kick,
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      gsap.killTweensOf(pose);
      pose.x = model.rotation.x;
      pose.y = model.rotation.y;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      kick();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      pose.y += (dx / SPIN_PX) * Math.PI * 2;
      pose.x = THREE.MathUtils.clamp(
        pose.x + (dy / SPIN_PX) * Math.PI * 2,
        REST_X - TILT,
        REST_X + TILT
      );
      kick();
    };
    const finishDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (e.pointerId !== -1) {
        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* already released */
        }
      }
      canvas.style.cursor = "grab";
      snapHome();
    };
    const onPointerUp = (e: PointerEvent) => finishDrag(e);

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    // Safety net: if capture is lost for any reason, never stay stuck.
    canvas.addEventListener("lostpointercapture", onPointerUp);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        resize();
        kick();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(host);

    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(host);

    new GLTFLoader().load(
      "/orbe.glb",
      (gltf) => {
        if (disposed) return;
        // Full mirror metal + strong env response for the chrome look.
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            const mats = mesh.material as
              | THREE.MeshStandardMaterial
              | THREE.MeshStandardMaterial[];
            (Array.isArray(mats) ? mats : [mats]).forEach((m) => {
              // Trust the authored hires materials (deep bases, mirror
              // roughness) — only enforce full metal + env response.
              m.metalness = 1;
              m.envMapIntensity = 1.2;
            });
          }
        });
        model.add(gltf.scene);
        fitCamera(model);
        resize();
        gl.render(scene, camera);
      },
      undefined,
      () => {
        if (!disposed) setFailed(true);
      }
    );

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      gsap.killTweensOf(pose);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("lostpointercapture", onPointerUp);
      io.disconnect();
      ro.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
        }
      });
      disposables.forEach((d) => d.dispose());
      gl.dispose();
      renderer = null;
    };
  }, []);

  if (failed) {
    return (
      <Image
        src="/orbe-mark.png"
        alt="Orbe Labs"
        width={250}
        height={250}
        priority
        className="h-auto w-full"
      />
    );
  }

  return (
    <div ref={hostRef} className="aspect-square w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        aria-label="Orbe Labs mark in 3D — drag to rotate"
      />
    </div>
  );
}
