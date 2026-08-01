import sharp from 'sharp';

/**
 * Repérage du visage sur une photo client, par teinte de peau.
 *
 * Pourquoi c'est nécessaire : le visuel découpe les photos par la silhouette du
 * chiffre. Un « 1 » ne laisse voir qu'une bande verticale étroite, et un chiffre
 * à deux caractères en laisse voir deux, plus étroites encore. Si la photo est
 * simplement recadrée en son centre, ce qui apparaît dans le chiffre est le plus
 * souvent le mur, le plafond ou une épaule — le visage tombe à côté. C'est
 * exactement ce que produisait `position: 'attention'` de Sharp, dont
 * l'heuristique (entropie, saturation) désigne volontiers une fenêtre lumineuse
 * ou un meuble contrasté plutôt qu'un visage.
 *
 * Ce n'est pas de la reconnaissance faciale : rien n'identifie personne, aucun
 * modèle n'est chargé, aucune donnée ne sort. On cherche seulement la plus
 * grande zone de peau pour savoir où recadrer.
 */

/**
 * Signature de peau en RVB, calibrée pour rester valable sur les peaux foncées.
 *
 * La règle classique impose `r > 95`, ce qui écarte une peau foncée en lumière
 * d'intérieur (mesuré autour de 90 sur les photos qui ont motivé ce code). Le
 * seuil est donc abaissé, et c'est la TEINTE qui fait le tri : la peau est
 * toujours plus rouge que verte, et plus verte que bleue.
 */
function isSkin(r: number, g: number, b: number): boolean {
  return r > 60 && g > 30 && b > 15 && r > g && g >= b && r - g > 10 && r - b > 18;
}

export interface FaceBox {
  /** Centre du visage, en fraction de la largeur et de la hauteur de la photo. */
  cx: number;
  cy: number;
  /** Hauteur du visage, en fraction de la hauteur de la photo. */
  height: number;
}

/**
 * Plus grande composante connexe de peau, ramenée à sa partie haute.
 *
 * La composante englobe le visage ET le cou, souvent le décolleté et parfois un
 * bras : son centre tomberait sur la poitrine. On ne garde donc que le haut, de
 * hauteur au plus 1,25 fois la largeur — les proportions d'une tête.
 */
export async function detectFace(photo: Buffer): Promise<FaceBox | null> {
  const SAMPLE = 160;
  let raster;
  try {
    raster = await sharp(photo)
      .rotate() // l'orientation EXIF d'abord : sinon le visage est cherché couché
      .resize(SAMPLE, null, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }

  const { data, info } = raster;
  const { width, height, channels } = info;
  if (width === 0 || height === 0) return null;

  const skin = new Uint8Array(width * height);
  let total = 0;
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    if (!isSkin(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0)) continue;
    skin[i] = 1;
    total++;
  }

  // Moins de 2 % de peau : photo sans personne (paysage, objet, écusson).
  if (total < width * height * 0.02) return null;

  // Plus grande composante connexe, par pile explicite — la récursion
  // déborderait sur une grande zone de peau.
  let best: { left: number; top: number; right: number; bottom: number; size: number } | null =
    null;
  const seen = new Uint8Array(width * height);

  for (let start = 0; start < skin.length; start++) {
    if (!skin[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let size = 0;
    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;

    while (stack.length) {
      const i = stack.pop() as number;
      const x = i % width;
      const y = (i - x) / width;
      size++;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;

      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || !skin[n] || seen[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }

    if (!best || size > best.size) best = { left, top, right, bottom, size };
  }

  if (!best || best.size < width * height * 0.015) return null;

  const boxWidth = best.right - best.left + 1;
  const boxHeight = best.bottom - best.top + 1;
  const headHeight = Math.min(boxHeight, boxWidth * 1.25);

  return {
    cx: (best.left + boxWidth / 2) / width,
    cy: (best.top + headHeight / 2) / height,
    height: headHeight / height,
  };
}
