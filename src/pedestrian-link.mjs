const labels = new Map([['ground', '지상 통로'], ['underpass', '지하 통로'], ['bridge', '육교']]);

export function pedestrianLinkInput(input) {
  const { type, width, plazaEdge, offset = 0 } = input;
  if (!labels.has(type) || !Number.isFinite(width) || width <= 0 || !Number.isInteger(plazaEdge)
    || plazaEdge < 1 || !Number.isFinite(offset) || offset < 0 || (type === 'underpass' && offset === 0)) {
    throw new RangeError('보행 연결시설의 형식, 폭, 광장 경계 번호와 표고 오프셋을 확인하세요.');
  }
  return { type, width, plazaEdge, offset: type === 'ground' ? 0 : offset };
}

function ringEdges(ring) {
  const points = ring.slice();
  if (points[0].x === points.at(-1).x && points[0].y === points.at(-1).y) points.pop();
  return points.map((point, index) => [point, points[(index + 1) % points.length]]);
}

function opening(edge, anchor, width, left) {
  const [a, b] = edge;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const projection = dx * left.x + dy * left.y;
  if (Math.abs(projection) < width) throw new RangeError('보행 연결시설의 폭이 접속 경계에 들어가지 않습니다.');
  const along = ((anchor.x - a.x) * dx + (anchor.y - a.y) * dy) / (dx * dx + dy * dy);
  const half = width / (2 * projection);
  if (along - Math.abs(half) < -1e-9 || along + Math.abs(half) > 1 + 1e-9) {
    throw new RangeError('보행 연결시설의 폭이 접속 경계에 들어가지 않습니다.');
  }
  return [half, -half].map((factor) => ({ x: anchor.x + dx * factor, y: anchor.y + dy * factor }));
}

export function buildPedestrianLink(civil, input, plaza, building, station, ground) {
  if (input == null) return undefined;
  if (!building) throw new RangeError('보행 연결시설은 역사 본체를 배치한 뒤 검토할 수 있습니다.');
  const link = pedestrianLinkInput(input);
  const plazaEdges = ringEdges(plaza);
  const entry = plazaEdges[link.plazaEdge - 1];
  if (!entry) throw new RangeError('보행 연결시설의 광장 경계 번호가 범위를 벗어났습니다.');
  const [a, b] = entry;
  const gate = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (civil.pointInPoly(gate.x, gate.y, building.footprint)) {
    throw new RangeError('광장 접속점과 역사 본체가 겹칩니다. 다른 광장 경계를 지정하세요.');
  }
  const toBuilding = [gate, { x: station.x, y: station.y }];
  const hits = ringEdges(building.footprint)
    .map((edge) => ({ edge, hit: civil.crossing(toBuilding, edge) }))
    .filter(({ hit }) => hit)
    .sort((first, second) => first.hit.da - second.hit.da);
  const hit = hits[0];
  if (!hit || hit.hit.da < 1e-6) throw new RangeError('광장과 역사 사이에 유효한 보행 연결 경로가 없습니다.');
  const door = { x: hit.hit.x, y: hit.hit.y };
  const length = hit.hit.da;
  const centerline = [gate, door];
  const left = { x: (gate.y - door.y) / length, y: (door.x - gate.x) / length };
  const [startLeft, startRight] = opening(entry, gate, link.width, left);
  const [endLeft, endRight] = opening(hit.edge, door, link.width, left);
  const footprint = [startLeft, startRight, endRight, endLeft];

  for (const path of [centerline, [startLeft, endLeft], [startRight, endRight]]) {
    const [start, end] = path;
    const probe = { x: start.x + (end.x - start.x) * 1e-5, y: start.y + (end.y - start.y) * 1e-5 };
    const crossesPlaza = plazaEdges.some((edge) => (civil.crossing(path, edge)?.da ?? 0) > 1e-6);
    if (civil.pointInPoly(probe.x, probe.y, plaza) || crossesPlaza) {
      throw new RangeError('보행 연결 경로가 광장을 가로지릅니다. 역사 쪽 광장 경계를 지정하세요.');
    }
  }

  let minGround;
  if (link.type === 'underpass') {
    const { runs } = civil.cutSection(ground, centerline);
    const coverage = runs[0];
    if (runs.length !== 1 || coverage[0].d > 1e-6 || coverage.at(-1).d < length - 1e-6) {
      throw new RangeError('지하 통로 경로 전체에 현황 지표면이 필요합니다.');
    }
    minGround = coverage.reduce((min, { z }) => Math.min(min, z), Infinity);
  }
  return { ...link, label: labels.get(link.type), centerline, footprint, length, minGround };
}

export function pedestrianLevels(link, plazaLevel, stationLevel) {
  let startLevel = plazaLevel;
  let endLevel = stationLevel;
  if (link.type === 'bridge') startLevel = endLevel = Math.max(plazaLevel, stationLevel) + link.offset;
  if (link.type === 'underpass') {
    startLevel = endLevel = Math.min(plazaLevel, stationLevel, link.minGround) - link.offset;
  }
  return {
    startLevel, endLevel,
    gradePercent: (endLevel - startLevel) / link.length * 100,
    plazaLevelDifference: startLevel - plazaLevel,
    stationLevelDifference: endLevel - stationLevel,
  };
}
