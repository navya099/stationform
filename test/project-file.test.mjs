import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readProjectFile, writeProjectFile } from '../src/project-file.mjs';

async function projectFixture(context) {
  const directory = await mkdtemp(join(tmpdir(), 'stationform-test-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const [content, settings] = await Promise.all([
    readFile(new URL('../fixtures/concept-station.xml', import.meta.url), 'utf8'),
    readFile(new URL('../fixtures/concept-study.json', import.meta.url), 'utf8'),
  ]);
  const options = JSON.parse(settings);
  options.station = 1055;
  options.alternatives[1].plazaLevel = 13;
  const project = {
    source: { name: '현황.xml', content },
    settings: { name: '설계 조건.json', options },
    selected: 1,
  };
  return { directory, project, path: join(directory, '역사.stationform') };
}

test('a moved project restores its embedded input and all edits', async (context) => {
  const { directory, project, path } = await projectFixture(context);
  await writeProjectFile(path, project);
  const moved = join(directory, '이동.stationform');
  await rename(path, moved);
  assert.deepEqual(await readProjectFile(moved), project);
  assert.deepEqual(await readdir(directory), ['이동.stationform']);
});

test('invalid updates preserve the saved snapshot and valid updates replace it', async (context) => {
  const { project, path } = await projectFixture(context);
  await writeProjectFile(path, project);
  await assert.rejects(writeProjectFile(path, { ...project, selected: 99 }), /유효하지 않습니다/);
  assert.deepEqual(await readProjectFile(path), project);
  project.settings.options.station = 1060;
  await writeProjectFile(path, project);
  assert.deepEqual(await readProjectFile(path), project);
});

test('unknown versions, foreign files and corrupt JSON are rejected', async (context) => {
  const { project, path } = await projectFixture(context);
  await writeFile(path, JSON.stringify({ format: 'stationform', version: 99, ...project }));
  await assert.rejects(readProjectFile(path), /지원하지 않습니다/);
  await writeFile(path, JSON.stringify({ format: 'other', ...project }));
  await assert.rejects(readProjectFile(path), /StationForm 프로젝트 파일이 아닙니다/);
  await writeFile(path, '{');
  await assert.rejects(readProjectFile(path), SyntaxError);
});
