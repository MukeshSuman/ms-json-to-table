export function normalizeFilenamePostfix(value = '') {
  return String(value || '')
    .trim()
    .replace(/^\*+/, '')
    .toLowerCase();
}

export function matchesFilenamePostfix(fileName = '', postfix = '') {
  const name = (String(fileName).split(/[/\\]/).pop() || '').toLowerCase();
  const suffix = normalizeFilenamePostfix(postfix);
  if (!suffix) return true;
  return name.endsWith(suffix);
}

export function getSchemaSignature(columns = []) {
  return [...columns].map(String).sort().join('|');
}

/**
 * Collect all .json files from a directory (recursive).
 * Filtering by postfix happens later in the UI.
 */
export async function collectJsonFromDirectory(dirHandle, pathPrefix = '') {
  const files = [];

  for await (const [name, handle] of dirHandle.entries()) {
    const relativePath = pathPrefix ? `${pathPrefix}/${name}` : name;

    if (handle.kind === 'file') {
      if (!name.toLowerCase().endsWith('.json')) continue;
      const file = await handle.getFile();
      files.push({
        id: relativePath,
        name,
        relativePath,
        file,
        handle,
      });
      continue;
    }

    if (handle.kind === 'directory') {
      const nested = await collectJsonFromDirectory(handle, relativePath);
      files.push(...nested);
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function collectJsonFromFileList(fileList) {
  return Array.from(fileList || [])
    .filter((file) => file.name.toLowerCase().endsWith('.json'))
    .map((file) => {
      const relativePath = file.webkitRelativePath || file.name;
      return {
        id: relativePath,
        name: file.name,
        relativePath,
        file,
        handle: null,
      };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function filterFilesByPostfix(entries, postfix) {
  const suffix = normalizeFilenamePostfix(postfix);
  if (!suffix) return entries;
  return entries.filter((entry) => matchesFilenamePostfix(entry.name, suffix));
}

const MAX_LETTER_STEM = 10;

function splitNameAndExtension(fileName = '') {
  // Keep original casing so camelCase word breaks still work.
  const name = String(fileName).split(/[/\\]/).pop() || '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) {
    return { stem: name, extension: '' };
  }
  return {
    stem: name.slice(0, dot),
    extension: name.slice(dot).toLowerCase(),
  };
}

/**
 * Split a filename stem into words using:
 * underscore, dash, and camelCase boundaries.
 */
export function splitFilenameWords(stem = '') {
  const text = String(stem || '');
  if (!text) return [];

  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[_\-\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rebuild the trailing slice of the original stem that covers the last N words,
 * preserving real separators (_ / -) or camelCase adjacency.
 */
function trailingStemForWords(stem, wordCount) {
  if (!stem || wordCount <= 0) return '';

  const words = splitFilenameWords(stem);
  if (words.length < wordCount) return '';

  const lastWords = words.slice(-wordCount);

  // snake/kebab: teachers_2 / teachers-2
  const separated = new RegExp(
    `${lastWords.map(escapeRegExp).join('[_-]+')}$`,
    'i'
  );
  const separatedMatch = stem.match(separated);
  if (separatedMatch) {
    const idx = separatedMatch.index || 0;
    if (idx > 0 && (stem[idx - 1] === '_' || stem[idx - 1] === '-')) {
      return stem.slice(idx - 1);
    }
    return separatedMatch[0];
  }

  // camelCase: TransferTeachers (no separator)
  const camel = new RegExp(`${lastWords.map(escapeRegExp).join('')}$`, 'i');
  const camelMatch = stem.match(camel);
  if (camelMatch) {
    return camelMatch[0];
  }

  return lastWords.join('_');
}

/**
 * Preferred postfix: last 2 words before extension.
 * Fallback postfix: last max 10 letters of stem + extension.
 */
export function guessFilePostfix(fileName = '', { preferWords = 2, maxLetters = MAX_LETTER_STEM } = {}) {
  const { stem, extension } = splitNameAndExtension(fileName);
  if (!stem) return extension || '';

  const words = splitFilenameWords(stem);

  if (preferWords > 0 && words.length >= preferWords) {
    const twoWordStem = trailingStemForWords(stem, preferWords);
    if (twoWordStem) {
      return `${twoWordStem}${extension}`.toLowerCase();
    }
  }

  const letterStem = stem.slice(-Math.min(maxLetters, stem.length));
  return `${letterStem}${extension}`.toLowerCase();
}

function countPostfixGroups(fileNames, guessOptions) {
  const counts = new Map();

  fileNames.forEach((name) => {
    const postfix = guessFilePostfix(name, guessOptions);
    if (!postfix || postfix.startsWith('.')) return;
    counts.set(postfix, (counts.get(postfix) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([postfix, count]) => ({
      postfix,
      label: `*${postfix}`,
      count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.postfix.length !== b.postfix.length) return a.postfix.length - b.postfix.length;
      return a.postfix.localeCompare(b.postfix);
    });
}

/**
 * Build postfix suggestion groups from real folder filenames.
 * 1) Try last-2-words + extension (word breaks: _ - camelCase)
 * 2) If that does not produce useful groups, fall back to max 10 letters + extension
 * Groups with minCount (default 3) are preferred; otherwise show whatever exists.
 */
export function buildFilenamePostfixGroups(
  fileNames = [],
  { minCount = 3, maxGroups = 7 } = {}
) {
  const names = fileNames
    .map((name) => String(name).split(/[/\\]/).pop() || '')
    .filter(Boolean);

  if (!names.length) return [];

  const twoWordGroups = countPostfixGroups(names, {
    preferWords: 2,
    maxLetters: MAX_LETTER_STEM,
  });

  const twoWordUseful = twoWordGroups.filter((group) => {
    const { stem } = splitNameAndExtension(group.postfix);
    if (/[_-]/.test(stem)) return true;

    // camelCase postfixes are lowercased, so re-check against original filenames
    return names.some((name) => {
      const { stem: originalStem } = splitNameAndExtension(name);
      return (
        guessFilePostfix(name, { preferWords: 2 }) === group.postfix &&
        splitFilenameWords(originalStem).length >= 2
      );
    });
  });

  let qualified = twoWordUseful.filter((group) => group.count >= minCount);
  if (qualified.length) {
    return qualified.slice(0, maxGroups);
  }

  // Two-word guesses exist but none hit minCount — still use them if we have a few files.
  if (twoWordUseful.length && names.length < minCount) {
    return twoWordUseful.slice(0, maxGroups);
  }

  // Fallback: max 10 letters before extension
  const letterOnlyGroups = countPostfixGroups(names, {
    preferWords: 0,
    maxLetters: MAX_LETTER_STEM,
  });

  qualified = letterOnlyGroups.filter((group) => group.count >= minCount);
  if (qualified.length) {
    return qualified.slice(0, maxGroups);
  }

  // Last resort: show available endings even with 1–2 files
  const fallback = twoWordUseful.length ? twoWordUseful : letterOnlyGroups;
  return fallback.slice(0, maxGroups);
}

/**
 * Parse + validate that every file is a JSON array of objects with the same keys.
 */
export async function validateFolderJsonFiles(
  entries,
  parseFileContent,
  postfixLabel = '*.json'
) {
  if (!entries.length) {
    throw new Error(
      `No files to validate. Select matching ${postfixLabel} files first.`
    );
  }

  const parsed = [];

  for (const entry of entries) {
    try {
      const text = await entry.file.text();
      const result = parseFileContent(text, entry.name);
      parsed.push({
        ...entry,
        text,
        data: result.data,
        columns: result.columns,
        signature: getSchemaSignature(result.columns),
        status: 'ok',
        error: '',
      });
    } catch (err) {
      parsed.push({
        ...entry,
        text: '',
        data: null,
        columns: [],
        signature: '',
        status: 'error',
        error: err.message || 'Failed to parse file',
      });
    }
  }

  const errors = parsed.filter((item) => item.status === 'error');
  if (errors.length) {
    return {
      ok: false,
      message: `${errors.length} file(s) failed to parse`,
      columns: [],
      files: parsed,
    };
  }

  const signatures = [...new Set(parsed.map((item) => item.signature))];
  if (signatures.length > 1) {
    const groups = {};
    parsed.forEach((item) => {
      if (!groups[item.signature]) groups[item.signature] = [];
      groups[item.signature].push(item.relativePath);
    });

    const details = Object.entries(groups)
      .map(([sig, paths]) => `Keys [${sig.split('|').join(', ')}]: ${paths.join(', ')}`)
      .join(' | ');

    return {
      ok: false,
      message: `Files do not share the same format. ${details}`,
      columns: [],
      files: parsed.map((item) => ({
        ...item,
        status: 'mismatch',
        error: 'Schema differs from other files',
      })),
    };
  }

  return {
    ok: true,
    message: `Validated ${parsed.length} file(s) with matching columns`,
    columns: parsed[0].columns,
    files: parsed,
  };
}

export function mergeValidatedFolderFiles(files) {
  const data = [];
  files.forEach((file) => {
    if (Array.isArray(file.data)) {
      data.push(...file.data);
    }
  });

  if (!data.length) {
    throw new Error('No rows found after merging files');
  }

  const columns = files[0]?.columns || Object.keys(data[0] || {});
  return { data, columns };
}
