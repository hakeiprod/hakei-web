import * as Drawing from "..";

export interface ToSVGOptions {
  /** Render one page; call again with another index for multipage documents. */
  pageIndex?: number;
  scale?: number;
  fontFamily?: string;
  fontSize?: number;
  paddingBottom?: number;
}

declare module ".." {
  interface Document {
    toSVG(options?: ToSVGOptions): SVGSVGElement;
  }
}

const svgNamespace = "http://www.w3.org/2000/svg";

function createSVGElement<K extends keyof SVGElementTagNameMap>(name: K) {
  return globalThis.document.createElementNS(svgNamespace, name);
}

function setMetadata(node: SVGElement, element: Drawing.Element) {
  node.setAttribute("type", element.role ?? element.kind);
  if (element.classList.length > 0)
    node.setAttribute("class", element.classList.join(" "));
  for (const [key, value] of Object.entries(element.source ?? {})) {
    if (value === undefined) continue;
    const name = key.replaceAll(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
    );
    node.setAttribute(`data-${name}`, String(value));
  }
}

function renderElement(element: Drawing.Element): SVGElement {
  if (element instanceof Drawing.Group) {
    const node = createSVGElement("g");
    setMetadata(node, element);
    node.setAttribute(
      "transform",
      `translate(${element.position.x}, ${element.position.y})`,
    );
    for (const child of element.children) node.append(renderElement(child));
    return node;
  }
  if (element instanceof Drawing.Glyph) {
    const node = createSVGElement("g");
    setMetadata(node, element);
    if (element.glyphName) node.dataset.glyphName = element.glyphName;
    const text = createSVGElement("text");
    text.setAttribute("x", String(element.position.x));
    text.setAttribute("y", String(element.position.y));
    text.textContent = String.fromCodePoint(element.codepoint);
    node.append(text);
    return node;
  }
  if (element instanceof Drawing.Line && element.role === "beam") {
    // A vertical shear preserves the slope without tilting the end faces beyond stems.
    const [left, right] =
      element.start.x <= element.end.x
        ? [element.start, element.end]
        : [element.end, element.start];
    const width = right.x - left.x;
    const slope = width > 0 ? (right.y - left.y) / width : 0;
    const node = createSVGElement("rect");
    setMetadata(node, element);
    node.setAttribute("x", String(left.x));
    node.setAttribute("y", String(left.y - element.strokeWidth / 2));
    node.setAttribute("width", String(width));
    node.setAttribute("height", String(element.strokeWidth));
    node.setAttribute("fill", element.stroke);
    node.setAttribute("stroke", "none");
    node.setAttribute(
      "transform",
      `matrix(1 ${slope} 0 1 0 ${-slope * left.x})`,
    );
    return node;
  }
  if (element instanceof Drawing.Line) {
    const node = createSVGElement("line");
    setMetadata(node, element);
    node.setAttribute("x1", String(element.start.x));
    node.setAttribute("y1", String(element.start.y));
    node.setAttribute("x2", String(element.end.x));
    node.setAttribute("y2", String(element.end.y));
    node.setAttribute("stroke", element.stroke);
    node.setAttribute("stroke-width", String(element.strokeWidth));
    return node;
  }
  if (element instanceof Drawing.Rectangle) {
    const node = createSVGElement("rect");
    setMetadata(node, element);
    node.setAttribute("x", String(element.bounds.x));
    node.setAttribute("y", String(element.bounds.y));
    node.setAttribute("width", String(element.bounds.width));
    node.setAttribute("height", String(element.bounds.height));
    node.setAttribute("stroke", element.stroke);
    node.setAttribute("stroke-width", String(element.strokeWidth));
    node.setAttribute("fill", element.stroke);
    node.setAttribute("fill-opacity", "0");
    if (element.label !== undefined) {
      const title = createSVGElement("title");
      title.textContent = element.label;
      node.append(title);
    }
    if (element.role === "debug-bounds") {
      node.dataset.debugBounds = "";
      node.addEventListener("mouseenter", () =>
        node.setAttribute("fill-opacity", "0.25"),
      );
      node.addEventListener("mouseleave", () =>
        node.setAttribute("fill-opacity", "0"),
      );
    }
    return node;
  }
  throw new TypeError(`Unsupported document element: ${element.kind}`);
}

/** Render resolved geometry without depending on musical or SMUFL models. */
export function toSVG(drawing: Drawing.Document, options: ToSVGOptions = {}) {
  const pageIndex = options.pageIndex ?? 0;
  const scale = options.scale ?? 1;
  const fontSize = options.fontSize ?? drawing.fontSize;
  const paddingBottom = options.paddingBottom ?? 0;
  if (
    !Number.isInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex >= drawing.pages.length
  )
    throw new RangeError(`Document page ${pageIndex} does not exist.`);
  if (!Number.isFinite(scale) || scale <= 0)
    throw new RangeError("SVG scale must be a positive finite number.");
  if (!Number.isFinite(fontSize) || fontSize <= 0)
    throw new RangeError("SVG font size must be a positive finite number.");
  if (!Number.isFinite(paddingBottom) || paddingBottom < 0)
    throw new RangeError("SVG padding must be a nonnegative finite number.");
  const page = drawing.pages[pageIndex];
  const svg = createSVGElement("svg");
  svg.setAttribute("xmlns", svgNamespace);
  svg.setAttribute("viewBox", `0 0 ${page.width} ${page.height}`);
  svg.setAttribute("width", String(page.width * scale));
  svg.setAttribute("height", String(page.height * scale + paddingBottom));
  svg.setAttribute("font-size", String(fontSize));
  svg.dataset.pageIndex = String(pageIndex);
  if (options.fontFamily) svg.setAttribute("font-family", options.fontFamily);
  const root = createSVGElement("g");
  root.setAttribute("type", "score");
  for (const element of page.elements) root.append(renderElement(element));
  svg.append(root);
  return svg;
}

Drawing.Document.prototype.toSVG = function (options) {
  return toSVG(this, options);
};
