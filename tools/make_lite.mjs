// Phone version of the car: same nodes/materials, fewer triangles.
// Painted panels (where reflections show every wobble) are simplified gently, hidden/dark parts hard.
// usage (Node 18+): npm i @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0
//   node tools/make_lite.mjs car.glb car_lite.glb   (then base64 it into car_c8v3_lite.js as window.CAR_GLB_B64)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, weld, simplifyPrimitive, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const [, , inp, out] = process.argv;
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
const tris = () => doc.getRoot().listMeshes().reduce((t, m) => t + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);
console.log('before tris', tris());
await doc.transform(dequantize(), weld());

const GENTLE = /^(carpaint)$/;                                  // body panels: keep reflections clean
const KEEP = /^(glass_red_Illum|drlseg|tailbar|ledBlue|glass_lens)$/;  // lamp LEDs stay as is
const LOOSE = /^(reflect|reflectB|glass_red)$/;                 // lamp reflectors/lens: many tiny open pieces, borders may move
const HARD = /^(interior|leather|plastic_int|tire|plasticblack|plasticBB|carnon|black|material|grey|metal)/;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName() || '';
    if (KEEP.test(name)) continue;
    const opt = GENTLE.test(name) ? { ratio: 0.55, error: 0.0003 }
      : LOOSE.test(name) ? { ratio: 0.3, error: 0.001, lockBorder: false }
      : HARD.test(name) ? { ratio: 0.15, error: 0.004 }
      : { ratio: 0.3, error: 0.0015 };
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, lockBorder: true, ...opt });
  }
}
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
console.log('after tris', tris());
await io.write(out, doc);
