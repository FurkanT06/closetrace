// Safari can block storage entirely in some privacy modes: even reading window.localStorage may
// throw a SecurityError. Every browser-storage access goes through these helpers so a blocked or
// full store degrades to "nothing saved" instead of an uncaught exception.
const area = (kind) => {
  try {
    return window[kind] ?? null;
  } catch {
    return null;
  }
};

export function storageGet(key, kind = 'localStorage') {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function storageSet(key, value, kind = 'localStorage') {
  try {
    area(kind).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key, kind = 'localStorage') {
  try {
    area(kind)?.removeItem(key);
  } catch {
    /* Nothing to remove if storage is unavailable. */
  }
}
