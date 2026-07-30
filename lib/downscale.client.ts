/**
 * Réduction des photos AVANT envoi, dans le navigateur.
 *
 * Une fonction Vercel refuse tout corps de requête au-delà de 4,5 Mo, et le
 * rejet a lieu en amont de la fonction : le navigateur ne reçoit aucune réponse
 * exploitable, seulement un « Failed to fetch ». Trois photos de téléphone
 * modernes pèsent 15 à 25 Mo — le parcours était donc systématiquement bloqué à
 * l'étape 5 sur mobile.
 *
 * Réduire côté client résout trois choses d'un coup : on passe sous la limite,
 * l'envoi est bien plus rapide en 4G, et le serveur reçoit déjà la résolution
 * dont il a besoin. Le rendu vise 300 dpi sur une zone de 216 mm : 2550 px de
 * large suffisent largement, et 1800 px couvrent tous les usages réels puisque
 * chaque photo n'occupe qu'une bande du numéro.
 */

const MAX_EDGE = 1800;
const QUALITY = 0.85;
/** Marge de sécurité sous la limite Vercel, pour les en-têtes multipart. */
export const TOTAL_UPLOAD_BUDGET = 4 * 1024 * 1024;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    // `imageOrientation` applique l'EXIF : sans quoi une photo prise en mode
    // portrait arriverait couchée sur le maillot.
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('DECODE_FAILED'));
    image.src = URL.createObjectURL(file);
  });
}

/** Réduit une photo à `MAX_EDGE` sur son grand côté et la ré-encode en JPEG. */
export async function downscalePhoto(file: File, quality = QUALITY): Promise<File> {
  const source = await decode(file);
  const width = 'width' in source ? source.width : 0;
  const height = 'height' in source ? source.height : 0;
  if (!width || !height) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const target = { w: Math.round(width * scale), h: Math.round(height * scale) };

  const canvas = document.createElement('canvas');
  canvas.width = target.w;
  canvas.height = target.h;
  const context = canvas.getContext('2d');
  if (!context) return file;

  context.drawImage(source as CanvasImageSource, 0, 0, target.w, target.h);
  if ('close' in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) return file;

  // Si la réduction n'a rien gagné, on garde l'original : ré-encoder une petite
  // image ne ferait que dégrader sa qualité.
  if (blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

/**
 * Réduit un lot de photos et garantit que le total passe sous le budget, en
 * abaissant la qualité si nécessaire plutôt qu'en refusant l'envoi.
 */
export async function prepareUpload(files: File[]): Promise<File[]> {
  let prepared = await Promise.all(files.map((file) => downscalePhoto(file)));
  let total = prepared.reduce((sum, file) => sum + file.size, 0);

  for (const quality of [0.72, 0.6, 0.5]) {
    if (total <= TOTAL_UPLOAD_BUDGET) break;
    prepared = await Promise.all(files.map((file) => downscalePhoto(file, quality)));
    total = prepared.reduce((sum, file) => sum + file.size, 0);
  }

  return prepared;
}
