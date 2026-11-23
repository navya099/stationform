import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadCivilCraft(checkout) {
  const app = resolve(checkout, 'app');
  const appUrl = pathToFileURL(app + '/').href;
  const dependencies = new Map(
    ['delaunator', 'robust-predicates'].map((name) => [name, import.meta.resolve(name)]),
  );
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      const url = dependencies.get(specifier);
      if (url && context.parentURL?.startsWith(appUrl)) return { url, shortCircuit: true };
      const result = nextResolve(specifier, context);
      if (result.url.startsWith(appUrl) && result.url.endsWith('.js')) {
        return { ...result, format: 'module' };
      }
      return result;
    },
  });

  try {
    const load = (file) => import(new URL(file, appUrl).href);
    const { readLandXml } = await load('landxml.js');
    const { buildAlignment } = await load('alignment.js');
    const { buildProfile } = await load('profile.js');
    const { buildSurface, surfaceFromFaces } = await load('tin.js');
    const { gradedSurface, gridVolume } = await load('grading.js');
    const { cutSection } = await load('terrain-section.js');
    const { writeDxf } = await load('dxf.js');
    const { writeCivilIfc } = await load('ifc-civil.js');
    return { readLandXml, buildAlignment, buildProfile, buildSurface, surfaceFromFaces, gradedSurface, gridVolume, cutSection, writeDxf, writeCivilIfc };
  } finally {
    hook.deregister();
  }
}
