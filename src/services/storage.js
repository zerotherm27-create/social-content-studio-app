const storageKey = "katmon-studio.workspace.v1";
const legacyStorageKeys = ["social-content-studio.workspace.v1"];

export function loadWorkspace(fallbackWorkspace) {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved);

    for (const legacyKey of legacyStorageKeys) {
      const legacySaved = window.localStorage.getItem(legacyKey);
      if (legacySaved) {
        window.localStorage.setItem(storageKey, legacySaved);
        return JSON.parse(legacySaved);
      }
    }

    return fallbackWorkspace;
  } catch {
    return fallbackWorkspace;
  }
}

export function saveWorkspace(workspace) {
  window.localStorage.setItem(storageKey, JSON.stringify(workspace));
}

export function exportWorkspace(workspace) {
  return JSON.stringify({ generatedAt: new Date().toISOString(), ...workspace }, null, 2);
}
