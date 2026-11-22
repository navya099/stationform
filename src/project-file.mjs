import { readFile } from 'node:fs/promises';
import { writeLocalFile } from './local-files.mjs';

const FORMAT = 'stationform';
const VERSION = 1;

function named(name) {
  return typeof name === 'string' && name.trim().length > 0;
}

export function reportNotes(report = { intent: '', rationale: '' }) {
  if (typeof report?.intent !== 'string' || typeof report?.rationale !== 'string') {
    throw new Error('설계 의도와 대안 채택 사유는 텍스트여야 합니다.');
  }
  const { intent, rationale } = report;
  return intent || rationale ? { intent, rationale } : undefined;
}

function validate(project) {
  if (!project || project.format !== FORMAT) throw new Error('StationForm 프로젝트 파일이 아닙니다.');
  if (project.version !== VERSION) throw new Error('이 프로젝트 파일 버전은 지원하지 않습니다.');
  const { source, settings, selected } = project;
  if (!named(source?.name) || typeof source.content !== 'string' || !source.content.trim()) {
    throw new Error('프로젝트에 LandXML 원본이 없습니다.');
  }
  const options = settings?.options;
  if (!named(settings?.name) || !Number.isFinite(options?.station) || !Array.isArray(options.alternatives)
    || !options.alternatives.length
    || !options.alternatives.every((alternative) => named(alternative?.name) && Number.isFinite(alternative.plazaLevel))
    || !Number.isInteger(selected) || selected < 0 || selected >= options.alternatives.length) {
    throw new Error('프로젝트의 측점, 대안 또는 광장 계획고가 유효하지 않습니다.');
  }
  const report = reportNotes(project.report);
  return { source, settings, selected, ...(report && { report }) };
}

export async function readProjectFile(path) {
  const content = await readFile(path, 'utf8');
  return validate(JSON.parse(content.replace(/^\uFEFF/, '')));
}

export async function writeProjectFile(path, { source, settings, selected, report }) {
  const project = validate({ format: FORMAT, version: VERSION, source, settings, selected, report });
  await writeLocalFile(path, JSON.stringify({ format: FORMAT, version: VERSION, ...project }, null, 2) + '\n');
}
