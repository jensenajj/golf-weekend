const STORAGE_KEY = "golf-weekend:player-id";

const listeners = new Set<() => void>();

export function getStoredPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredPlayerId(playerId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, playerId);
  listeners.forEach((l) => l());
}

export function subscribeStoredPlayerId(onChange: () => void) {
  window.addEventListener("storage", onChange);
  listeners.add(onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    listeners.delete(onChange);
  };
}

export function getStoredPlayerIdServerSnapshot(): string | null {
  return null;
}
