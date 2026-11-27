import { buildStationMass } from './station-mass.mjs';
import { buildAccessRoad, gradeAccessRoad } from './access-road.mjs';

function select(items, index, label) {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new RangeError(`${label} 인덱스가 범위를 벗어났습니다.`);
  }
  return items[index];
}

function requirePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label}은(는) 양수여야 합니다.`);
}

function offsetPoint(reference, offset) {
  return {
    x: reference.x + Math.sin(reference.dir) * offset,
    y: reference.y - Math.cos(reference.dir) * offset,
  };
}
export function studySite(civil, xml, options) {
  return calculateSiteStudy(civil, xml, options).study;
}

export function calculateSiteStudy(civil, xml, options) {
  const { trackIndex, profileIndex, surfaceIndex, station, platform, section, plaza, alternatives, volumeCell } = options;
  const project = civil.readLandXml(xml);
  if (project.units !== 'm') throw new Error('미터 단위 LandXML이 필요합니다.');

  const track = select(project.alignments, trackIndex, '선형');
  const profileInput = select(track.profiles, profileIndex, '종단');
  const terrain = select(project.surfaces, surfaceIndex, '현황 지표면');
  const alignment = civil.buildAlignment(track);
  const profile = civil.buildProfile(profileInput.pvis);
  const { surface: ground } = civil.surfaceFromFaces(terrain);
  if (!alignment.ok || !profile.ok || !ground) {
    throw new Error('유효한 선형, 계획 종단 및 TIN 면 정보가 필요합니다.');
  }

  requirePositive(platform.width, '승강장 폭');
  requirePositive(section.left, '횡단면 좌측 폭');
  requirePositive(section.right, '횡단면 우측 폭');
  requirePositive(plaza.cutSlope, '절토 사면비');
  requirePositive(plaza.fillSlope, '성토 사면비');
  requirePositive(volumeCell, '토공 격자 크기');
  if (![platform.start, platform.end, station, platform.edgeOffset, platform.heightAboveRail].every(Number.isFinite)
    || platform.start >= platform.end || station < platform.start || station > platform.end
    || platform.edgeOffset === 0) {
    throw new RangeError('승강장 측점 구간, 연단 오프셋 및 높이를 확인하세요.');
  }
  const range = { start: Math.max(alignment.start, profile.start), end: Math.min(alignment.end, profile.end) };
  if (platform.start < range.start || platform.end > range.end) {
    throw new RangeError('승강장이 선형과 계획 종단의 공통 측점 범위를 벗어났습니다.');
  }
  if (!Array.isArray(plaza.boundary) || plaza.boundary.length < 3
    || !plaza.boundary.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))) {
    throw new RangeError('광장 경계에는 유효한 평면 좌표가 3개 이상 필요합니다.');
  }
  if (plaza.boundary.some(({ x, y }) => ground.elevationAt(x, y, 1e-7) === null)) {
    throw new RangeError('광장 경계에 현황 지표면 범위 밖의 꼭짓점이 있습니다.');
  }
  if (!Array.isArray(alternatives) || !alternatives.length
    || !alternatives.every(({ name, plazaLevel }) => typeof name === 'string' && name.trim() && Number.isFinite(plazaLevel))
    || new Set(alternatives.map(({ name }) => name)).size !== alternatives.length) {
    throw new Error('대안마다 고유한 이름과 유효한 광장 계획고를 지정하세요.');
  }

  const reference = alignment.pointAt(station);
  const railLevel = profile.elevationAt(station);
  const { x, y } = reference;
  const stationBuilding = buildStationMass(
    options.stationBuilding, reference, railLevel, station, range, section, ground.elevationAt(x, y),
  );
  const accessRoad = buildAccessRoad(civil, options.accessRoad, plaza.boundary, ground);
  const line = [offsetPoint(reference, -section.left), { x, y }, offsetPoint(reference, section.right)];
  const cutSection = (surface) => civil.cutSection(surface, line, { origin: section.left }).runs;
  const groundSection = cutSection(ground);
  if (!groundSection.length) throw new Error('지정 횡단면이 현황 지표면과 만나지 않습니다.');
  const outerOffset = platform.edgeOffset + Math.sign(platform.edgeOffset) * platform.width;
  const segmentCount = Math.min(200, Math.ceil((platform.end - platform.start) / 5));
  const planPoints = Array.from({ length: segmentCount + 1 }, (_, index) => {
    const distance = platform.start + (platform.end - platform.start) * index / segmentCount;
    const height = profile.elevationAt(distance) + platform.heightAboveRail;
    const point = alignment.pointAt(distance);
    return {
      point,
      near: { ...offsetPoint(point, platform.edgeOffset), z: height },
      far: { ...offsetPoint(point, outerOffset), z: height },
    };
  });
  const xy = ({ x, y }) => ({ x, y });
  const proposedSurfaces = [];

  const study = {
    units: { length: 'm', area: 'm²', volume: 'm³' },
    track: { name: track.name, profile: profileInput.name },
    station: { value: station, x, y, railLevel },
    ...(stationBuilding && { stationBuilding }),
    ...(accessRoad && { accessRoad }),
    plan: {
      track: planPoints.map(({ point }) => xy(point)),
      platform: [
        ...planPoints.map(({ near }) => xy(near)),
        ...planPoints.map(({ far }) => xy(far)).reverse(),
      ],
      plaza: plaza.boundary,
    },
    platform: {
      ...platform,
      section: {
        edgeOffset: platform.edgeOffset,
        outerOffset,
        level: railLevel + platform.heightAboveRail,
      },
    },
    section: { line, ground: groundSection },
    alternatives: alternatives.map(({ name, plazaLevel }) => {
      const pad = { name, pts: plaza.boundary, z: plazaLevel, cut: plaza.cutSlope, fill: plaza.fillSlope };
      const { surface, regions, report, items } = civil.gradedSurface(
        ground, terrain.pts, terrain.breaklines, [pad], civil.buildSurface,
      );
      if (!surface || report.errors.length || items[0].rays.some(({ kind }) => kind === 'off')) {
        throw new Error(`${name} 대안의 광장 사면을 현황 지표면에 연결하지 못했습니다. ${JSON.stringify(report)}`);
      }
      const earthwork = civil.gridVolume(ground, surface, { cell: volumeCell, region: regions[0] });
      if (!earthwork.cells) throw new Error(`${name} 대안에서 토공량을 산정할 격자가 없습니다.`);
      proposedSurfaces.push(surface);
      return {
        name, plazaLevel, earthwork, gradingBoundary: regions[0], plannedSection: cutSection(surface),
        ...(accessRoad && { accessRoad: gradeAccessRoad(accessRoad, plazaLevel) }),
      };
    }),
  };
  return { study, proposedSurfaces, platformDeck: planPoints, sourceCrs: project.coordinateSystem };
}
