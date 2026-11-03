/**
 * Reports whether an element is on screen. A browser delivers every change since its last
 * delivery in one batch, oldest first, so only the batch's last entry is the current state.
 */
export function watchOnScreen(element, onChange) {
  const observer = new IntersectionObserver((entries) => onChange(entries[entries.length - 1].isIntersecting));
  observer.observe(element);
  return observer;
}
