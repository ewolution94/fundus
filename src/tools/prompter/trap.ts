// Tab stays on the stage while it covers the page: from the last control to the first and back.

export function trapTab(e: KeyboardEvent, root: HTMLElement): void {
  const list = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => el.getClientRects().length);
  if (!list.length) {
    e.preventDefault();
    return;
  }
  const first = list[0];
  const last = list[list.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && (at === first || at === root || !root.contains(at))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (at === last || !root.contains(at))) {
    e.preventDefault();
    first.focus();
  }
}
