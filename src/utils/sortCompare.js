const NUMERIC_STRING = /^-?\d+(\.\d+)?$/;

function isNullish(value) {
  return value === null || value === undefined || value === '';
}

function asNumericString(value) {
  const str = String(value).trim();
  if (!NUMERIC_STRING.test(str)) return null;
  return Number(str);
}

/**
 * Compare two cell values for table sorting (numbers, numeric strings, then natural text).
 */
export function compareValues(aVal, bVal, direction = 'asc') {
  const mult = direction === 'asc' ? 1 : -1;

  if (isNullish(aVal) && isNullish(bVal)) return 0;
  if (isNullish(aVal)) return 1 * mult;
  if (isNullish(bVal)) return -1 * mult;

  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return (aVal - bVal) * mult;
  }

  const aNum = typeof aVal === 'number' ? aVal : asNumericString(aVal);
  const bNum = typeof bVal === 'number' ? bVal : asNumericString(bVal);

  if (aNum !== null && bNum !== null) {
    return (aNum - bNum) * mult;
  }

  return (
    String(aVal).localeCompare(String(bVal), undefined, {
      numeric: true,
      sensitivity: 'base',
    }) * mult
  );
}
