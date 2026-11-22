# StationForm

노선 기획과 개념설계 단계에서 철도역사의 부지와 배치 대안을 검토하는 오프라인 데스크톱 도구다.

대상은 토공구간 선상·선하역사와 고가구간 고가역사다. LandXML 선형과 DEM 또는 LandXML 지표면을 기준으로 역사 본체, 승강장, 광장, 진입로와 연결시설을 계획한다. 최종 산출물은 LOD 100~200 IFC 모델, DXF 배치도·평면도·입면도·단면도, CSV 집계표와 건축설계설명서다.

StationForm의 프로젝트 모델은 선로·측점·계획고, 패밀리 유형과 배치 객체, 설계 대안별 수정값을 관리한다. 도면과 집계는 같은 대안 버전에서 생성한다. 범용 계산과 파일 처리에는 CivilCraft와 BIMCraft 모듈을 우선 검토한다.

## 부지 검토 개발 도구

미터 단위 LandXML 한 파일에서 선형, 계획 종단과 현황 TIN을 선택한다. 지정 측점의 레일면과 승강장 연단 위치·높이, 현황 및 대안별 계획 횡단면, 개략 절·성토량을 JSON으로 출력한다. 광장 계획고를 바꿔도 대안마다 같은 현황 TIN을 기준으로 계산한다.

Node.js 24와 아래 CivilCraft 리비전의 체크아웃이 필요하다. 첫 데스크톱 실행에서는 Electron 실행 파일을 내려받을 수 있으며, 개발 환경을 준비한 뒤에는 로컬에서 실행된다.

```sh
git clone https://github.com/getcadcraft/civilcraft.git ../civilcraft
git -C ../civilcraft checkout a83c0c1011ef1c0d4bb9f2e9c39bc18a4cf016f7
npm ci
npm run desktop -- ../civilcraft
npm run --silent study:civil -- ../civilcraft fixtures/concept-station.xml fixtures/concept-study.json
npm run verify:civil -- ../civilcraft
```

[샘플 설계 조건](fixtures/concept-study.json)에서 선형·종단·지표면 인덱스는 0부터 시작한다. 오프셋은 측점 증가 방향을 기준으로 우측이 양수이며, 절·성토 사면은 수평 거리와 높이의 비율(H:V)로 입력한다. 토공량은 대안별 사면 접합 경계 안에서 격자로 근사한다.

데스크톱 개발판은 샘플을 열어 배치 평면, 횡단면, 대안별 토공량 비교표를 표시한다. 기준 측점이나 선택 대안의 광장 계획고를 바꾼 뒤 **계산 적용**을 누르면 결과가 갱신된다. 자체 파일은 **LandXML 열기**와 **설계 조건 열기**에서 각각 선택한다. 편집한 값은 세션에 보관된다.

검증에는 가상 좌표의 직선 선로와 평탄한 지형을 사용한다. 지형과 선형은 공통 좌표·수직 기준으로 준비해야 한다. 승강장은 개념 배치이며 캔트 보정, 실제 곡선 노선 검증, 프로젝트 저장, 최종 산출물과 독립 설치 패키징은 이후 구현 범위다.

## 라이선스

[Apache-2.0](LICENSE)
