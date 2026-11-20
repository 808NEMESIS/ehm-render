/**
 * Invoer voor de templates. In productie komt dit uit Supabase (posts.content) via inputProps;
 * de standaardwaarden hieronder zijn situatie 1 uit content/situaties.py, als voorbeeld.
 */
import type {Pillar} from '../ehm/colors';

export type Locale = 'nl' | 'en';
export type Platform = 'instagram' | 'tiktok' | 'youtube';

export type PostInput = {
  locale: Locale;
  platform: Platform;
  /** pijler van de situatie; bepaalt het vlak */
  pillar: Pillar;
  handle: string;
  /** de situatie, als hook */
  title: string;
  /** het kernwoord of de kernwoorden uit de hook die een markering krijgen (letterlijk deel van title) */
  highlight?: string;
  /** de zin die je niet moet zeggen */
  notThis: string;
  /** drie zinnen die wel werken, met hun rol (Openen, Doorvragen, Afsluiten, ...) */
  scripts: {role: string; text: string}[];
  /** korte afloop na de goede zin (video) */
  after: string;
  /**
   * De oproep op de slotslide. 'link' (standaard): de gratis download via de link in je bio of de beschrijving.
   * 'comment': reageer EHM en krijg een DM; alleen op Instagram, en pas als de eigen DM-route draait.
   * 'book': het boek, met de omslag op de slotslide (lanceringsposts). Niet op TikTok: daar noemen we alleen iets gratis.
   */
  cta?: 'link' | 'comment' | 'book';
  /** welke van de drie zinnen de video toont (0, 1 of 2); bij grenzen is dat de nee (1). Standaard 0. */
  hero?: number;
  /**
   * Chatvideo: hetzelfde gesprek twee keer. Eerst zoals het vastloopt (met "niet dit"), dan met de zinnen die werken.
   * Wat jij zegt, komt altijd uit het script: {who: 'you', not: true} is notThis, {who: 'you', line: n} is scripts[n].
   * Alleen wat de ander zegt, is eigen tekst. De database controleert dat (chat_invalid).
   */
  chat?: {bad: ChatMsg[]; good: ChatMsg[]};
};

export type ChatMsg = {who: 'them'; text: string} | {who: 'you'; not: true} | {who: 'you'; line: number};

/** De tekst van een bericht: van de ander, of de zin uit het script. */
export function chatText(p: PostInput, m: ChatMsg): string {
  if (m.who === 'them') return m.text;
  if ('not' in m) return p.notThis;
  return (p.scripts[m.line] ?? p.scripts[0]).text;
}

export const voorbeeld: PostInput = {
  locale: 'nl',
  platform: 'instagram',
  pillar: 'small_talk',
  handle: '@ehmclub.nl',
  title: 'Je zit op een verjaardag naast iemand die je niet kent',
  highlight: 'die je niet kent',
  notThis: 'Dus... ehm... leuk feestje?',
  scripts: [
    {role: 'Openen', text: 'Hoe ken jij de jarige?'},
    {role: 'Doorvragen', text: 'O, leuk! Hoe lang kennen jullie elkaar al?'},
    {role: 'Afsluiten', text: 'Fijn je gesproken te hebben, ik haal even wat te drinken. Jij ook iets?'},
  ],
  after: 'En de ander vertelt verder.',
  chat: {
    bad: [
      {who: 'you', not: true},
      {who: 'them', text: 'Ja, gezellig.'},
    ],
    good: [
      {who: 'you', line: 0},
      {who: 'them', text: 'Van de volleybal! We spelen al tien jaar samen.'},
      {who: 'you', line: 1},
      {who: 'them', text: 'Sinds de studie. Ze was toen al de enige die kon serveren.'},
    ],
  },
};

/** Vaste teksten per taal. De oproep verschilt per platform: op TikTok alleen iets gratis. */
export const COPY = {
  nl: {
    whatToSay: 'Wat zeg je dan?',
    howItGoes: 'Zo loopt het vast',
    howItCanGo: 'Zo kan het ook',
    swipe: 'Swipe',
    notThis: 'Niet dit',
    butThis: 'Wel dit',
    ctaTitle: 'Wil je er meer?',
    ctaMark: {instagram: 'Gratis', tiktok: 'Gratis', youtube: 'Gratis'},
    cta: {
      instagram: 'Gratis: 10 zinnen voor als je dichtklapt. Link in bio.',
      tiktok: 'Gratis: 10 zinnen voor als je dichtklapt. Link in bio.',
      youtube: 'Gratis: 10 zinnen voor als je dichtklapt. Link in de beschrijving.',
    },
    ctaCommentMark: 'EHM',
    ctaComment: 'Reageer EHM en je krijgt 10 zinnen voor als je dichtklapt. Gratis.',
    bookTitle: 'Nieuw: het boek',
    bookMark: 'Wat zeg je als…',
    book: {
      instagram: 'Wat zeg je als… 30 situaties en de zinnen die werken. Link in bio.',
      tiktok: 'Wat zeg je als… 30 situaties en de zinnen die werken. Link in bio.',
      youtube: 'Wat zeg je als… 30 situaties en de zinnen die werken. Link in de beschrijving.',
    },
  },
  en: {
    whatToSay: 'So what do you say?',
    howItGoes: 'How it usually goes',
    howItCanGo: 'How it can go',
    swipe: 'Swipe',
    notThis: 'Not this',
    butThis: 'Try this',
    ctaTitle: 'Want more?',
    ctaMark: {instagram: 'Free', tiktok: 'Free', youtube: 'Free'},
    cta: {
      instagram: 'Free: 10 lines for when your mind goes blank. Link in bio.',
      tiktok: 'Free: 10 lines for when your mind goes blank. Link in bio.',
      youtube: 'Free: 10 lines for when your mind goes blank. Link in the description.',
    },
    ctaCommentMark: 'EHM',
    ctaComment: 'Comment EHM and get 10 lines for when your mind goes blank. Free.',
    bookTitle: 'New: the book',
    bookMark: 'What do you say when…',
    book: {
      instagram: 'What do you say when… 30 situations and the lines that work. Link in bio.',
      tiktok: 'What do you say when… 30 situations and the lines that work. Link in bio.',
      youtube: 'What do you say when… 30 situations and the lines that work. Link in the description.',
    },
  },
} as const;

/** De titel boven de oproep: bij het boek de aankondiging, anders "Wil je er meer?". */
export function ctaTitleFor(p: PostInput): string {
  const t = COPY[p.locale];
  return p.cta === 'book' ? t.bookTitle : t.ctaTitle;
}

/** De oproep voor deze post: de tekst en het woord dat een markering krijgt. */
export function ctaFor(p: PostInput): {text: string; mark: string} {
  const t = COPY[p.locale];
  if (p.cta === 'book') return {text: t.book[p.platform], mark: t.bookMark};
  if (p.cta === 'comment' && p.platform === 'instagram') return {text: t.ctaComment, mark: t.ctaCommentMark};
  return {text: t.cta[p.platform], mark: t.ctaMark[p.platform]};
}
