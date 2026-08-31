const MAX_IMPORTED_VIDEO_BYTES = 500 * 1024 * 1024;
const VIDEO_MIME_TYPES: Record<string, string> = {
  '3gp': 'video/3gpp',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
};

export function videoExtension(name: string) {
  const extension = name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  return extension && extension in VIDEO_MIME_TYPES ? extension : 'mp4';
}

export function videoMimeType(uri: string) {
  return VIDEO_MIME_TYPES[videoExtension(uri)] ?? 'video/mp4';
}

export function validateImportedVideo(asset: { size?: number }) {
  if (typeof asset.size === 'number' && asset.size > MAX_IMPORTED_VIDEO_BYTES) {
    throw new Error('Video je veći od dopuštenih 500 MB. Odaberite kraću ili komprimiranu snimku.');
  }
}

export function validateCopiedVideoSize(size?: number) {
  if (typeof size === 'number' && size > MAX_IMPORTED_VIDEO_BYTES) {
    throw new Error('Kopirani video je veći od dopuštenih 500 MB.');
  }
}
