// Amount in words for the invoice, using the Indian system (thousand, lakh, crore).

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below100(n: number): string {
  if (n < 20) return ONES[n]
  const tens = TENS[Math.floor(n / 10)]
  const ones = ONES[n % 10]
  return ones ? `${tens}-${ones}` : tens
}

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) parts.push(below100(rest))
  return parts.join(' ')
}

function wholeToWords(n: number): string {
  if (n === 0) return 'Zero'
  const crore = Math.floor(n / 10_000_000)
  const lakh = Math.floor((n % 10_000_000) / 100_000)
  const thousand = Math.floor((n % 100_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (crore) parts.push(`${below1000(crore)} Crore`)
  if (lakh) parts.push(`${below100(lakh)} Lakh`)
  if (thousand) parts.push(`${below100(thousand)} Thousand`)
  if (rest) parts.push(below1000(rest))
  return parts.join(' ')
}

/** 14945 -> "Rupees Fourteen Thousand Nine Hundred Forty-Five Only" */
export function amountInWords(amount: number): string {
  const totalPaise = Math.round(amount * 100)
  const rupees = Math.floor(totalPaise / 100)
  const paise = totalPaise % 100
  const rupeePart = `Rupees ${wholeToWords(rupees)}`
  return paise ? `${rupeePart} and ${below100(paise)} Paise Only` : `${rupeePart} Only`
}
