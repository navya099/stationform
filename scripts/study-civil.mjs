import { readFile } from 'node:fs/promises';
import { loadCivilCraft } from '../src/civilcraft.mjs';
import { studySite } from '../src/site-study.mjs';

const [checkout, landXmlPath, optionsPath] = process.argv.slice(2);

try {
  if (!checkout || !landXmlPath || !optionsPath) {
    throw new Error('사용법: npm run study:civil -- <CivilCraft 경로> <LandXML 파일> <설계 조건 JSON>');
  }
  const [civil, xml, options] = await Promise.all([
    loadCivilCraft(checkout),
    readFile(landXmlPath, 'utf8'),
    readFile(optionsPath, 'utf8'),
  ]);
  console.log(JSON.stringify(studySite(civil, xml, JSON.parse(options)), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
