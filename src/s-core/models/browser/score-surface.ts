import { drainCooperatively } from "./render-scheduler";
import type { RenderSteps } from "../sheet/render-steps";
import { subscribeScoreNavigation } from "./score-navigation";
let nextSurface = 0;
function idleTask() {
  return new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === "function")
      requestIdleCallback(() => resolve(), { timeout: 100 });
    else setTimeout(resolve, 32);
  });
}

/** Keep a completed SVG out of React's synchronous route-subtree deletion. */
export function createScoreSurface(
  placeholder: HTMLDivElement,
  { deferResize = false }: { deferResize?: boolean } = {},
) {
  const element = document.createElement("div");
  const owner = document.createElement("div");
  owner.id = `score-surface-${++nextSurface}`;
  owner.style.display = "contents";
  owner.append(element);
  element.style.cssText =
    "position:absolute;clip-path:inset(0);will-change:opacity;contain:layout paint";
  placeholder.setAttribute("aria-owns", owner.id);
  document.body.append(owner);
  let retired = false,
    resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  let composited = true,
    paintVisible = true,
    accessible = true,
    navigationPending = false,
    measuring = false,
    layoutRevision = 0,
    suspensionEpoch = 0;
  let suspendedScroll = { left: 0, top: 0, revision: 0 };
  const hitTarget = document.createElement("div");
  hitTarget.dataset.scoreHitTarget = "";
  hitTarget.setAttribute("aria-hidden", "true");
  hitTarget.style.cssText = "position:absolute;top:0;left:0;z-index:1";
  const updateOpacity = () => {
    element.style.opacity = composited
      ? paintVisible && !navigationPending
        ? "1"
        : "0"
      : "";
  };
  const applyVisibility = () => {
    updateOpacity();
    element.style.clipPath =
      paintVisible && !navigationPending ? "inset(0)" : "inset(100%)";
    if (accessible && !navigationPending)
      element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", "true");
  };
  const prepare = () => {
    if (retired) return;
    // Inspect only a bounded prefix, never walk a whole large score on input.
    // Tiny SVGs retain their inexpensive first-paint compositing; large SVGs
    // avoid the expensive layer rebuild on unrelated focus and search changes.
    const walker = document.createTreeWalker(element, 1);
    let remaining = 512;
    composited = true;
    while (walker.nextNode()) {
      if (--remaining < 0) {
        composited = false;
        break;
      }
    }
    element.style.willChange = composited ? "opacity" : "";
    updateOpacity();
  };
  const applyGeometry = (forceWidth: boolean) => {
    if (
      retired ||
      (navigationPending && !measuring) ||
      (deferResize && !forceWidth && !element.firstElementChild)
    )
      return;
    const box = placeholder.getBoundingClientRect();
    element.style.left = `${box.left + window.scrollX}px`;
    element.style.top = `${box.top + window.scrollY}px`;
    if (forceWidth || !deferResize || !element.firstElementChild)
      element.style.width = `${box.width}px`;
    placeholder.style.height = `${element.getBoundingClientRect().height}px`;
  };
  const sync = () => applyGeometry(false);
  const commit = ({ height }: { height?: number } = {}) => {
    if (retired) return;
    ++layoutRevision;
    // A job may finish while its route is pending. Measure it without publishing
    // it or locking in the zero size of a content-visibility:hidden subtree.
    measuring = true;
    if (navigationPending) element.style.contentVisibility = "";
    try {
      prepare();
      // A previous, larger drawing must not contribute to the next scroll bounds.
      hitTarget.style.width = "0px";
      hitTarget.style.height = "0px";
      if (composited) hitTarget.remove();
      // Fix the completed viewport's size before size containment. This keeps a
      // browser resize from revisiting every SVG paint chunk while the next
      // generation is being built; the new SVG is already installed here.
      element.style.contain = "layout paint";
      element.style.height = height === undefined ? "" : `${height}px`;
      applyGeometry(true);
      if (height === undefined)
        element.style.height = `${element.getBoundingClientRect().height}px`;
      element.style.contain = "strict";
      if (!composited) {
        // Score SVGs have no input controls or pointer handlers. One transparent
        // HTML target avoids walking thousands of glyphs for each hit test while
        // native wheel/touch scrolling still belongs to this same scroll owner.
        // It is outside the SVG, so its drawing and highlight nodes stay intact.
        const width = element.scrollWidth,
          scrollHeight = element.scrollHeight;
        hitTarget.style.width = `${width}px`;
        hitTarget.style.height = `${scrollHeight}px`;
        element.append(hitTarget);
      }
    } finally {
      measuring = false;
      if (navigationPending) element.style.contentVisibility = "hidden";
    }
  };
  const unsubscribeNavigation = subscribeScoreNavigation((pending) => {
    if (retired) return;
    const epoch = ++suspensionEpoch;
    if (pending) {
      if (!navigationPending)
        suspendedScroll = {
          left: element.scrollLeft,
          top: element.scrollTop,
          revision: layoutRevision,
        };
      navigationPending = true;
      element.style.contentVisibility = "hidden";
      applyVisibility();
    } else if (navigationPending) {
      // On success, Link and Viewer unmount in the same React commit. Let all
      // cleanup finish before deciding whether a still-live surface needs to
      // resume; otherwise restoring it here would force the departing layout.
      queueMicrotask(() => {
        if (retired || suspensionEpoch !== epoch) return;
        navigationPending = false;
        element.style.contentVisibility = "";
        applyVisibility();
        if (layoutRevision === suspendedScroll.revision) {
          element.scrollLeft = suspendedScroll.left;
          element.scrollTop = suspendedScroll.top;
        }
      });
    }
  });
  const observer =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(sync);
  observer?.observe(element);
  observer?.observe(placeholder);
  observer?.observe(document.body);
  window.addEventListener("resize", sync);
  sync();
  return {
    element,
    sync,
    commit,
    prepare,
    finished,
    prime() {
      if (retired || element.firstElementChild) return;
      paintVisible = true;
      accessible = false;
      prepare();
      applyVisibility();
    },
    setVisible(visible: boolean) {
      if (retired) return;
      paintVisible = visible;
      accessible = visible;
      applyVisibility();
    },
    retire() {
      if (retired) return;
      retired = true;
      unsubscribeNavigation();
      observer?.disconnect();
      window.removeEventListener("resize", sync);
      placeholder.removeAttribute("aria-owns");
      delete element.dataset.layout;
      element.setAttribute("aria-hidden", "true");
      paintVisible = false;
      updateOpacity();
      element.style.clipPath = "inset(100%)";
      // Retired graphics will never be shown again. Skip their contents during
      // the destination layout while retaining nodes for bounded idle cleanup.
      element.style.contentVisibility = "hidden";
      // Score SVGs contain no focusable controls. Clipping excludes their hit
      // testing and aria-hidden excludes accessibility navigation. Avoid inert
      // and inherited pointer-events: both restyle every SVG descendant.
      // Large scores switch only their clip: opacity compositing makes
      // Chromium rebuild their layers on unrelated input.
      function* release(): RenderSteps<void> {
        let node: Element = element;
        while (element.firstElementChild) {
          if (node.lastElementChild) node = node.lastElementChild;
          else {
            const parent = node.parentElement!;
            node.remove();
            node = parent;
          }
          yield;
        }
      }
      // Cleanup has no visible result: keep it at idle priority rather than
      // competing with the destination paint or its next input event.
      idleTask()
        .then(() =>
          drainCooperatively(release(), { budgetMs: 2, yieldTask: idleTask }),
        )
        .catch((error) => console.error(error))
        .finally(() => {
          owner.remove();
          resolveFinished();
        });
    },
  };
}
