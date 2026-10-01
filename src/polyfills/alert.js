// react-native-web ships Alert.alert as a no-op, so on the web every
// Alert.alert in the phone screens (validation errors, "Camera permission is
// required", failed saves) would do nothing. Route them to the browser's own
// dialogs: one button → window.alert; several → window.confirm, where OK runs
// the first non-cancel button and Cancel runs the cancel one.
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find(b => b.style === 'cancel');
    const action = buttons.find(b => b !== cancel);
    if (window.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}