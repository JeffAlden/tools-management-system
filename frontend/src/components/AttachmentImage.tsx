export function AttachmentImage({
  id,
  alt,
  className,
  preview = false,
  sizes = "(max-width: 640px) 80vw, 300px",
}: {
  id: string;
  alt: string;
  className?: string;
  preview?: boolean;
  sizes?: string;
}) {
  const source = `/api/attachments/${encodeURIComponent(id)}`;
  return (
    <img
      src={`${source}?width=${preview ? 1200 : 300}`}
      srcSet={[300, 600, 1200]
        .map((w) => `${source}?width=${w} ${w}w`)
        .join(", ")}
      sizes={
        preview
          ? "(max-width: 640px) 90vw, (max-width: 1024px) 85vw, 960px"
          : sizes
      }
      loading={preview ? "eager" : "lazy"}
      decoding="async"
      alt={alt}
      className={className}
    />
  );
}
