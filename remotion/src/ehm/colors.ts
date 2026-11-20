/**
 * Huisstijl Ehm Club. Bron: de design system "Ehm Club" (brand/tokens.json in de repo).
 * Elke post krijgt één vlak, bepaald door de pijler van de situatie.
 */
export const C = {
  ink: '#1F2A44',
  card: '#FFFFFF',
  paper: '#FFFAF3',
  peach: '#F4B393',
  cheek: '#EE7B6B',
  noInk: '#A33127',
  noSoft: '#FFE1DA',
  yesInk: '#166B4D',
  yesSoft: '#D3F3E6',
  muted: '#4A5368',
  star: '#FFD23F', // = zon, zodat Ehm's sterretje en de glinsters dezelfde gele zijn
  zon: '#FFD23F', // het enige accent: glinsters, de swipe-pil en de oproep-pil
  drop: '#9CC9F5',
  ice: '#CDEBFA',
  white: '#FFFFFF',
  // oude namen, zodat de rig niet hoeft te veranderen
  navy: '#1F2A44',
  cream: '#FFFAF3',
} as const;

export type Pillar = 'small_talk' | 'grenzen' | 'werk' | 'daten_vriendschap' | 'ongemak';

/** Het vlak per pijler (field-* in de huisstijl). */
export const FIELD: Record<Pillar, string> = {
  small_talk: '#B8D3FF',
  grenzen: '#FFDF73',
  werk: '#D3C2FF',
  daten_vriendschap: '#FFC2D1',
  ongemak: '#CBEB8C',
};

/** Diepere toon van hetzelfde vlak: alleen voor vormen en de markering achter een kernwoord, nooit voor tekst. */
export const FIELD_DEEP: Record<Pillar, string> = {
  small_talk: '#8DB6FF',
  grenzen: '#FFC531',
  werk: '#B49CFF',
  daten_vriendschap: '#FF97B0',
  ongemak: '#A9D957',
};
export const INK_DEEP = '#2C3B5E';

/**
 * Glinster in zon. Op field-butter valt zon weg in het vlak, daar is de glinster card (wit).
 * Op ink is hij altijd zon.
 */
export const glinsterFill = (pillar: Pillar, onInk = false) => (onInk || pillar !== 'grenzen' ? C.zon : C.card);

/** Stickerstijl: rand en harde schaduw in ink, op een canvas van 1080 breed. */
export const STICKER = {
  border: `4px solid ${C.ink}`,
  shadow: `6px 6px 0 ${C.ink}`,
  radiusCard: 32,
  radiusBubble: 48,
};
