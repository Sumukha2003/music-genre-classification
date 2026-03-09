import { FileAudio, Music, Upload, X } from "lucide-react";
import type React from "react";
import { useCallback, useRef, useState } from "react";

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp3",
  "audio/x-wav",
];
const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".ogg"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioUploader({
  onFileSelect,
  selectedFile,
  onClear,
  disabled,
}: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const isValidType =
      ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
    if (!isValidType) {
      setDragError("Unsupported format. Please use MP3, WAV, or OGG.");
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      setDragError("File too large. Maximum size is 50 MB.");
      return false;
    }
    setDragError(null);
    return true;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      onFileSelect(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect, validateFile],
  );

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  if (selectedFile) {
    return (
      <div className="relative flex items-center gap-4 p-5 rounded-2xl bg-charcoal-800 border border-amber-500/30 animate-fade-in">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <FileAudio className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate text-sm">
            {selectedFile.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatFileSize(selectedFile.size)}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-charcoal-700 hover:bg-destructive/20 hover:text-destructive border border-charcoal-600 flex items-center justify-center transition-colors"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload audio file"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "relative w-full flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none",
          isDragging
            ? "border-amber-500 bg-amber-500/5 upload-zone-active"
            : "border-charcoal-600 bg-charcoal-800/50 hover:border-amber-500/50 hover:bg-amber-500/5",
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />

        {/* Upload icon */}
        <div
          className={[
            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200",
            isDragging ? "bg-amber-500/20 scale-110" : "bg-charcoal-700",
          ].join(" ")}
        >
          <img
            src="/assets/generated/upload-icon.dim_128x128.png"
            alt=""
            className="w-10 h-10 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <Upload
            className={[
              "w-8 h-8 transition-colors",
              isDragging ? "text-amber-400" : "text-amber-500/70",
            ].join(" ")}
          />
        </div>

        <div className="text-center">
          <p className="font-semibold text-foreground text-base">
            {isDragging
              ? "Drop your audio file here"
              : "Drop audio file or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports MP3, WAV, OGG &mdash; up to 50 MB
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["MP3", "WAV", "OGG"].map((fmt) => (
            <span
              key={fmt}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-charcoal-700 text-muted-foreground border border-charcoal-600"
            >
              {fmt}
            </span>
          ))}
        </div>
      </button>

      {dragError && (
        <p className="text-sm text-destructive flex items-center gap-1.5 px-1">
          <X className="w-3.5 h-3.5 flex-shrink-0" />
          {dragError}
        </p>
      )}
    </div>
  );
}
