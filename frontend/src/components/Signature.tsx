import { useRef, useState, type PointerEvent } from "react";
export function Signature({
  onChange,
  label = "Borrower Digital Signature *",
}: {
  onChange: (blob: Blob | null) => void;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  function position(e: PointerEvent<HTMLCanvasElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) * e.currentTarget.width) / box.width,
      y: ((e.clientY - box.top) * e.currentTarget.height) / box.height,
    };
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d")!,
      p = position(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    drawing.current = true;
    setDrawn(true);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = position(e),
      ctx = e.currentTarget.getContext("2d")!;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function stop() {
    if (!drawing.current) return;
    drawing.current = false;
    canvas.current!.toBlob(onChange, "image/png");
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          <i className="fas fa-signature text-indigo-600 mr-1" />
          {label}
        </label>
        <button
          type="button"
          className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold"
          onClick={() => {
            canvas.current!.getContext("2d")!.clearRect(0, 0, 680, 260);
            setDrawn(false);
            onChange(null);
          }}
        >
          Clear
        </button>
      </div>
      <div className="relative border-2 border-dashed border-indigo-300 rounded-xl overflow-hidden bg-white shadow-inner">
        {!drawn && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400">
            Sign here
          </span>
        )}
        <canvas
          ref={canvas}
          aria-label={label}
          width={680}
          height={260}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          className="sig-canvas w-full h-32"
        />
      </div>
    </div>
  );
}
