// calculationEngine.js

/**
 * Sums a list of field codes from the fieldMap.
 * @param {string[]} codes - Array of field codes
 * @param {Object} fieldMap - Map of code -> value
 * @returns {number} Sum
 */
export function sumFields(codes, fieldMap) {
  return codes.reduce((sum, code) => sum + (parseFloat(fieldMap[code] || 0)), 0);
}

/**
 * Returns the maximum of two numbers.
 */
export function maxOf(a, b) {
  return Math.max(a, b);
}

/**
 * Returns the greater of two values from the fieldMap.
 */
export function greaterOf(code1, code2, fieldMap) {
  const val1 = parseFloat(fieldMap[code1] || 0);
  const val2 = parseFloat(fieldMap[code2] || 0);
  return Math.max(val1, val2);
}

/**
 * Computes ratio: (value / base) * 100.
 */
export function ratio(value, base) {
  if (base === 0) return 0;
  return (value / base) * 100;
}