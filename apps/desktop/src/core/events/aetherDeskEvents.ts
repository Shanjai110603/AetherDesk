// ── AetherDesk Typed Event Bus ────────────────────────────────────────────────
// Decouples cross-workspace communication (Forge ↔ Nexus, Artisan ↔ Nexus, etc.)
// All dispatchers and listeners import from this file for type safety.

export const AETHER_ANNOTATION_EVENT = 'aetherdesk:annotation';

export interface AnnotationEventDetail {
  imageDataUrl: string;   // base64 PNG screenshot composite
  note: string;           // optional user note
  targetLabel?: string;   // element label if click-mode target
  sourceName?: string;    // e.g. 'Forge Preview' or 'Artisan Sketch'
}

export function dispatchAnnotation(detail: AnnotationEventDetail): void {
  window.dispatchEvent(new CustomEvent(AETHER_ANNOTATION_EVENT, { detail }));
}

export function onAnnotation(
  handler: (detail: AnnotationEventDetail) => void
): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<AnnotationEventDetail>).detail);
  };
  window.addEventListener(AETHER_ANNOTATION_EVENT, listener);
  return () => window.removeEventListener(AETHER_ANNOTATION_EVENT, listener);
}
