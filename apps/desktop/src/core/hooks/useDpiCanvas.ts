import { useEffect } from 'react';

export function useDpiCanvas(
  ref: React.RefObject<HTMLCanvasElement | null>,
  wrapRef: React.RefObject<HTMLElement | null>,
  onResize?: () => void,
): void {
  useEffect(() => {
    const canvas = ref.current;
    const wrapper = wrapRef.current;
    if (!canvas || !wrapper) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      onResize?.();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [ref, wrapRef, onResize]);
}