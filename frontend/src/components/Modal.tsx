import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  centered = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  centered?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  // Keep dialogs outside fieldsets, clipped containers and backdrop-filter ancestors.
  return createPortal(
    <div
      className="mobile-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = ref.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
            );
            if (nodes?.length) {
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (
                e.shiftKey &&
                (document.activeElement === first ||
                  document.activeElement === ref.current)
              ) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
        className={`bg-white rounded-2xl shadow-2xl ${wide ? "max-w-5xl" : "max-w-md"} w-full overflow-hidden border border-slate-100 max-h-[90dvh] flex flex-col`}
      >
        <div className="relative bg-slate-900 px-6 py-4 text-white flex justify-between items-center shrink-0">
          <h3 className={`font-bold text-base ${centered ? "w-full text-center px-5" : ""}`}>{title}</h3>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className={`text-slate-400 hover:text-white ${centered ? "absolute right-6" : ""}`}
          >
            <i className="fas fa-times" />
          </button>
        </div>
        <div className={`p-6 overflow-y-auto space-y-4 ${centered ? "text-center" : ""}`}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
