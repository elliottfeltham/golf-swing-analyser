export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const MAX_VIDEO_FILE_SIZE_BYTES = 150 * 1024 * 1024;

export type VideoValidationResult =
  { valid: true } | { valid: false; message: string };

export function validateVideoFile(
  file: Pick<File, "size" | "type">,
): VideoValidationResult {
  if (
    !ACCEPTED_VIDEO_TYPES.includes(
      file.type as (typeof ACCEPTED_VIDEO_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      message: "Choose an MP4, MOV, or WebM video that your browser can play.",
    };
  }

  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    return {
      valid: false,
      message:
        "Choose a video smaller than 150 MB for this browser-based check.",
    };
  }

  return { valid: true };
}
