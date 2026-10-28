/**
 * Installed before an action; records the DOM commit without an automation round trip.
 * @param {{ index: number, selector: string, text?: string, value?: string,
 * attributes?: Record<string, string>, previousGeneration?: string,
 * inputType?: string }} options
 */
export function observeActionState({
  index,
  selector,
  text,
  value,
  attributes,
  previousGeneration,
  inputType,
}) {
  const name = `rendering:action-state:${index}`;
  const probe = globalThis.__renderingProbe;
  const initialInput = probe.inputs.at(-1)?.id;
  probe.actionStates ??= {};
  let resolveState;
  const state = {
    done: new Promise((resolve) => {
      resolveState = resolve;
    }),
    inputId: null,
  };
  probe.actionStates[index] = state;
  let complete = false;
  const stop = () => {
    observer.disconnect();
    removeEventListener("input", afterEvent);
    removeEventListener("click", afterEvent);
    removeEventListener("resize", afterEvent);
  };
  function check() {
    if (complete) return;
    if (globalThis.__renderingProbe.inputs.at(-1)?.id === initialInput) return;
    const matchingInput = probe.inputs
      .slice(probe.inputs.findIndex((input) => input.id === initialInput) + 1)
      .find((input) => inputType === undefined || input.type === inputType);
    if (!matchingInput) return;
    state.inputId ??= matchingInput.id;
    const element = document.querySelector(selector);
    if (
      !element ||
      (text !== undefined && element.textContent.trim() !== text) ||
      (value !== undefined && element.value !== value) ||
      (attributes &&
        Object.entries(attributes).some(
          ([name, expected]) => element.getAttribute(name) !== expected,
        )) ||
      (previousGeneration !== undefined &&
        element.dataset.renderGeneration === previousGeneration)
    )
      return;
    complete = true;
    performance.mark(name);
    resolveState();
    stop();
  }
  const observer = new MutationObserver(check);
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  // Native value changes need not produce a mutation. Run after React's event commit.
  const afterEvent = () => queueMicrotask(check);
  addEventListener("input", afterEvent, { once: true });
  addEventListener("click", afterEvent, { once: true });
  addEventListener("resize", afterEvent, { once: true });
}
