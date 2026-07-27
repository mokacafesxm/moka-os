'use strict';

/**
 * Generic, source-agnostic validation helpers: monetary amount parsing,
 * date parsing, and the opening/closing balance identity. Parser-specific
 * business rules (category-total checks, ticket-count checks) stay out of
 * this file — those land with the POS/monthly-performance parsers (PR3).
 *
 * Amounts are parsed to integer cents (never floating point) precisely
 * because AGENTS.md requires "des décimaux fiables pour les montants" —
 * we deliberately did not add a decimal library since it wasn't in the
 * validated dependency list; integer-cents arithmetic gets the same
 * guarantee without a new dependency.
 */

/**
 * @typedef {Object} ParsedAmount
 * @property {boolean} ok
 * @property {number} [amountCents]
 * @property {boolean} [negative]
 * @property {string} [reason] - present when ok is false
 */

/**
 * Parses a monetary amount string into integer cents. Handles French
 * (1 234,56) and US (1,234.56) grouping/decimal conventions, parentheses
 * and leading-minus negatives, and €/$ symbols. Returns `{ ok: false }`
 * rather than guessing when the separators are genuinely ambiguous.
 * @param {string} raw
 * @returns {ParsedAmount}
 */
function parseAmount(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'not_a_string' };
  let s = raw.trim();
  if (s === '') return { ok: false, reason: 'empty' };

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.slice(1).trim();
  }
  if (/^\+/.test(s)) {
    s = s.slice(1).trim(); // explicit positive sign, no-op beyond stripping it
  }

  s = s.replace(/[€$]/g, '').replace(/[\s ]/g, '').trim();
  if (s === '') return { ok: false, reason: 'empty_after_strip' };

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let normalized;

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    normalized =
      lastComma > lastDot
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = parts.join('.'); // decimal comma, e.g. "12,34"
    } else if (parts.length > 2 || parts[1].length === 3) {
      normalized = s.replace(/,/g, ''); // thousands grouping, e.g. "1,234"
    } else {
      return { ok: false, reason: 'ambiguous_comma_separator' };
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = s; // decimal dot, e.g. "12.34"
    } else if (parts.length > 2 || parts[1].length === 3) {
      normalized = s.replace(/\./g, ''); // thousands grouping, e.g. "1.234"
    } else {
      return { ok: false, reason: 'ambiguous_dot_separator' };
    }
  } else {
    normalized = s;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, reason: 'unparseable' };
  }

  const [intPart, decPart = '0'] = normalized.split('.');
  const decCents = (decPart + '00').slice(0, 2);
  const amountCents = Number(intPart) * 100 + Number(decCents);

  return { ok: true, amountCents: negative ? -amountCents : amountCents, negative };
}

/**
 * Detects a currency hint (EUR/USD) from a raw amount string. Returns null
 * rather than guessing when no symbol or ISO code is present — currency
 * must never be assumed per AGENTS.md ("gérer EUR et USD sans conversion
 * automatique").
 * @param {string} raw
 * @returns {'EUR'|'USD'|null}
 */
function detectCurrencyHint(raw) {
  if (typeof raw !== 'string') return null;
  if (raw.includes('€')) return 'EUR';
  if (raw.includes('$')) return 'USD';
  if (/\bEUR\b/i.test(raw)) return 'EUR';
  if (/\bUSD\b/i.test(raw)) return 'USD';
  return null;
}

/**
 * @typedef {Object} ParsedDate
 * @property {boolean} ok
 * @property {string} [iso] - YYYY-MM-DD
 * @property {Date} [date]
 * @property {boolean} [ambiguous] - true when day/month order was guessed
 * @property {string} [reason] - present when ok is false
 */

/**
 * Builds the final ParsedDate result and checks the calendar date is real
 * (rejects e.g. 2024-02-30).
 * @param {string} y
 * @param {string} mo
 * @param {string} d
 * @param {boolean} ambiguous
 * @returns {ParsedDate}
 */
function finalizeDate(y, mo, d, ambiguous) {
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  const isRealCalendarDate =
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() + 1 === Number(mo) &&
    date.getUTCDate() === Number(d);
  if (!isRealCalendarDate) {
    return { ok: false, reason: 'invalid_calendar_date' };
  }
  return { ok: true, iso, date, ambiguous };
}

/**
 * Parses a date string in ISO (YYYY-MM-DD) or slash/dash-separated
 * (DD/MM/YYYY or MM/DD/YYYY) form. When both day and month components are
 * <= 12, the order is genuinely ambiguous — it is resolved using
 * `assumeFormat` (default 'DMY', matching the project's French/EU locale)
 * but the result is flagged `ambiguous: true` so callers can warn rather
 * than silently trust it.
 * @param {string} raw
 * @param {{assumeFormat?: 'DMY'|'MDY'}} [options]
 * @returns {ParsedDate}
 */
function parseDate(raw, options = {}) {
  if (typeof raw !== 'string') return { ok: false, reason: 'not_a_string' };
  const s = raw.trim();
  const assumeFormat = options.assumeFormat === 'MDY' ? 'MDY' : 'DMY';

  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return finalizeDate(y, mo, d, false);
  }

  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) {
    const [, a, b, y] = m;
    const aNum = Number(a);
    const bNum = Number(b);
    let day;
    let month;
    let ambiguous = false;

    if (aNum > 12 && bNum <= 12) {
      day = aNum;
      month = bNum;
    } else if (bNum > 12 && aNum <= 12) {
      day = bNum;
      month = aNum;
    } else if (aNum <= 12 && bNum <= 12) {
      ambiguous = true;
      if (assumeFormat === 'DMY') {
        day = aNum;
        month = bNum;
      } else {
        day = bNum;
        month = aNum;
      }
    } else {
      return { ok: false, reason: 'invalid_date_components' };
    }

    return finalizeDate(y, String(month).padStart(2, '0'), String(day).padStart(2, '0'), ambiguous);
  }

  return { ok: false, reason: 'unrecognized_format' };
}

/**
 * @typedef {Object} BalanceEquationResult
 * @property {boolean} ok
 * @property {number} expectedClosingBalanceCents
 * @property {number} differenceCents - closing - expected; 0 when ok
 */

/**
 * Checks the universal accounting identity `opening + credits - debits =
 * closing`, in integer cents. Generic on purpose — reused as-is by the bank
 * statement parser (PR2A) and, later, by POS daily cash reconciliation
 * (PR3): never round or tolerate a difference, a mismatch must always
 * surface as TOTAL_MISMATCH rather than be silently absorbed.
 * @param {{openingBalanceCents: number, totalCreditsCents: number, totalDebitsCents: number, closingBalanceCents: number}} params
 * @returns {BalanceEquationResult}
 */
function checkBalanceEquation({
  openingBalanceCents,
  totalCreditsCents,
  totalDebitsCents,
  closingBalanceCents,
}) {
  const expectedClosingBalanceCents = openingBalanceCents + totalCreditsCents - totalDebitsCents;
  return {
    ok: expectedClosingBalanceCents === closingBalanceCents,
    expectedClosingBalanceCents,
    differenceCents: closingBalanceCents - expectedClosingBalanceCents,
  };
}

module.exports = { parseAmount, detectCurrencyHint, parseDate, checkBalanceEquation };
