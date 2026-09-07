/*******************************************************************************
 * LoomVTT
 * client/core/media-helper.ts
 * 
 * 
 * Helper utilities for media and image manipulation.
 ******************************************************************************/

const VIDEO_URL_RE = /\.(webm|mp4|m4v|ogv|mov)(\?|#|$)/i;

export function isVideoUrl(url: string | undefined | null): boolean {
  return !!url && VIDEO_URL_RE.test(url);
}

export interface MediaHtmlOptions {
  className?: string;
  alt?: string;
  /** Extra attributes as a ready string (e.g. `data-action="edit-portrait"`). */
  extraAttrs?: string;
}

/** Returns the appropriate tag (`<img>` or `<video>`) for the image field value.
 * `<video>` is rendered with `muted loop autoplay playsinline preload="metadata"`.
 * `preload="metadata"` ensures fast loading by only downloading metadata (dimensions/first frame)
 * instead of the full file, preventing large webm files from freezing the sheet. */
export function mediaHtml(url: string, options: MediaHtmlOptions = {}): string {
  const cls = options.className ? ` class="${options.className}"` : '';
  const extra = options.extraAttrs ? ` ${options.extraAttrs}` : '';
  if (isVideoUrl(url)) {
    return `<video${cls}${extra} src="${url}" muted loop autoplay playsinline preload="metadata"></video>`;
  }
  const alt = options.alt !== undefined ? ` alt="${options.alt}"` : '';
  return `<img${cls}${extra} src="${url}"${alt}>`;
}
