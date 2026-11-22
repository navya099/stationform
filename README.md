# StationForm

노선 기획과 개념설계 단계에서 철도역사의 부지와 배치 대안을 검토하는 오프라인 데스크톱 도구다.

대상은 토공구간 선상·선하역사와 고가구간 고가역사다. LandXML 선형과 DEM 또는 LandXML 지표면을 기준으로 역사 본체, 승강장, 광장, 진입로와 연결시설을 계획한다. 최종 산출물은 LOD 100~200 IFC 모델, DXF 배치도·평면도·입면도·단면도, CSV 집계표와 건축설계설명서다.

StationForm의 프로젝트 모델은 선로·측점·계획고, 패밀리 유형과 배치 객체, 설계 대안별 수정값을 관리한다. 도면과 집계는 같은 대안 버전에서 생성한다. 범용 계산과 파일 처리에는 CivilCraft와 BIMCraft 모듈을 우선 검토한다.

## 첫 통합 검증

합성 LandXML에서 직선 선형, 계획 종단과 현황 TIN을 읽는다. 지정 측점의 레일면을 산정하고 광장 계획고를 두 값으로 적용해 계획 지표면과 개략 토공량이 바뀌는지 확인한다. CivilCraft의 계산 모듈을 Node.js에서 직접 실행하는 개발 검증이다.

Node.js 24와 아래 CivilCraft 리비전의 체크아웃이 필요하다. 최초 의존성 설치를 마치면 검증은 로컬에서 실행된다.

```sh
git clone https://github.com/getcadcraft/civilcraft.git ../civilcraft
git -C ../civilcraft checkout a83c0c1011ef1c0d4bb9f2e9c39bc18a4cf016f7
npm ci
npm run verify:civil -- ../civilcraft
```

이 검증은 가상 미터 좌표의 직선 선로와 수평 현황 지형을 사용한다. 실제 지리좌표와 수직 기준, 철도 곡선, 데스크톱 UI 및 산출물은 이후 구현 범위다.

## 라이선스

[Apache-2.0](LICENSE)
