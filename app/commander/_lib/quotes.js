// Canonical, hand-picked rotation — one quote per hour of the day, looping the
// next day. The ACTIVE quote is chosen server-side from the current hour (see
// app/api/quotes/route.js) so every device shows the same one and it only
// changes on the hour. No AI generation, no client-side random draw.
// Order matters: index === hour of day (0h..23h).
export const QUOTES = [
  { text: "Cela semble toujours impossible, jusqu'à ce qu'on le fasse.", author: "Nelson Mandela" },
  { text: "Restez affamés, restez fous.", author: "Steve Jobs" },
  { text: "Choisis un travail que tu aimes, tu n'auras plus à travailler.", author: "Confucius" },
  { text: "Si tu peux le rêver, tu peux le faire.", author: "Walt Disney" },
  { text: "La mode passe, le style reste.", author: "Coco Chanel" },
  { text: "J'ai raté encore et encore, c'est pour ça que je réussis.", author: "Michael Jordan" },
  { text: "Fais de petites choses avec un grand amour.", author: "Mère Teresa" },
  { text: "L'excellence n'est pas un acte, mais une habitude.", author: "Aristote" },
  { text: "Sois le changement que tu veux voir dans le monde.", author: "Gandhi" },
  { text: "Ce n'est pas parce que c'est difficile qu'on n'ose pas ; c'est parce qu'on n'ose pas que c'est difficile.", author: "Sénèque" },
  { text: "Les gens oublieront tes mots, jamais ce que tu leur as fait ressentir.", author: "Maya Angelou" },
  { text: "Le succès n'est pas un hasard : c'est du travail et de l'amour de ce qu'on fait.", author: "Pelé" },
  { text: "Que tu penses en être capable ou non, tu as raison.", author: "Henry Ford" },
  { text: "Un champion se relève, même quand il ne le peut plus.", author: "Serena Williams" },
  { text: "La plus belle aventure, c'est de vivre la vie de ses rêves.", author: "Oprah Winfrey" },
  { text: "La vie, c'est comme le vélo : pour garder l'équilibre, il faut avancer.", author: "Albert Einstein" },
  { text: "Rien n'est impossible : le mot lui-même dit « je suis possible ».", author: "Audrey Hepburn" },
  { text: "Le génie, c'est 1 % d'inspiration et 99 % de transpiration.", author: "Thomas Edison" },
  { text: "Les opportunités sont comme les bus : il y en a toujours un autre qui arrive.", author: "Richard Branson" },
  { text: "Tu rates 100 % des tirs que tu ne tentes pas.", author: "Wayne Gretzky" },
  { text: "Le bonheur ne vient pas tout fait : il naît de tes actions.", author: "Dalaï-Lama" },
  { text: "Fais de ta vie un rêve, et d'un rêve une réalité.", author: "Antoine de Saint-Exupéry" },
  { text: "Je ne pense pas aux limites.", author: "Usain Bolt" },
  { text: "Impossible n'est qu'un mot.", author: "Muhammad Ali" },
];

// Café is in Saint-Martin (UTC-4, no DST — same offset as America/Puerto_Rico),
// so the rotation lines up with the customer's local time of day, not UTC.
const TIMEZONE = "America/Puerto_Rico";

// Hour of day (0..23) in the café's timezone. Deterministic for a given
// instant, which is what makes the active quote identical for all users.
export function currentHourInCafeTz(now = new Date()) {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);
  return (Number.isFinite(hour) ? hour : 0) % 24;
}

export function quoteForHour(hour) {
  return QUOTES[((hour % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
