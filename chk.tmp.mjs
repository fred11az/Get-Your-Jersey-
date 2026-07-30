import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const tiles = []; let x = 0;
for (const id of ['man','woman']) {
  const m = JSON.parse(readFileSync(`public/scenes/${id}/metadata.json`,'utf8'));
  const { width: W, height: H } = m.photo;
  const poly = m.quad.map(p=>`${p.x},${p.y}`).join(' ');
  // librsvg rend le SVG à sa propre échelle : on le matérialise à la taille exacte.
  const ov = await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polygon points="${poly}" fill="none" stroke="#FF9500" stroke-width="4"/></svg>`
  )).resize(W, H, { fit: 'fill' }).png().toBuffer();
  const img = await sharp(`public/scenes/${id}/photo.jpg`).composite([{input:ov,top:0,left:0}]).resize(300).jpeg({quality:90}).toBuffer();
  tiles.push({input:img,left:x,top:0}); x += (await sharp(img).metadata()).width + 8;
  const f = await sharp(`public/scenes/${id}/front.jpg`).resize(300).jpeg({quality:90}).toBuffer();
  tiles.push({input:f,left:x,top:0}); x += (await sharp(f).metadata()).width + 8;
}
await sharp({create:{width:x,height:570,channels:4,background:'#eef1f4'}}).composite(tiles).jpeg({quality:88}).toFile('/tmp/models.jpg');
console.log('ok');
