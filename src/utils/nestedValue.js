const MAX_NEST_DEPTH = 5;

export function getValueType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return typeof value;
}

export function detectColumnValueType(data, column) {
  const counts = {};
  data.forEach((row) => {
    const type = getValueType(row?.[column]);
    counts[type] = (counts[type] || 0) + 1;
  });

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return { primary: 'empty', counts: {} };
  }
  return { primary: ranked[0][0], counts };
}

export function formatValuePreview(value, maxLen = 48) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    const text = JSON.stringify(value);
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  } catch {
    return String(value);
  }
}

export function resolveByPath(value, path = []) {
  if (!path || path.length === 0) {
    return value;
  }

  let current = value;
  for (let i = 0; i < path.length; i++) {
    if (current === null || current === undefined) {
      return undefined;
    }

    const segment = path[i];

    if (segment === '*') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      const rest = path.slice(i + 1);
      const mapped = current
        .map((item) => resolveByPath(item, rest))
        .filter((item) => item !== null && item !== undefined && item !== '');
      return mapped
        .map((item) =>
          typeof item === 'object' ? formatValuePreview(item, 80) : String(item)
        )
        .join(', ');
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (typeof current === 'object') {
      current = current[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

export function formatResolvedValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    return formatValuePreview(value, 80);
  }
  return String(value);
}

/**
 * Walk a path for browsing UI. `*` means "use first array item as template"
 * so users can keep drilling into object keys after choosing All items.
 */
export function getBrowseNode(sampleValue, path = []) {
  let current = sampleValue;
  let mapped = false;

  for (let i = 0; i < path.length; i++) {
    if (current === null || current === undefined) {
      return { type: 'empty', value: undefined, mapped };
    }

    const segment = path[i];
    if (segment === '*') {
      if (!Array.isArray(current)) {
        return { type: 'empty', value: undefined, mapped };
      }
      mapped = true;
      current = current.find((item) => item !== null && item !== undefined);
      continue;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) {
        return { type: 'empty', value: undefined, mapped };
      }
      current = current[index];
      continue;
    }

    if (typeof current === 'object') {
      current = current[segment];
      continue;
    }

    return { type: getValueType(current), value: current, mapped };
  }

  return {
    type: getValueType(current),
    value: current,
    mapped,
  };
}

export function getKeysAtPath(sampleValue, path = []) {
  const node = getBrowseNode(sampleValue, path);
  const current = node.value;

  if (current === null || current === undefined) {
    return { type: 'empty', options: [], mapped: node.mapped };
  }

  const type = node.type;

  if (type === 'object') {
    return {
      type,
      mapped: node.mapped,
      options: Object.keys(current).map((key) => ({
        segment: key,
        label: key,
        childType: getValueType(current[key]),
        preview: formatValuePreview(current[key]),
      })),
    };
  }

  if (type === 'array') {
    const options = [
      {
        segment: '*',
        label: 'All items (join)',
        childType: current.length ? getValueType(current[0]) : 'empty',
        preview: `${current.length} item(s)`,
      },
    ];

    const maxIndexes = Math.min(current.length, 10);
    for (let i = 0; i < maxIndexes; i++) {
      options.push({
        segment: String(i),
        label: `[${i}]`,
        childType: getValueType(current[i]),
        preview: formatValuePreview(current[i]),
      });
    }

    return { type, options, length: current.length, mapped: node.mapped };
  }

  return {
    type,
    mapped: node.mapped,
    options: [],
    preview: formatValuePreview(current),
  };
}

export function findSampleValue(data, column, path = []) {
  for (const row of data) {
    const root = row?.[column];
    if (root === null || root === undefined) continue;
    if (!path.length) return root;
    const resolved = resolveByPath(root, path);
    if (resolved !== null && resolved !== undefined) {
      return root;
    }
  }
  for (const row of data) {
    if (row?.[column] !== undefined) return row[column];
  }
  return undefined;
}

export function pathToLabel(column, path = []) {
  if (!path.length) return column;
  return `${column}.${path.join('.')}`;
}

export function canGoDeeper(path = []) {
  return path.length < MAX_NEST_DEPTH;
}

export { MAX_NEST_DEPTH };
