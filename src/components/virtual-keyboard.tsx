import { Keyboard } from "@/s-core/models/keyboard";
import { useEffect, useRef } from "react";

export function VirtualKeyboard(props: { keyboard?: Keyboard }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const svg = props.keyboard?.render();
    if (!ref.current?.hasChildNodes() && svg) ref.current?.appendChild(svg);
  }, [props.keyboard]);
  return (
    <>
      <div ref={ref} />
    </>
  );
}
