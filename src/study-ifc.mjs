import { accessRoadSurface } from './access-road.mjs';

function platformMesh(deck, side) {
  const positions = [];
  const indices = [];
  for (const [index, { near, far }] of deck.entries()) {
    const [left, right] = side > 0 ? [near, far] : [far, near];
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    if (index === 0) continue;
    const a = (index - 1) * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { kind: 'mesh', positions, indices };
}

export function writeStudyIfc(writeCivilIfc, calculation, selected, { name, revision }) {
  const { study, proposedSurfaces, platformDeck, sourceCrs } = calculation;
  const alternative = Number.isInteger(selected) ? study.alternatives[selected] : undefined;
  if (!alternative) throw new Error('내보낼 대안을 선택하세요.');
  const building = study.stationBuilding;
  const road = study.accessRoad;
  const link = study.pedestrianLink;
  const linkLevels = alternative.pedestrianLink;
  const linkElement = link ? [{
    tag: 'pedestrian-link',
    cls: 'IfcSlab',
    name: link.label,
    objectType: 'Concept pedestrian connection',
    body: {
      kind: 'mesh',
      positions: [...link.footprint, ...link.centerline].flatMap(({ x, y }, index) => [
        x, y, index < 2 || index === 4 ? linkLevels.startLevel : linkLevels.endLevel,
      ]),
      indices: [0, 4, 5, 0, 5, 3, 4, 1, 2, 4, 2, 5],
    },
  }] : [];
  const accessSurface = road && accessRoadSurface(road, alternative.plazaLevel);
  const roadElement = accessSurface ? [{
    tag: 'access-road',
    cls: 'IfcPavement',
    name: '진입로 개념 표면',
    objectType: 'Concept access road',
    body: {
      kind: 'mesh',
      positions: accessSurface.points.flatMap(({ x, y, z }) => [x, y, z]),
      indices: accessSurface.indices,
    },
  }] : [];
  const model = {
    name,
    units: 'm',
    alignments: [],
    corridors: [],
    surfaces: [{ key: 'fg', name: '계획 지표면', ...proposedSurfaces[selected].toFaces() }],
    pads: [],
    parcels: [],
    landscape: [{
      tag: 'station-platform',
      cls: 'IfcSlab',
      name: '승강장 개념 표면',
      objectType: 'Concept platform deck',
      body: platformMesh(platformDeck, study.platform.edgeOffset),
    }, ...roadElement, ...linkElement],
    masses: building ? [{
      id: 'station-building',
      name: building.label,
      use: 'Railway station concept mass',
      pts: building.footprint,
      floors: 1,
      floorHeight: building.height,
      z0: building.floorLevel,
    }] : [],
  };

  return writeCivilIfc(model, {
    schema: 'IFC4X3_ADD2',
    // Keep numeric project coordinates even when LandXML supplies no projected CRS.
    origin: { x: 0, y: 0, z: 0 },
    seed: `StationForm|${revision}|${selected}`,
    projectPsets: [['StationForm_Study', [
      ['CalculationId', revision, 'label'],
      ['Alternative', alternative.name, 'label'],
      ['Track', study.track.name, 'label'],
      ['Station', study.station.value, 'len'],
      ['RailLevel', study.station.railLevel, 'len'],
      ['PlazaLevel', alternative.plazaLevel, 'len'],
      ['CutVolume', alternative.earthwork.cut, 'vol'],
      ['FillVolume', alternative.earthwork.fill, 'vol'],
      ['EarthworkScope', road ? 'Plaza and access road' : 'Plaza', 'label'],
      ['AccessRoadLength', road?.length, 'len'],
      ['AccessRoadGradePercent', alternative.accessRoad?.gradePercent, 'real'],
      ['AccessRoadGradeLimitPercent', road?.maxGradePercent, 'real'],
      ['AccessRoadGradeExceedsLimit', alternative.accessRoad?.exceedsLimit, 'bool'],
      ['PedestrianLinkType', link?.label, 'label'],
      ['PedestrianLinkLength', link?.length, 'len'],
      ['PedestrianLinkStartLevel', linkLevels?.startLevel, 'len'],
      ['PedestrianLinkEndLevel', linkLevels?.endLevel, 'len'],
      ['PedestrianLinkPlazaLevelDifference', linkLevels?.plazaLevelDifference, 'len'],
      ['PedestrianLinkStationLevelDifference', linkLevels?.stationLevelDifference, 'len'],
      ['SourceCrs', sourceCrs?.epsgCode ? `EPSG:${sourceCrs.epsgCode}` : sourceCrs?.name, 'label'],
    ]]],
  }).text;
}
