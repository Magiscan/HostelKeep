// src/hooks/useAvatarPicker.js
//
// Shared "take a photo or pick from the gallery" flow for all three avatars:
// manager profile, housekeeper profile, hostel logo.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THERE'S NO CROP SCREEN ANY MORE
//
// The first version passed `allowsEditing: true`, which hands off to the
// platform's crop activity. On Android that activity does not handle window
// insets, and this app runs with `edgeToEdgeEnabled: true` (required by
// targetSdkVersion 35). The result: the confirm button is drawn behind the
// navigation bar and the preview is offset — no way to accept the crop.
//
// Rather than fight it, we skip the editor and centre-crop to a square
// ourselves with expo-image-manipulator. An avatar is always a circle, so a
// centre crop is what the user would have drawn anyway, and it removes an
// entire platform-specific failure mode.
//
// Install:  npx expo install expo-image-manipulator
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/** Final avatar edge length. 512 is plenty for a 64px circle at 3x. */
const SIZE = 512;

/**
 * `manipulateAsync` moved to a /legacy entry point in newer SDKs (the same
 * change that gave you `expo-file-system/legacy`). Resolve whichever exists so
 * this file doesn't need editing when you bump the SDK.
 */
function getManipulate() {
  if (typeof ImageManipulator.manipulateAsync === 'function') {
    return ImageManipulator.manipulateAsync;
  }
  // eslint-disable-next-line global-require
  return require('expo-image-manipulator').manipulateAsync;
}

/** Centre-crop to a square, downscale, compress, return a data URI. */
async function squareCrop(asset) {
  const { uri, width, height } = asset;
  if (!width || !height) return null;

  const edge = Math.min(width, height);
  const originX = Math.round((width - edge) / 2);
  const originY = Math.round((height - edge) / 2);

  const manipulate = getManipulate();
  const out = await manipulate(
    uri,
    [
      { crop: { originX, originY, width: edge, height: edge } },
      { resize: { width: SIZE, height: SIZE } },
    ],
    {
      compress: 0.6,
      format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg',
      base64: true,
    },
  );

  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}

// The array form is the current API. `MediaTypeOptions` is deprecated in
// expo-image-picker 15 and removed in 16, so there's nothing to fall back to.
const MEDIA_TYPES = ['images'];

// allowsEditing is deliberately absent — see the note at the top.
// `exif: false` keeps the payload down; we don't need orientation metadata
// once the image has been re-encoded.
const OPTIONS = {
  mediaTypes: MEDIA_TYPES,
  quality: 1,        // crop from the original; squareCrop does the compressing
  base64: false,     // we only need the URI to hand to the manipulator
  exif: false,
};

export function useAvatarPicker() {
  const [config, setConfig] = useState(null);   // { onPicked, onRemove, canRemove }
  const [busy, setBusy] = useState(false);

  const open  = useCallback((cfg) => setConfig(cfg), []);
  const close = useCallback(() => setConfig(null), []);

  const handle = useCallback(async (launch) => {
    setBusy(true);
    try {
      const result = await launch();
      if (result.canceled || !result.assets?.length) return;

      const uri = await squareCrop(result.assets[0]);
      if (!uri) {
        Alert.alert('Could not read that image', 'Try another photo.');
        return;
      }
      await config?.onPicked?.(uri);
      close();
    } catch (e) {
      Alert.alert('Something went wrong', e.message);
    } finally {
      setBusy(false);
    }
  }, [config, close]);

  const fromGallery = useCallback(async () => {
    // Android 13+ uses the system Photo Picker, which runs in its own process
    // and hands back a single URI without needing any runtime permission.
    // READ_MEDIA_IMAGES is blocked in app.json for that reason —
    // requestMediaLibraryPermissionsAsync would return "denied" and abort
    // before the picker even opened. iOS still prompts, and still needs its
    // NSPhotoLibraryUsageDescription string.
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photos unavailable', 'Allow photo access in your device settings to choose an image.');
        return;
      }
    }
    await handle(() => ImagePicker.launchImageLibraryAsync(OPTIONS));
  }, [handle]);

  const fromCamera = useCallback(async () => {
    // launchCameraAsync is a no-op on web — the file input covers both there.
    if (Platform.OS === 'web') return fromGallery();

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera unavailable', 'Allow camera access in your device settings to take a photo.');
      return undefined;
    }
    await handle(() => ImagePicker.launchCameraAsync(OPTIONS));
    return undefined;
  }, [handle, fromGallery]);

  const remove = useCallback(async () => {
    await config?.onRemove?.();
    close();
  }, [config, close]);

  return {
    visible: !!config,
    canRemove: !!config?.canRemove,
    busy,
    open,
    close,
    fromCamera,
    fromGallery,
    remove,
  };
}