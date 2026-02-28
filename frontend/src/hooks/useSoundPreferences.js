import { useEffect, useState } from "react";

const SOUND_MUTED_KEY = "task-tracker-sound-muted";
const SOUND_VOLUME_KEY = "task-tracker-sound-volume";
const DEFAULT_VOLUME = 0.55;

function clampVolume(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return DEFAULT_VOLUME;
  }

  return Math.min(1, Math.max(0, numericValue));
}

function readInitialMuteState() {
  if (typeof window === "undefined") {
    return false;
  }

  const storedValue = localStorage.getItem(SOUND_MUTED_KEY);
  return storedValue === "true";
}

function readInitialVolume() {
  if (typeof window === "undefined") {
    return DEFAULT_VOLUME;
  }

  const storedValue = localStorage.getItem(SOUND_VOLUME_KEY);
  if (storedValue === null) {
    return DEFAULT_VOLUME;
  }

  return clampVolume(storedValue);
}

export function useSoundPreferences() {
  const [isMuted, setIsMuted] = useState(readInitialMuteState);
  const [volume, setVolume] = useState(readInitialVolume);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(SOUND_MUTED_KEY, String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(SOUND_VOLUME_KEY, String(volume));
  }, [volume]);

  const updateVolume = (nextValue) => {
    setVolume(clampVolume(nextValue));
  };

  const playSound = (url) => {
    if (isMuted) {
      return;
    }

    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(() => {});
  };

  return {
    isMuted,
    setIsMuted,
    volume,
    setVolume: updateVolume,
    playSound,
  };
}
