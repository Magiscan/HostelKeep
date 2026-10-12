// src/components/maintenance/savePhoto.web.js
//
// "Save photo" in a browser: downloads the JPEG. See savePhoto.js for phones.

import { photoFileName } from './maintenanceUi';

export async function savePhoto(base64, { name, at } = {}) {
  if (!base64 || typeof document === 'undefined') return;
  // A Blob rather than a data: link — some browsers refuse to download large
  // data: URLs.
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = photoFileName(name, at);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}