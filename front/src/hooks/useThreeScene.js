import { useCallback, useEffect, useRef, useState } from 'react';
import { ThreeSceneController } from '../services/ThreeSceneController.js';

/**
 * Mounts a ThreeSceneController against `hostRef` for the component's
 * lifetime and exposes the small set of imperative actions the UI needs
 * (build, resize, resetView, autorotate toggle, PNG capture) without
 * leaking Three.js objects into React state.
 */
export function useThreeScene(hostEl) {
  const controllerRef = useRef(null);
  const lastResultRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [autorotate, setAutorotate] = useState(false);

  useEffect(() => {
    if (!hostEl) return undefined;
    const controller = new ThreeSceneController(hostEl);
    const ok = controller.init();
    controllerRef.current = controller;
    setReady(ok);
    return () => {
      controller.dispose();
      controllerRef.current = null;
      setReady(false);
    };
  }, [hostEl]);

  const build = useCallback((result) => {
    lastResultRef.current = result;
    controllerRef.current?.build(result);
  }, []);

  const resize = useCallback(() => {
    controllerRef.current?.resize();
  }, []);

  const resetView = useCallback(() => {
    controllerRef.current?.resetView(lastResultRef.current);
  }, []);

  const toggleAutorotate = useCallback(() => {
    setAutorotate((prev) => {
      const next = !prev;
      controllerRef.current?.setAutorotate(next);
      return next;
    });
  }, []);

  const getPng = useCallback(() => controllerRef.current?.getPng() ?? null, []);

  return { ready, autorotate, build, resize, resetView, toggleAutorotate, getPng };
}
