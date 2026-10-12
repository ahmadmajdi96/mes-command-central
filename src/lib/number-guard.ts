/**
 * App-wide guard: number boxes never accept negative values unless the input
 * opts in with `data-allow-negative` or sets a negative `min`.
 * Blocks "-" / "e" typing, negative pastes, and arrow-down below the minimum.
 */
export function installNumberGuard() {
  if (typeof document === "undefined" || (window as any).__numGuard) return;
  (window as any).__numGuard = true;
  const guarded = (el: EventTarget | null): el is HTMLInputElement => {
    if (!(el instanceof HTMLInputElement) || el.type !== "number") return false;
    if (el.hasAttribute("data-allow-negative")) return false;
    const min = el.getAttribute("min");
    return min == null || min === "" || Number(min) >= 0;
  };
  document.addEventListener("keydown", (e) => {
    if (!guarded(e.target)) return;
    if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") e.preventDefault();
    if (e.key === "ArrowDown") {
      const el = e.target;
      const min = Number(el.getAttribute("min") || 0);
      const step = Number(el.getAttribute("step")) || 1;
      if ((Number(el.value) || 0) - step < min) e.preventDefault();
    }
  }, true);
  document.addEventListener("paste", (e) => {
    if (!guarded(e.target)) return;
    const t = e.clipboardData?.getData("text") ?? "";
    if (t.includes("-")) e.preventDefault();
  }, true);
  document.addEventListener("wheel", (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === "number" && document.activeElement === e.target) e.target.blur();
  }, { passive: true, capture: true });
}
