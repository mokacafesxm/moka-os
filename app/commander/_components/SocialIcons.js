// Minimal monochrome social icons (currentColor) — no emoji, matches project convention.
function Facebook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.4c0-.87.24-1.46 1.5-1.46h1.6V3.4C16.3 3.28 15.32 3 14.2 3 11.86 3 10.25 4.43 10.25 7.1v2.4H7.7v3h2.55V21h3.25Z" />
    </svg>
  );
}
function Instagram(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function YouTube(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.3 9.6v4.8l4.3-2.4-4.3-2.4Z" />
    </svg>
  );
}
function TikTok(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M14.5 3h2.2c.2 1.6 1.3 2.9 3.3 3.1v2.3c-1.2 0-2.4-.4-3.3-1v6.4a5 5 0 1 1-5-5c.2 0 .5 0 .7.05v2.3a2.7 2.7 0 1 0 2.1 2.65V3Z" />
    </svg>
  );
}
function Pinterest(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 3a9 9 0 0 0-3.3 17.4c-.05-.8-.1-2 .02-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.85 0 1.26.64 1.26 1.4 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.8 1.47 1.8 1.77 0 3-2.28 3-4.98 0-2.05-1.38-3.6-3.9-3.6-2.84 0-4.6 2.12-4.6 4.48 0 .82.24 1.4.62 1.84.17.2.2.29.14.53l-.2.75c-.06.24-.26.33-.48.24-1.33-.54-1.95-2-1.95-3.64 0-2.7 2.28-5.95 6.8-5.95 3.63 0 6.02 2.63 6.02 5.45 0 3.74-2.06 6.53-5.1 6.53-1.02 0-1.98-.55-2.3-1.17l-.65 2.55c-.2.78-.6 1.56-1 2.16A9 9 0 1 0 12 3Z" />
    </svg>
  );
}

export const SOCIAL_ICONS = [Facebook, Instagram, YouTube, TikTok, Pinterest];
