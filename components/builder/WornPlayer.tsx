'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScenePlayback } from '@/lib/scenes';

/**
 * Lecteur de mise en situation animée.
 *
 * Le visuel personnalisé est superposé image par image sur une séquence
 * photographique du mannequin (marche, rotation, mouvements de bras), dans un
 * canvas, dans le NAVIGATEUR.
 *
 * Pourquoi côté client : composer une cinquantaine d'images côté serveur
 * prendrait une quinzaine de secondes par aperçu, à refaire au moindre
 * changement de configuration, et dépasserait le budget d'une fonction Vercel.
 * Ici, les images sont téléchargées une fois, mises en cache par le navigateur,
 * et la composition est refaite à chaque trame pour un coût serveur nul.
 *
 * Le placement suit le quadrilatère de chaque image, approché par une
 * translation, une rotation et une mise à l'échelle — ce que le canvas 2D sait
 * faire nativement. Une vraie homographie demanderait WebGL ; elle n'est utile
 * que si le dos est très incliné, cas où l'image est de toute façon marquée
 * `visible: false`.
 */
export function WornPlayer({
  playback,
  artworkUrl,
  className = '',
}: {
  playback: ScenePlayback;
  artworkUrl: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;

    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Image illisible : ${src}`));
        image.src = src;
      });

    (async () => {
      try {
        const [artwork, ...frames] = await Promise.all([
          load(artworkUrl),
          ...playback.frames.map((frame) => load(frame.url)),
        ]);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        canvas.width = playback.width;
        canvas.height = playback.height;
        setReady(true);

        const frameDuration = 1000 / playback.fps;
        let index = 0;
        let last = 0;

        const draw = (now: number) => {
          if (cancelled) return;

          if (playing && now - last >= frameDuration) {
            last = now;
            const frame = frames[index];
            const meta = playback.frames[index];

            if (frame && meta) {
              context.clearRect(0, 0, canvas.width, canvas.height);
              context.drawImage(frame, 0, 0, canvas.width, canvas.height);

              if (meta.visible) {
                const [tl, tr, br, bl] = meta.quad;
                const width = (Math.hypot(tr.x - tl.x, tr.y - tl.y) +
                  Math.hypot(br.x - bl.x, br.y - bl.y)) / 2;
                const height = (Math.hypot(bl.x - tl.x, bl.y - tl.y) +
                  Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;
                const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x);

                context.save();
                // On pivote autour du coin haut-gauche du quad : c'est lui qui
                // ancre le visuel sur le dos, quelle que soit l'inclinaison.
                context.translate(tl.x, tl.y);
                context.rotate(angle);
                // Léger fondu : laisse passer le grain du tissu sous le flocage.
                context.globalAlpha = 0.96;
                context.drawImage(artwork, 0, 0, width, height);
                context.restore();
              }
            }
            index = (index + 1) % frames.length;
          }
          animationFrame = requestAnimationFrame(draw);
        };

        animationFrame = requestAnimationFrame(draw);
      } catch (error) {
        console.error('[WornPlayer]', error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [playback, artworkUrl, playing]);

  if (failed) {
    // Repli silencieux sur l'image fixe : une animation qui ne charge pas ne
    // doit pas priver le client de son aperçu.
    return (
      // eslint-disable-next-line @next/next/no-img-element -- rendu dynamique
      <img src={playback.photoUrl} alt="" className={className} />
    );
  }

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={`h-full w-full object-contain ${ready ? '' : 'opacity-0'} ${className}`}
      />
      {!ready && (
        <span
          aria-hidden
          className="absolute inset-0 m-auto h-8 w-8 animate-spin self-center rounded-full border-2 border-hairline border-t-brand"
        />
      )}
      <button
        type="button"
        onClick={() => setPlaying((v) => !v)}
        className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/75"
      >
        {playing ? '❚❚' : '▶'}
      </button>
    </div>
  );
}
