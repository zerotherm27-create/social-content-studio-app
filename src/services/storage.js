const storageKey = "social-content-studio.workspace.v1";

export function loadWorkspace(fallbackWorkspace) {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : fallbackWorkspace;
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
