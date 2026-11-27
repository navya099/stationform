import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const civilCraftModules = {
  'landxml.js': ['readLandXml'],
  'alignment.js': ['buildAlignment'],
  'profile.js': ['buildProfile'],
  'tin.js': ['buildSurface', 'surfaceFromFaces', 'pointInPoly'],
  'grading.js': ['gradedSurface', 'gridVolume'],
  'terrain-section.js': ['cutSection', 'crossing'],
  'dxf.js': ['writeDxf'],
  'ifc-civil.js': ['writeCivilIfc'],
};

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
    const engine = {};
    for (const [file, names] of Object.entries(civilCraftModules)) {
      const module = await import(new URL(file, appUrl).href);
      for (const name of names) engine[name] = module[name];
    }
    return engine;
  } finally {
    hook.deregister();
  }
}
