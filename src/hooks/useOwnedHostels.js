// src/hooks/useOwnedHostels.js
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Resolves the codes on the signed-in user into { code, name } pairs.
 *
 * Fetched on demand rather than subscribed: hostel names change about once
 * ever, and a manager owns a handful of properties at most. A listener per
 * hostel would cost more than it's worth.
 *
 * Codes with no hostel document are dropped. That happens when a reservation
 * succeeded but the hostel write didn't — the code is spent, but there's
 * nothing to show for it, so it shouldn't appear in the picker.
 */
export function useOwnedHostels() {
  const { user } = useAuth();

  const codes = user?.hostelCodes?.length
    ? user.hostelCodes
    : (user?.hostelCode ? [user.hostelCode] : []);

  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(false);

  // Codes are a stable, short list — join them so the effect doesn't re-run
  // on every render just because the array identity changed.
  const codesKey = codes.join(',');

  useEffect(() => {
    if (!codesKey) {
      setHostels([]);
      return undefined;
    }

    let cancelled = false;
    const list = codesKey.split(',');
    setLoading(true);

    (async () => {
      const snaps = await Promise.all(
        list.map((code) => getDoc(doc(db, 'hostels', code)).catch(() => null)),
      );
      if (cancelled) return;

      setHostels(
        snaps
          .map((snap, i) => (snap && snap.exists()
            ? { code: list[i], name: snap.data().name || list[i] }
            : null))
          .filter(Boolean),
      );
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [codesKey]);

  return { hostels, loading, codes };
}