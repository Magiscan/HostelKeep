// src/components/maintenance/savePhoto.js
//
// "Save photo" on a phone: writes the JPEG to the app's cache and opens the
// system share sheet, where the person picks "Save image" (iOS), Google
// Photos, Drive, Files, WhatsApp…
//
// Why not save straight to the gallery: that needs expo-media-library and a
// photo-library permission, which Google Play restricts to apps whose core
// purpose is photos (Photo and Video Permissions policy) and Apple asks you
// to justify. The share sheet needs no permission at all.
//
// Needs:  npx expo install expo-sharing expo-file-system   (then a new build)
// The web version is savePhoto.web.js.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { photoFileName } from './maintenanceUi';

export async function savePhoto(base64, { name, at, dialogTitle } = {}) {
  if (!base64) return;
  if (!(await Sharing.isAvailableAsync())) throw new Error('share-unavailable');
  const uri = `${FileSystem.cacheDirectory}${photoFileName(name, at)}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle });
}