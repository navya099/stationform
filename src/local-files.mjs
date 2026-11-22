import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function writeLocalFile(path, data) {
  // Stage on the same filesystem so a failed write leaves the previous file in place.
  const directory = await mkdtemp(join(dirname(path), '.stationform-'));
  try {
    const staged = join(directory, 'output');
    await writeFile(staged, data);
    await rename(staged, path);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}
