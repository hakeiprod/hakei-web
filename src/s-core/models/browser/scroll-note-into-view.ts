/** Keep a playing note inside the score viewport without scrolling the page. */
export function scrollNoteIntoView(container: HTMLElement, note: SVGGElement) {
  const width = container.clientWidth;
  const maxScroll = container.scrollWidth - width;
  if (width <= 0 || maxScroll <= 0) return;

  const left = container.getBoundingClientRect().left + container.clientLeft;
  const bounds = note.getBoundingClientRect();
  const margin = Math.min(64, width / 4);
  let offset = 0;
  if (bounds.left < left + margin) {
    offset = bounds.left - left - margin;
  } else if (bounds.right > left + width - margin) {
    offset = bounds.right - (left + width - margin);
  }
  if (offset !== 0)
    container.scrollLeft = Math.max(
      0,
      Math.min(maxScroll, container.scrollLeft + offset),
    );
}
