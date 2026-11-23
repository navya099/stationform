const dimensions = {
  length: '길이',
  width: '폭',
  height: '높이',
};

const templates = new Map([
  ['over-track', { label: '선상역사', key: 'floorAboveRail', offsetLabel: '레일면 대비 바닥 높이' }],
  ['under-track', { label: '선하역사', key: 'roofBelowRail', offsetLabel: '레일면에서 지붕까지 깊이' }],
  ['elevated', { label: '고가역사 하부', key: 'floorAboveGround', offsetLabel: '현황 지표면 대비 바닥 높이' }],
]);

export function stationBuildingInput(building) {
  const type = building?.type ?? 'over-track';
  const template = templates.get(type);
  if (!template) throw new RangeError('지원하지 않는 역사 형식입니다.');
  const size = Object.fromEntries(Object.entries(dimensions).map(([key, label]) => {
    const value = building?.[key];
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${template.label} ${label}은(는) 양수여야 합니다.`);
    return [key, value];
  }));
  const offset = building?.[template.key];
  if (!Number.isFinite(offset) || offset < 0 || (type !== 'elevated' && offset === 0)) {
    const requirement = type === 'elevated' ? '0 이상' : '양수';
    throw new RangeError(`${template.label} ${template.offsetLabel}은(는) ${requirement}이어야 합니다.`);
  }
  return { type, ...size, [template.key]: offset };
}

export function buildStationMass(building, reference, railLevel, station, range, section, groundLevel) {
  if (building == null) return undefined;
  const input = stationBuildingInput(building);
  const { type, length, width, height } = input;
  const start = station - length / 2;
  const end = station + length / 2;
  if (start < range.start || end > range.end) {
    throw new RangeError('역사 본체가 선형과 계획 종단의 공통 측점 범위를 벗어났습니다.');
  }

  const halfWidth = width / 2;
  const alongX = Math.cos(reference.dir);
  const alongY = Math.sin(reference.dir);
  const corners = [[-length / 2, -halfWidth], [-length / 2, halfWidth],
    [length / 2, halfWidth], [length / 2, -halfWidth]];
  const footprint = corners.map(([along, offset]) => ({
    x: reference.x + alongX * along + alongY * offset,
    y: reference.y + alongY * along - alongX * offset,
  }));
  let floorLevel;
  let roofLevel;
  if (type === 'under-track') {
    roofLevel = railLevel - input.roofBelowRail;
    floorLevel = roofLevel - height;
  } else if (type === 'elevated') {
    if (!Number.isFinite(groundLevel)) throw new RangeError('고가역사 기준 측점에 현황 지표면이 없습니다.');
    floorLevel = groundLevel + input.floorAboveGround;
    roofLevel = floorLevel + height;
    if (roofLevel >= railLevel) {
      throw new RangeError('고가역사 하부 매스의 지붕 표고는 기준 레일면보다 낮아야 합니다.');
    }
  } else {
    floorLevel = railLevel + input.floorAboveRail;
    roofLevel = floorLevel + height;
  }
  const footprintArea = length * width;
  const volume = footprintArea * height;
  if (![roofLevel, footprintArea, volume].every(Number.isFinite) || roofLevel <= floorLevel) {
    throw new RangeError('역사 본체의 치수와 표고를 확인하세요.');
  }
  const left = Math.max(-halfWidth, -section.left);
  const right = Math.min(halfWidth, section.right);

  return {
    ...input,
    label: templates.get(type).label,
    start, end, floorLevel, roofLevel, footprintArea, volume, footprint,
    section: [
      { o: left, z: floorLevel }, { o: right, z: floorLevel },
      { o: right, z: roofLevel }, { o: left, z: roofLevel },
    ],
  };
}
