import { readFile } from 'node:fs/promises';
import path from 'node:path';
import opentype from 'opentype.js';

/**
 * Vectorisation du texte (nom et numéro) en chemins SVG.
 *
 * On ne s'appuie PAS sur les polices système : le runtime Vercel n'en embarque
 * quasiment aucune et librsvg rendrait silencieusement du vide. La police est
 * un asset du dépôt, converti en `path` par opentype.js. Le rendu est donc
 * identique en local, en CI et en production.
 *
 * Pour utiliser la police de flocage exacte d'un équipementier, déposer son
 * fichier dans public/fonts/ et changer FONT_FILE.
 */
const FONT_FILE = 'jersey-display.woff';

let fontPromise: Promise<opentype.Font> | null = null;

export function loadFont(): Promise<opentype.Font> {
  if (!fontPromise) {
    fontPromise = readFile(path.join(process.cwd(), 'public', 'fonts', FONT_FILE)).then((buf) =>
      opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
    );
  }
  return fontPromise;
}

export interface BoundedPath {
  /** Attribut `d` d'un <path> SVG. */
  d: string;
  /** Boîte englobante réelle des glyphes (pas la métrique de la police). */
  bbox: { x1: number; y1: number; x2: number; y2: number };
  width: number;
  height: number;
}

export class GlyphCoverageError extends Error {
  constructor(readonly missing: string[]) {
    super(`Caractères absents de la police de flocage : ${missing.join(', ')}`);
    this.name = 'GlyphCoverageError';
  }
}

/**
 * Une police sans le glyphe demandé rend un `.notdef` — un rectangle vide — au
 * lieu d'échouer. Un maillot partirait à l'impression avec des carrés à la
 * place du nom. On refuse explicitement plutôt que de laisser passer.
 */
export async function assertGlyphCoverage(text: string): Promise<void> {
  const font = await loadFont();
  const missing = [...new Set([...text])].filter(
    (char) => char !== ' ' && font.charToGlyphIndex(char) === 0,
  );
  if (missing.length > 0) throw new GlyphCoverageError(missing);
}

/**
 * Convertit un texte en chemin, à une taille arbitraire. La boîte englobante
 * retournée est celle de l'encre réelle : c'est elle qui sert au cadrage, pas
 * les métriques ascender/descender qui laisseraient des marges vides.
 */
export async function textToPath(text: string, fontSize = 1000): Promise<BoundedPath> {
  await assertGlyphCoverage(text);
  const font = await loadFont();
  const glyphPath = font.getPath(text, 0, 0, fontSize);
  const box = glyphPath.getBoundingBox();

  return {
    d: glyphPath.toPathData(3),
    bbox: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
    width: box.x2 - box.x1,
    height: box.y2 - box.y1,
  };
}

/**
 * Transformation SVG plaçant un chemin dans une boîte, en conservant le rapport
 * d'aspect. `padding` réserve la place des contours (bordure blanche + trait
 * rouge) qui débordent du glyphe.
 */
export function fitTransform(
  source: BoundedPath,
  box: { width: number; height: number },
  padding = 0,
): { transform: string; scale: number; renderedWidth: number; renderedHeight: number } {
  const available = {
    width: Math.max(1, box.width - padding * 2),
    height: Math.max(1, box.height - padding * 2),
  };
  const scale = Math.min(available.width / source.width, available.height / source.height);

  const renderedWidth = source.width * scale;
  const renderedHeight = source.height * scale;

  // Centrage : on annule d'abord l'origine de la bbox, puis on recentre.
  const offsetX = (box.width - renderedWidth) / 2 - source.bbox.x1 * scale;
  const offsetY = (box.height - renderedHeight) / 2 - source.bbox.y1 * scale;

  return {
    transform: `translate(${offsetX.toFixed(3)} ${offsetY.toFixed(3)}) scale(${scale.toFixed(6)})`,
    scale,
    renderedWidth,
    renderedHeight,
  };
}

/** Valide un numéro de maillot : 0 à 99 (section 5 de docs/SPEC.md). */
export function isValidJerseyNumber(value: string): boolean {
  return /^\d{1,2}$/.test(value);
}

/** Le flocage est en capitales : le rendu doit refléter l'impression réelle. */
export function normalizeJerseyName(value: string): string {
  return value.trim().toUpperCase().slice(0, 15);
}
