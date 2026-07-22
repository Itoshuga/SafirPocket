'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function semanticColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function BoosterStudioCanvas({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
      canvas.dataset.rendering = 'webgl';
    } catch {
      canvas.dataset.rendering = 'fallback';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !reducedMotion;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(semanticColor('--color-background', '#f7f8fa'));
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 1.15, 6.2);
    camera.lookAt(0, 0.3, 0);

    const studio = new THREE.Group();
    scene.add(studio);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 12),
      new THREE.MeshStandardMaterial({
        color: semanticColor('--color-surface-muted', '#f1f3f7'),
        roughness: 0.9,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.1;
    floor.receiveShadow = true;
    studio.add(floor);

    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(2.55, 2.85, 0.18, 64),
      new THREE.MeshStandardMaterial({
        color: semanticColor('--color-surface', '#ffffff'),
        roughness: 0.72,
      }),
    );
    stage.position.y = -1.95;
    stage.receiveShadow = true;
    studio.add(stage);

    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 7),
      new THREE.MeshStandardMaterial({
        color: semanticColor('--color-primary-soft', '#eaf2ff'),
        roughness: 1,
      }),
    );
    backdrop.position.set(0, 0.6, -2.2);
    studio.add(backdrop);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3eb, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(-3, 5, 5);
    keyLight.castShadow = !reducedMotion;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(semanticColor('--color-primary', '#1f5fc4'), 0.45);
    fillLight.position.set(4, 1, 2);
    scene.add(fillLight);

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.12;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.08;
    };
    if (!reducedMotion) window.addEventListener('pointermove', onPointerMove, { passive: true });

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    const render = () => {
      studio.rotation.y += (pointerX - studio.rotation.y) * 0.035;
      studio.rotation.x += (-pointerY - studio.rotation.x) * 0.035;
      renderer.render(scene, camera);
      if (!reducedMotion) frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      observer.disconnect();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      stage.geometry.dispose();
      (stage.material as THREE.Material).dispose();
      backdrop.geometry.dispose();
      (backdrop.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [reducedMotion]);

  return (
    <div className="absolute inset-0 bg-background" aria-hidden="true">
      <canvas
        ref={canvasRef}
        data-testid="booster-studio-canvas"
        data-reduced-motion={reducedMotion}
        className="size-full"
      />
    </div>
  );
}
