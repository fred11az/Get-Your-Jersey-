import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import type { PrintZone } from './types';

/**
 * Fabrication du PDF imprimeur.
 *
 * Sharp n'a PAS de sortie `.pdf()` : il ne produit que du raster. pdf-lib
 * assemble le document à partir d'un PNG rendu par Sharp. Deux contraintes :
 *
 *  - pdf-lib n'embarque que du PNG ou du JPEG, jamais du WebP ;
 *  - les 300 dpi ne se déclarent pas dans un PDF, ils résultent du rapport
 *    entre les pixels de l'image et la taille physique de la page. On rastérise
 *    en `mm → px @ 300 dpi` et on dessine en `mm → pt`.
 */

export const PRINT_DPI = 300;

export const mmToPt = (mm: number): number => (mm / 25.4) * 72;
export const mmToPx = (mm: number, dpi = PRINT_DPI): number => Math.round((mm / 25.4) * dpi);

const A4 = { widthMm: 210, heightMm: 297 };

export function pdfPageSizeMm(zone: PrintZone): { widthMm: number; heightMm: number } {
  return { widthMm: zone.width_mm, heightMm: zone.height_mm };
}

export interface BuildPrintPdfInput {
  /** Visuel isolé, fond transparent, produit par le pipeline de rendu. */
  artworkPng: Buffer;
  zone: PrintZone;
  /** Aperçu composé sur le maillot, en WebP : sert de page de contrôle. */
  mockup: Buffer;
  reference: string;
}

export async function buildPrintPdf({
  artworkPng,
  zone,
  mockup,
  reference,
}: BuildPrintPdfInput): Promise<Buffer> {
  // Rastérisation à la résolution d'impression exacte.
  const printPx = {
    width: mmToPx(zone.width_mm),
    height: mmToPx(zone.height_mm),
  };
  const artwork300 = await sharp(artworkPng)
    .resize(printPx.width, printPx.height, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const pdf = await PDFDocument.create();
  pdf.setTitle(`GetYourJersey ${reference}`);
  pdf.setSubject(
    `Visuel ${zone.width_mm}×${zone.height_mm} mm à ${PRINT_DPI} dpi — page 1 à imprimer`,
  );
  pdf.setProducer('GetYourJersey (Sharp + pdf-lib)');
  pdf.setCreationDate(new Date());

  // --- Page 1 : le visuel seul, à sa taille physique réelle. ---
  const art = await pdf.embedPng(artwork300);
  const pageWidth = mmToPt(zone.width_mm);
  const pageHeight = mmToPt(zone.height_mm);
  const printPage = pdf.addPage([pageWidth, pageHeight]);
  printPage.drawImage(art, { x: 0, y: 0, width: pageWidth, height: pageHeight });

  // --- Page 2 : mockup de contrôle pour l'atelier. ---
  // pdf-lib n'embarque pas le WebP : conversion en PNG obligatoire.
  const mockupPng = await sharp(mockup).png().toBuffer();
  const ref = await pdf.embedPng(mockupPng);
  const a4 = pdf.addPage([mmToPt(A4.widthMm), mmToPt(A4.heightMm)]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const margin = mmToPt(15);
  const captionHeight = mmToPt(18);
  const available = {
    width: a4.getWidth() - margin * 2,
    height: a4.getHeight() - margin * 2 - captionHeight,
  };
  const scale = Math.min(available.width / ref.width, available.height / ref.height);

  a4.drawImage(ref, {
    x: (a4.getWidth() - ref.width * scale) / 2,
    y: margin + captionHeight + (available.height - ref.height * scale) / 2,
    width: ref.width * scale,
    height: ref.height * scale,
  });

  const lines = [
    `Reference : ${reference}`,
    `Visuel a imprimer : page 1 — ${zone.width_mm} x ${zone.height_mm} mm @ ${PRINT_DPI} dpi`,
    'Cette page est un controle de placement, elle ne doit pas etre imprimee.',
  ];
  lines.forEach((line, index) => {
    a4.drawText(line, {
      x: margin,
      y: margin + captionHeight - 12 - index * 12,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  });

  return Buffer.from(await pdf.save());
}
