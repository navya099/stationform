export function accessRoadInput({ x, y, width, plazaEdge, maxGradePercent } = {}) {
  if (![x, y, width, maxGradePercent].every(Number.isFinite) || width <= 0 || maxGradePercent <= 0
    || !Number.isInteger(plazaEdge) || plazaEdge < 1) {
    throw new RangeError('진입로 접속 좌표, 폭, 광장 경계 번호와 검토 경사를 확인하세요.');
  }
  return { x, y, width, plazaEdge, maxGradePercent };
}

function openRing(boundary) {
  const ring = boundary.slice();
  if (ring.length > 1 && ring[0].x === ring.at(-1).x && ring[0].y === ring.at(-1).y) ring.pop();
  return ring;
}

export function buildAccessRoad(civil, input, boundary, ground) {
  if (input == null) return undefined;
  const road = accessRoadInput(input);
  const ring = openRing(boundary);
  if (road.plazaEdge > ring.length) throw new RangeError('진입로 광장 경계 번호가 범위를 벗어났습니다.');
  const a = ring[road.plazaEdge - 1];
  const b = ring[road.plazaEdge % ring.length];
  const connection = { x: road.x, y: road.y };
  const gate = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const edgeLength = Math.hypot(edge.x, edge.y);
  const length = Math.hypot(gate.x - road.x, gate.y - road.y);
  if (!Number.isFinite(length) || length < 1e-6 || edgeLength < 1e-6
    || civil.pointInPoly(road.x, road.y, ring)) {
    throw new RangeError('진입로 접속점은 광장 밖에, 접속할 경계는 유효하게 지정하세요.');
  }
  const centerline = [connection, gate];
  const closedRing = [...ring, ring[0]];
  const crosses = civil.crossing(centerline, closedRing);
  if (!crosses || crosses.da < length - 1e-6) {
    throw new RangeError('진입로는 지정한 광장 경계부터 맞닿아야 합니다.');
  }
  const connectionLevel = ground.elevationAt(road.x, road.y, 1e-7);
  if (!Number.isFinite(connectionLevel)) throw new RangeError('도로 접속점의 현황 지표면 표고가 없습니다.');

  const left = { x: (road.y - gate.y) / length, y: (gate.x - road.x) / length };
  const projection = left.x * edge.x + left.y * edge.y;
  if (Math.abs(projection) < road.width) throw new RangeError('지정한 광장 경계에 진입로 폭이 들어가지 않습니다.');
  const offset = (point, direction, distance) => ({ x: point.x + direction.x * distance, y: point.y + direction.y * distance });
  const footprint = [
    offset(connection, left, road.width / 2),
    offset(connection, left, -road.width / 2),
    offset(gate, edge, -road.width / (2 * projection)),
    offset(gate, edge, road.width / (2 * projection)),
  ];
  for (const [start, end] of [[footprint[0], footprint[3]], [footprint[1], footprint[2]]]) {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const crossing = civil.crossing([start, end], closedRing);
    if (civil.pointInPoly(start.x, start.y, ring) || (crossing && crossing.da < distance - 1e-6)) {
      throw new RangeError('진입로 폭이 지정 접속부 밖에서 광장 경계와 겹칩니다.');
    }
  }
  return { ...road, centerline, footprint, length, connectionLevel };
}

export function gradeAccessRoad(road, plazaLevel) {
  const gradePercent = (plazaLevel - road.connectionLevel) / road.length * 100;
  return {
    gradePercent,
    exceedsLimit: Math.abs(gradePercent) > road.maxGradePercent + 1e-9,
  };
}

export function accessRoadSurface(road, plazaLevel) {
  const points = [...road.footprint, ...road.centerline].map((point, index) => ({
    ...point, z: index < 2 || index === 4 ? road.connectionLevel : plazaLevel,
  }));
  return { points, indices: [0, 4, 5, 0, 5, 3, 4, 1, 2, 4, 2, 5] };
}

export function joinAccessRoad(road, plazaBoundary, plazaLevel) {
  const ring = openRing(plazaBoundary);
  const { points } = accessRoadSurface(road, plazaLevel);
  const [startLeft, startRight, gateRight, gateLeft, startCenter, gateCenter] = points;
  const a = ring[road.plazaEdge - 1];
  const b = ring[road.plazaEdge % ring.length];
  const alongEdge = (gateRight.x - gateLeft.x) * (b.x - a.x) + (gateRight.y - gateLeft.y) * (b.y - a.y);
  const path = [gateLeft, startLeft, startRight, gateRight];
  if (alongEdge < 0) path.reverse();

  const vertices = [
    ...ring.slice(0, road.plazaEdge).map((point) => ({ ...point, z: plazaLevel })),
    ...path,
    ...ring.slice(road.plazaEdge).map((point) => ({ ...point, z: plazaLevel })),
  ];
  const boundary = vertices.filter((point, index) => {
    const previous = vertices.at(index - 1);
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-6;
  });
  const breaklines = [
    { name: '광장 접속부', pts: [gateLeft, gateCenter, gateRight] },
    { name: '기존 도로 접속부', pts: [startLeft, startCenter, startRight] },
    { name: '진입로 중심선', pts: [startCenter, gateCenter] },
    { name: '진입로 삼각망 좌측', pts: [startLeft, gateCenter] },
    { name: '진입로 삼각망 우측', pts: [startCenter, gateRight] },
  ];
  return { boundary, breaklines };
}
