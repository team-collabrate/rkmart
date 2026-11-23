// Logins are a mobile number and a 4-digit PIN. The PIN is checked on the server (the sign-in
// function), which also locks a number after too many wrong tries.

export function isPin(value: string): boolean {
  return /^[0-9]{4}$/.test(value)
}
