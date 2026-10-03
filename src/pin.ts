// Firebase Auth has no native "PIN" sign-in, so a member's username and PIN are
// mapped onto an email/password account that nobody ever sees:
//   username "dave", PIN "1234"  ->  dave@members.griffcredits.local / griff-pin:1234
// The prefix also satisfies Firebase's 6-character minimum password length.

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

const EMAIL_DOMAIN = "members.griffcredits.local";
const PASSWORD_PREFIX = "griff-pin:";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_.-]{2,32}$/.test(username);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
}

export function pinToPassword(pin: string): string {
  return `${PASSWORD_PREFIX}${pin}`;
}
