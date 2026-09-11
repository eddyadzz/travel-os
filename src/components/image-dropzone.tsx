import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/api/upload";
import { cn } from "@/lib/utils";

type Props = {
  folder?: string;
  value?: string;
  onUploaded: (url: string) => void;
  onClear?: () => void;
  className?: string;
};

/**
 * Drag-and-drop image uploader. Drops into a slot with a preview, or click to
 * browse. Uploads to object storage (R2 / local fallback) and returns the URL.
 */
export function ImageDropzone({ folder = "images", value, onUploaded, onClear, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please drop an image file");
        return;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", folder);
        const res = await uploadImage({ data: form });
        onUploaded(res.url);
        toast.success("Image uploaded");
      } catch (error) {
        toast.error("Upload failed", error instanceof Error ? { description: error.message } : {});
      } finally {
        setBusy(false);
      }
    },
    [folder, onUploaded],
  );

  return (
    <div
      className={cn(
        "relative flex min-h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {value ? (
        <div className="relative w-full">
          <img src={value} alt="Uploaded" className="mx-auto max-h-32 rounded-lg object-contain" />
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              aria-label="Remove image"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ) : busy ? (
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-1 text-muted-foreground"
        >
          <UploadCloud className="size-6" />
          <span className="text-sm font-medium">Drop image here or click to browse</span>
          <span className="text-xs">JPEG · PNG · WebP · GIF · SVG, up to 8 MB</span>
        </button>
      )}

      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ImagePlus className="size-3.5" /> Replace
        </button>
      )}
    </div>
  );
}
