// Caribbean-first list for a Saint-Martin customer base, then common
// international codes. Several entries share the same NANP "+1" dial code
// (Sint Maarten, Puerto Rico, etc.) — that's expected and correct, each is
// still a distinct, useful pick for a customer typing their own number.
export const COUNTRY_CODES = [
  { iso: "MF", flag: "🇲🇫", name: "Saint-Martin (FR)", dialCode: "+590" },
  { iso: "SX", flag: "🇸🇽", name: "Sint Maarten (NL)", dialCode: "+1" },
  { iso: "GP", flag: "🇬🇵", name: "Guadeloupe", dialCode: "+590" },
  { iso: "MQ", flag: "🇲🇶", name: "Martinique", dialCode: "+596" },
  { iso: "GF", flag: "🇬🇫", name: "Guyane", dialCode: "+594" },
  { iso: "FR", flag: "🇫🇷", name: "France", dialCode: "+33" },
  { iso: "US", flag: "🇺🇸", name: "États-Unis", dialCode: "+1" },
  { iso: "CA", flag: "🇨🇦", name: "Canada", dialCode: "+1" },
  { iso: "PR", flag: "🇵🇷", name: "Porto Rico", dialCode: "+1" },
  { iso: "DO", flag: "🇩🇴", name: "République dominicaine", dialCode: "+1" },
  { iso: "VG", flag: "🇻🇬", name: "Îles Vierges britanniques", dialCode: "+1" },
  { iso: "VI", flag: "🇻🇮", name: "Îles Vierges américaines", dialCode: "+1" },
  { iso: "AG", flag: "🇦🇬", name: "Antigua-et-Barbuda", dialCode: "+1" },
  { iso: "BB", flag: "🇧🇧", name: "Barbade", dialCode: "+1" },
  { iso: "TT", flag: "🇹🇹", name: "Trinité-et-Tobago", dialCode: "+1" },
  { iso: "GB", flag: "🇬🇧", name: "Royaume-Uni", dialCode: "+44" },
  { iso: "BE", flag: "🇧🇪", name: "Belgique", dialCode: "+32" },
  { iso: "NL", flag: "🇳🇱", name: "Pays-Bas", dialCode: "+31" },
];

export const DEFAULT_COUNTRY_ISO = "MF";
