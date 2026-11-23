const PRESETS_KEY = 'tableSettingsPresets';
const LEGACY_KEY = 'tableSettings';

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return { presets: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.presets)) {
      return { presets: [] };
    }
    return { presets: parsed.presets };
  } catch {
    return { presets: [] };
  }
}

function writeStore(store) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(store));
}

export function listSettingPresets() {
  return readStore()
    .presets.slice()
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

export function getSettingPreset(id) {
  return listSettingPresets().find((preset) => preset.id === id) || null;
}

export function saveSettingPreset(name, settings, existingId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a settings name');
  }
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid settings payload');
  }

  const store = readStore();
  const now = new Date().toISOString();

  if (existingId) {
    const index = store.presets.findIndex((preset) => preset.id === existingId);
    if (index === -1) {
      throw new Error('Settings preset not found');
    }
    store.presets[index] = {
      ...store.presets[index],
      name: trimmed,
      settings,
      updatedAt: now,
    };
    writeStore(store);
    return store.presets[index];
  }

  const preset = {
    id: createId(),
    name: trimmed,
    settings,
    createdAt: now,
    updatedAt: now,
  };
  store.presets.push(preset);
  writeStore(store);
  return preset;
}

export function renameSettingPreset(id, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a settings name');
  }
  const store = readStore();
  const index = store.presets.findIndex((preset) => preset.id === id);
  if (index === -1) {
    throw new Error('Settings preset not found');
  }
  store.presets[index] = {
    ...store.presets[index],
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.presets[index];
}

export function deleteSettingPreset(id) {
  const store = readStore();
  store.presets = store.presets.filter((preset) => preset.id !== id);
  writeStore(store);
}

export function clearAllSettingPresets() {
  localStorage.removeItem(PRESETS_KEY);
}

export function getLegacySingleSettings() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function formatPresetDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

/**
 * Build a safe download filename from a preset name.
 * Spaces, dots, and other unsupported filename characters become dashes.
 */
export function sanitizeSettingsFileName(name = '') {
  const base = String(name || 'table-settings')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'table-settings'}.json`;
}

export function downloadSettingsJson(settings, fileName) {
  const dataStr = JSON.stringify(settings, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
