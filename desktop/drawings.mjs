const ns = 'http://www.w3.org/2000/svg';

function draw(svg, tag, attributes, label) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (label !== undefined) node.textContent = label;
  svg.append(node);
}

function polyline(svg, points, project, className, closed = false) {
  draw(svg, closed ? 'polygon' : 'polyline', {
    points: points.map(project).map(([x, y]) => `${x},${y}`).join(' '),
    class: `line ${className}`,
  });
}

export function drawPlan(svg, study, alternative) {
  svg.replaceChildren();
  const { track, platform, plaza } = study.plan;
  const { line } = study.section;
  let minX = line[0].x;
  let maxX = minX;
  let minY = line[0].y;
  let maxY = minY;
  const boundaries = study.alternatives.map(({ gradingBoundary }) => gradingBoundary);
  for (const path of [track, platform, plaza, line, ...boundaries]) {
    for (const { x, y } of path) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(628 / Math.max(width, 1), 215 / Math.max(height, 1));
  const project = ({ x, y }) => [
    340 + (x - minX - width / 2) * scale,
    135 - (y - minY - height / 2) * scale,
  ];
  polyline(svg, plaza, project, 'plaza', true);
  polyline(svg, alternative.gradingBoundary, project, 'grading', true);
  polyline(svg, platform, project, 'platform', true);
  polyline(svg, track, project, 'track');
  polyline(svg, line, project, 'cut');
  for (const end of [line[0], line.at(-1)]) {
    const [x, y] = project(end);
    draw(svg, 'text', { x: x + 7, y: y - 5 }, 'A');
  }
  const [cx, cy] = project(study.station);
  draw(svg, 'circle', { cx, cy, r: 4, class: 'mark' });
}

export function drawSection(svg, study, alternative) {
  svg.replaceChildren();
  const ground = study.section.ground;
  const planned = alternative.plannedSection;
  const platform = study.platform.section;
  const railLevel = study.station.railLevel;
  const platformEnds = [
    { o: platform.edgeOffset, z: platform.level },
    { o: platform.outerOffset, z: platform.level },
  ];
  let minO = 0;
  let maxO = 0;
  let minZ = railLevel;
  let maxZ = railLevel;
  const allPlanned = study.alternatives.flatMap(({ plannedSection }) => plannedSection);
  for (const run of [...ground, ...allPlanned, platformEnds]) {
    for (const { o, z } of run) {
      minO = Math.min(minO, o);
      maxO = Math.max(maxO, o);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  const verticalPad = Math.max((maxZ - minZ) * .13, .3);
  minZ -= verticalPad;
  maxZ += verticalPad;
  const project = ({ o, z }) => [
    70 + (o - minO) / Math.max(maxO - minO, 1) * 580,
    205 - (z - minZ) / (maxZ - minZ) * 175,
  ];
  for (let i = 0; i <= 4; i++) {
    const z = minZ + i / 4 * (maxZ - minZ);
    const [, y] = project({ o: 0, z });
    draw(svg, 'line', { x1: 70, x2: 650, y1: y, y2: y, class: 'grid' });
    draw(svg, 'text', { x: 62, y: y + 4, 'text-anchor': 'end' }, z.toFixed(1));
  }
  for (const run of ground) polyline(svg, run, project, 'surface');
  for (const run of planned) polyline(svg, run, project, 'planned');
  polyline(svg, platformEnds, project, 'platform-line');
  const [cx, cy] = project({ o: 0, z: railLevel });
  draw(svg, 'circle', { cx, cy, r: 4, class: 'mark' });
  draw(svg, 'text', { x: 70, y: 224 }, `${minO.toFixed(1)} m`);
  draw(svg, 'text', { x: cx, y: 224, 'text-anchor': 'middle' }, '선로 중심');
  draw(svg, 'text', { x: 650, y: 224, 'text-anchor': 'end' }, `+${maxO.toFixed(1)} m`);
}
