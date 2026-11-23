/**
 * Turns rows into CSV text that opens correctly in Excel and Google Sheets, Tamil included
 * (a byte-order mark at the start tells Excel it is UTF-8).
 * A text cell that starts with = + - @ gets a tab in front, so a name typed by a user can never run
 * as a spreadsheet formula.
 */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (value: string | number): string => {
    let text = String(value)
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = '\t' + text
    return /[",\n\r\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
