const dimensions = {
  length: '길이',
  width: '폭',
  height: '높이',
  floorAboveRail: '레일면 대비 바닥 높이',
};

export function stationBuildingInput(building) {
  return Object.fromEntries(Object.entries(dimensions).map(([key, label]) => {
    const value = building?.[key];
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`선상역사 ${label}은(는) 양수여야 합니다.`);
    return [key, value];
  }));
}

export function buildStationMass(building, reference, railLevel, station, range, section) {
  if (building == null) return undefined;
  const { length, width, height, floorAboveRail } = stationBuildingInput(building);
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
  const floorLevel = railLevel + floorAboveRail;
  const roofLevel = floorLevel + height;
  const footprintArea = length * width;
  const volume = footprintArea * height;
  if (![roofLevel, footprintArea, volume].every(Number.isFinite) || roofLevel <= floorLevel) {
    throw new RangeError('역사 본체의 치수와 표고를 확인하세요.');
  }
  const left = Math.max(-halfWidth, -section.left);
  const right = Math.min(halfWidth, section.right);

  return {
    type: 'over-track',
    length, width, height, floorAboveRail,
    start, end, floorLevel, roofLevel, footprintArea, volume, footprint,
    section: [
      { o: left, z: floorLevel }, { o: right, z: floorLevel },
      { o: right, z: roofLevel }, { o: left, z: roofLevel },
    ],
  };
}
