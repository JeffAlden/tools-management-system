import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
export function Photo({
  value,
  onChange,
  label,
  notify,
}: {
  value: Blob | null;
  onChange: (file: Blob | null) => void;
  label: string;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}) {
  const [preview, setPreview] = useState(""),
    [camera, setCamera] = useState(false);
  useEffect(() => {
    if (!value) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  function accept(file: File | undefined) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      notify("Use a PNG, JPEG or WebP image up to 5 MB.");
      return;
    }
    onChange(file);
  }
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        <i className="fas fa-camera text-indigo-600 mr-1" />
        {label}
      </label>
      <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-3">
        <button
          type="button"
          onClick={() => setCamera(true)}
          className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
        >
          <i className="fas fa-video mr-1" />
          Open Camera Snap
        </button>
        <label className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer text-center">
          <i className="fas fa-folder-open mr-1" />
          Upload File
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center min-h-[140px] flex items-center justify-center relative">
        {preview ? (
          <>
            <img
              src={preview}
              decoding="async"
              alt="Preview"
              className="max-h-40 mx-auto rounded-lg border border-slate-200 object-contain"
            />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(null)}
              className="absolute top-1 right-1 rounded-full bg-rose-500 text-white p-1"
            >
              <i className="fas fa-times" />
            </button>
          </>
        ) : (
          <div className="space-y-1">
            <i className="fas fa-camera-retro text-3xl text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">
              No Photo Captured Yet
            </p>
            <p className="text-[10px] text-slate-400">
              Click "Open Camera Snap" or upload an image file
            </p>
          </div>
        )}
      </div>
      {camera && (
        <Camera
          onClose={() => setCamera(false)}
          onCapture={(file) => {
            onChange(file);
            setCamera(false);
          }}
          notify={notify}
        />
      )}
    </div>
  );
}
function Camera({
  onClose,
  onCapture,
  notify,
}: {
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current!.srcObject = stream;
        await video.current!.play();
        setReady(true);
      } catch {
        notify(
          "Unable to open camera. Check camera permission or upload a photo.",
        );
        onClose();
      }
    })();
    return () => {
      disposed = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  function capture() {
    const v = video.current!;
    if (!v.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1200 / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/webp",
      0.8,
    );
  }
  return (
    <Modal title="Capture Live Camera Photo" onClose={onClose}>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        className="w-full aspect-video bg-black rounded-xl"
      />
      <p className="text-xs text-slate-500">
        Position the borrower or requested equipment within frame and press Snap
        Photo.
      </p>
      <button
        type="button"
        className="btn-primary w-full"
        disabled={!ready}
        onClick={capture}
      >
        {ready ? "Snap Photo" : "Initializing Camera Feed…"}
      </button>
    </Modal>
  );
}
