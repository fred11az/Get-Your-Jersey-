import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { PrintZone } from './types';

/**
 * Mises en situation : le visuel personnalisé composé sur le dos d'un mannequin
 * humain photographié, plutôt que sur un maillot à plat.
 *
 * Une scène est un dossier `public/scenes/<id>/` contenant `photo.jpg` et
 * `metadata.json`. Aucune scène n'est requise : quand le dossier est vide, le
 * builder ne propose pas l'option et retombe sur le mockup à plat. Déposer un
 * dossier suffit à activer la fonctionnalité, sans modification de code.
 *
 * La zone d'impression d'une scène est un QUADRILATÈRE et non un rectangle : le
 * dos d'une personne réelle n'est jamais parfaitement de face ni parfaitement
 * plan. Les quatre coins permettent de suivre l'inclinaison des épaules.
 */
export type SceneGender = 'man' | 'woman';

export interface ScenePoint {
  x: number;
  y: number;
}

/**
 * Une image de la séquence animée : le fichier et la position du dos dessus.
 * `visible: false` marque les images où le dos n'est plus face à l'objectif
 * (mannequin de profil) — le visuel y est masqué au lieu de glisser hors du dos.
 */
export interface SceneFrame {
  file: string;
  quad: [ScenePoint, ScenePoint, ScenePoint, ScenePoint];
  visible?: boolean;
}

export interface SceneSequence {
  /** Cadence de lecture. 24 suffit pour une marche fluide. */
  fps: number;
  frames: SceneFrame[];
}

export interface SceneMetadata {
  id: string;
  label: string;
  gender: SceneGender;
  photo: { width: number; height: number };
  /**
   * Séquence animée optionnelle (marche, rotation, mouvements de bras). Absente,
   * la scène reste une image fixe. La composition des images est faite dans le
   * NAVIGATEUR, en canvas : composer 48 images côté serveur coûterait une
   * quinzaine de secondes par aperçu et serait refait à chaque changement de
   * configuration. Côté client, les images sont téléchargées une fois et le
   * visuel est superposé à 24 i/s pour un coût serveur nul.
   */
  sequence?: SceneSequence;
  /**
   * Les quatre coins de la zone de flocage sur le dos du mannequin, en pixels de
   * la photo, dans l'ordre : haut-gauche, haut-droit, bas-droit, bas-gauche.
   */
  quad: [ScenePoint, ScenePoint, ScenePoint, ScenePoint];
  /**
   * Kit porté sur la photo. `null` = maillot neutre, la scène sert alors pour
   * tous les kits (le rendu est indicatif, la couleur du maillot ne suit pas la
   * sélection du client).
   */
  kitSlug: string | null;
  /** Opacité du visuel, pour laisser passer le grain du tissu. */
  blendOpacity?: number;
  /**
   * Nom du fichier de masque du vêtement dans le dossier de la scène. Sa
   * présence active le remplacement de tissu : le mannequin porte alors le kit
   * choisi par le client. Généré par scripts/build-garment-masks.ts.
   */
  garmentMask?: string;
}

const SCENES_DIR = path.join(process.cwd(), 'public', 'scenes');

let cache: SceneMetadata[] | null = null;

export function sceneDir(id: string): string {
  return path.join(SCENES_DIR, id);
}

export async function loadScenes(): Promise<SceneMetadata[]> {
  if (cache) return cache;

  let entries: string[];
  try {
    entries = (await readdir(SCENES_DIR, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    // Dossier absent : la fonctionnalité est simplement inactive.
    cache = [];
    return cache;
  }

  const scenes: SceneMetadata[] = [];
  for (const id of entries) {
    try {
      const raw = await readFile(path.join(SCENES_DIR, id, 'metadata.json'), 'utf8');
      const meta = JSON.parse(raw) as SceneMetadata;
      if (!meta.quad || meta.quad.length !== 4) {
        console.warn(`[scenes] ${id} ignorée : quad absent ou incomplet`);
        continue;
      }
      scenes.push({ ...meta, id });
    } catch (error) {
      console.warn(`[scenes] ${id} ignorée :`, error);
    }
  }

  cache = scenes.sort((a, b) => a.label.localeCompare(b.label));
  return cache;
}

/** Scènes utilisables pour un kit : celles du kit, plus les scènes neutres. */
export async function scenesForKit(kitSlug: string): Promise<SceneMetadata[]> {
  const scenes = await loadScenes();
  return scenes.filter((scene) => scene.kitSlug === null || scene.kitSlug === kitSlug);
}

export async function getScene(id: string): Promise<SceneMetadata | undefined> {
  return (await loadScenes()).find((scene) => scene.id === id);
}

/** Données de lecture transmises au client pour animer la scène. */
export interface ScenePlayback {
  id: string;
  photoUrl: string;
  width: number;
  height: number;
  fps: number;
  frames: { url: string; quad: SceneMetadata['quad']; visible: boolean }[];
}

export function scenePlayback(scene: SceneMetadata): ScenePlayback | null {
  if (!scene.sequence || scene.sequence.frames.length === 0) return null;

  return {
    id: scene.id,
    photoUrl: `/scenes/${scene.id}/photo.jpg`,
    width: scene.photo.width,
    height: scene.photo.height,
    fps: scene.sequence.fps,
    frames: scene.sequence.frames.map((frame) => ({
      url: `/scenes/${scene.id}/${frame.file}`,
      quad: frame.quad,
      visible: frame.visible !== false,
    })),
  };
}

/**
 * Boîte englobante du quadrilatère, avec la rotation moyenne du bord supérieur.
 *
 * Sharp ne sait pas appliquer de transformation perspective : on approche le
 * quad par une rotation + une mise à l'échelle, ce qui suffit tant que le
 * mannequin est photographié à peu près de face. Une vraie homographie
 * demanderait un remap pixel par pixel en `raw()`.
 */
export function quadPlacement(quad: SceneMetadata['quad']): {
  left: number;
  top: number;
  width: number;
  height: number;
  rotationDeg: number;
} {
  const [tl, tr, br, bl] = quad;

  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const left = Math.round(Math.min(...xs));
  const top = Math.round(Math.min(...ys));

  const topWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const bottomWidth = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftHeight = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightHeight = Math.hypot(br.x - tr.x, br.y - tr.y);

  return {
    left,
    top,
    width: Math.round((topWidth + bottomWidth) / 2),
    height: Math.round((leftHeight + rightHeight) / 2),
    rotationDeg: (Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI,
  };
}

/** Zone d'impression équivalente, pour réutiliser le pipeline existant. */
export function scenePrintZone(scene: SceneMetadata, physical: PrintZone): PrintZone {
  const placement = quadPlacement(scene.quad);
  return {
    x: placement.left,
    y: placement.top,
    width: placement.width,
    height: placement.height,
    // La taille physique imprimée ne dépend pas de la mise en situation : elle
    // reste celle de la finition commandée.
    width_mm: physical.width_mm,
    height_mm: physical.height_mm,
  };
}
