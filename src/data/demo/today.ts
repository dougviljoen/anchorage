import type {
  Anchor,
  Evidence,
  JournalEntry,
  Thread,
  TodaySnapshot,
  Trip,
} from '../../domain/types'
import { decodePolyline } from '../../lib/polyline'

const officialEvidence: Evidence = {
  label: 'Official venue information',
  sourceUrl: 'https://example.com/official',
  verifiedAt: '2026-11-12T07:20:00+09:00',
  confidence: 'verified',
}

const routeEvidence: Evidence = {
  label: 'Route estimate',
  sourceUrl: 'https://maps.google.com',
  verifiedAt: '2026-11-12T09:31:00+09:00',
  confidence: 'strong',
}

const asanogawaEvidence: Evidence = {
  label: 'Hokutetsu Asanogawa Line',
  sourceUrl:
    'https://www.hokutetsu.co.jp/railway/asanogawasen/uchinada/',
  verifiedAt: '2026-07-30T12:00:00+12:00',
  confidence: 'verified',
}

const asanogawaGeometryEvidence: Evidence = {
  label: 'Rail geometry · OpenStreetMap contributors',
  sourceUrl: 'https://www.openstreetmap.org/relation/10272144',
  verifiedAt: '2026-07-30T12:00:00+12:00',
  confidence: 'strong',
}

const uchinadaCoastEvidence: Evidence = {
  label: 'Kanazawa official travel guide',
  sourceUrl:
    'https://visitkanazawa.jp/en/attractions/detail_52274.html',
  verifiedAt: '2026-07-30T12:00:00+12:00',
  confidence: 'verified',
}

const matsunoyuEvidence: Evidence = {
  label: 'Matsu-no-yu official account',
  sourceUrl: 'https://www.instagram.com/matsu_sento/',
  verifiedAt: '2026-07-30T12:00:00+12:00',
  confidence: 'strong',
}

const matsunoyu = {
  latitude: 36.565213,
  longitude: 136.651755,
}
const hokutetsuKanazawa = {
  latitude: 36.578445,
  longitude: 136.649751,
}
const uchinadaStation = {
  latitude: 36.633381,
  longitude: 136.634268,
}
const uchinadaCoast = {
  latitude: 36.644241,
  longitude: 136.625603,
}
const asanogawaLine = decodePolyline(
  'yfg~Euk`aY_J_FyFoCiA_@i@KqAKy@@sBPw@Lma@lNeAVeAPeBFqOC_DBeBReJdBcADuAOwLwAy@IcB@ka@zCiAPgAZaKvD}Af@sIxAkCl@eBj@oJ~DqBp@kIbB{@Ti@Tw@f@mRfMg@Vs@Tk@Ng@FiAFaNu@w@Mk@S]Ss@s@aDaEi@e@]Qg@Qu@IeB@cAJoA`@c@Xy@x@}KzRoEfHUZyCvCcHbJgAlBe@xA',
)

const trip: Trip = {
  id: 'japan-2026',
  name: 'Japan, held lightly',
  country: 'Japan',
  startsOn: '2026-11-05',
  endsOn: '2026-11-26',
  currentBaseId: 'kanazawa',
  bases: [
    {
      id: 'tokyo',
      city: 'Tokyo',
      region: 'Kantō',
      stayName: 'Kiyosumi stay',
      startsOn: '2026-11-05',
      endsOn: '2026-11-10',
      nights: 5,
      coordinates: { latitude: 35.6812, longitude: 139.8006 },
    },
    {
      id: 'kanazawa',
      city: 'Kanazawa',
      region: 'Ishikawa',
      stayName: 'Higashi Chaya stay',
      startsOn: '2026-11-10',
      endsOn: '2026-11-14',
      nights: 4,
      coordinates: { latitude: 36.571, longitude: 136.662 },
    },
    {
      id: 'kyoto',
      city: 'Kyoto',
      region: 'Kansai',
      stayName: 'Okazaki stay',
      startsOn: '2026-11-14',
      endsOn: '2026-11-20',
      nights: 6,
      coordinates: { latitude: 35.0116, longitude: 135.7681 },
    },
    {
      id: 'setouchi',
      city: 'Uno',
      region: 'Setouchi',
      stayName: 'Port stay',
      startsOn: '2026-11-20',
      endsOn: '2026-11-26',
      nights: 6,
      coordinates: { latitude: 34.4954, longitude: 133.9535 },
    },
  ],
}

const anchors: Anchor[] = [
  {
    id: 'kanazawa-stay',
    kind: 'stay',
    title: 'Higashi Chaya stay',
    detail: 'Your quiet base for four nights',
    startsAt: '2026-11-10T15:00:00+09:00',
    endsAt: '2026-11-14T10:00:00+09:00',
    locationName: 'Higashiyama, Kanazawa',
    coordinates: { latitude: 36.5728, longitude: 136.6667 },
    fixed: true,
  },
  {
    id: 'dinner',
    kind: 'reservation',
    title: 'Dinner at Tsubajin',
    detail: 'Leave your stay by 17:42',
    startsAt: '2026-11-12T18:30:00+09:00',
    endsAt: '2026-11-12T20:15:00+09:00',
    locationName: 'Teramachi, Kanazawa',
    coordinates: { latitude: 36.5551, longitude: 136.6538 },
    fixed: true,
  },
  {
    id: 'kyoto-train',
    kind: 'transport',
    title: 'Train to Kyoto',
    detail: 'Reserved seat · Thunderbird 18',
    startsAt: '2026-11-14T10:20:00+09:00',
    endsAt: '2026-11-14T12:36:00+09:00',
    locationName: 'Kanazawa Station',
    fixed: true,
  },
  {
    id: 'garden-intention',
    kind: 'intention',
    title: 'See Kenroku-en quietly',
    detail: 'Best before 08:30 on a dry morning',
    startsAt: '2026-11-13T07:00:00+09:00',
    locationName: 'Kenroku-en',
    fixed: false,
  },
]

const threads: Thread[] = [
  {
    id: 'clay-after-rain',
    mode: 'drift',
    title: 'Clay after rain',
    eyebrow: 'A gentle three hours',
    summary:
      'A small coffee counter, two ceramic rooms and the river when the rain thins.',
    whyNow:
      'The workshops close early, the covered streets make the drizzle easy, and the river should brighten around noon.',
    durationMinutes: 175,
    walkingMinutes: 43,
    walkingKm: 2.7,
    costYen: 1700,
    atmosphere: 'quiet',
    energy: 'quiet',
    weatherNote: 'Light rain · mostly covered',
    returnNote: 'One direct bus back · 14 min',
    fallback:
      'If the rain lingers, skip the river and spend the final forty minutes at the craft archive.',
    palette: 'clay',
    tags: ['ceramics', 'kissaten', 'covered'],
    stops: [
      {
        id: 'mamezuki',
        order: 1,
        title: 'Mamezuki',
        category: 'Coffee counter',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 35,
        travelMinutesFromPrevious: 8,
        note: 'Six seats, hand-dripped coffee and a quiet view of the lane.',
        openingNote: 'Open now · usually calm until 11:00',
        coordinates: { latitude: 36.5735, longitude: 136.6662 },
        evidence: [officialEvidence, routeEvidence],
      },
      {
        id: 'enishira',
        order: 2,
        title: 'Enishira',
        category: 'Local craft',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 45,
        travelMinutesFromPrevious: 6,
        note: 'Utility ware from Ishikawa makers, selected with a restrained eye.',
        openingNote: 'Open until 16:30 · verified today',
        coordinates: { latitude: 36.5712, longitude: 136.6651 },
        evidence: [officialEvidence],
      },
      {
        id: 'asano-river',
        order: 3,
        title: 'Asano river edge',
        category: 'Walk',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 45,
        travelMinutesFromPrevious: 8,
        note: 'A low, open stretch timed for the forecast break in the cloud.',
        openingNote: 'Best light around 11:50',
        coordinates: { latitude: 36.576, longitude: 136.6675 },
        evidence: [routeEvidence],
      },
    ],
    travelModeToAnchor: 'TRANSIT',
    transitModesToAnchor: ['BUS'],
    phrases: [
      {
        id: 'local-maker',
        context: 'At the ceramic shop',
        english: 'Was this made in Ishikawa?',
        japanese: 'これは石川県で作られましたか？',
        romanized: 'Kore wa Ishikawa-ken de tsukuraremashita ka?',
      },
    ],
    evidence: [officialEvidence, routeEvidence],
  },
  {
    id: 'shadow-and-paper',
    mode: 'follow',
    title: 'Shadow & paper',
    eyebrow: 'Follow a thread',
    summary:
      'A measured trail through printed matter, filtered light and two small modernist interiors.',
    whyNow:
      'The light will be soft after the rain, and this route reaches the archive during its quietest window.',
    durationMinutes: 225,
    walkingMinutes: 58,
    walkingKm: 3.6,
    costYen: 2600,
    atmosphere: 'settled',
    energy: 'open',
    weatherNote: 'Cloud lifting · good indoor light',
    returnNote: 'Finishes 19 min from dinner',
    fallback:
      'If the archive is busy, reverse the final two stops and take tea in the reading room.',
    palette: 'moss',
    tags: ['architecture', 'print', 'light'],
    stops: [
      {
        id: 'nakamura',
        order: 1,
        title: 'Nakamura Memorial',
        category: 'Architecture',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 55,
        travelMinutesFromPrevious: 17,
        note: 'A small museum where framed garden views do much of the work.',
        openingNote: 'Open until 17:00 · last entry 16:30',
        coordinates: { latitude: 36.5587, longitude: 136.6608 },
        evidence: [officialEvidence, routeEvidence],
      },
      {
        id: 'paper-room',
        order: 2,
        title: 'Paper room',
        category: 'Print & design',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 40,
        travelMinutesFromPrevious: 12,
        note: 'Regional papers, restrained stationery and a useful architecture shelf.',
        openingNote: 'Open until 18:00 · verified yesterday',
        coordinates: { latitude: 36.5618, longitude: 136.6587 },
        evidence: [officialEvidence],
      },
      {
        id: 'suzuki-path',
        order: 3,
        title: 'Water Mirror Garden',
        category: 'Light & form',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 45,
        travelMinutesFromPrevious: 15,
        note: 'A precise final pause while the reflected light is at its best.',
        openingNote: 'Quiet window expected after 14:30',
        coordinates: { latitude: 36.5577, longitude: 136.6623 },
        evidence: [officialEvidence, routeEvidence],
      },
    ],
    travelModeToAnchor: 'WALK',
    phrases: [],
    evidence: [officialEvidence, routeEvidence],
  },
  {
    id: 'sea-at-the-end',
    mode: 'go',
    title: 'Sea at the end of the line',
    eyebrow: 'Go while it’s good',
    summary:
      'A neighbourhood bathhouse, then a small local train to its final stop and the Sea of Japan.',
    whyNow:
      'Today is your only clear western horizon before Kyoto. Starting at Matsu-no-yu still leaves room for the short train ride and an unhurried coast.',
    durationMinutes: 315,
    walkingMinutes: 112,
    walkingKm: 8.6,
    costYen: 2200,
    atmosphere: 'lively',
    energy: 'full',
    weatherNote: 'Clearing west · sunset 16:46',
    returnNote: 'Train back from the final stop · dinner remains comfortable',
    fallback:
      'If the coast stays wet, turn at the dune edge and check the next train before leaving the station area.',
    palette: 'indigo',
    tags: ['sentō', 'local train', 'coast'],
    stops: [
      {
        id: 'matsunoyu',
        order: 1,
        title: 'Matsu-no-yu',
        category: 'Restored public bathhouse',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 60,
        travelMinutesFromPrevious: 26,
        note: 'A restored public bath with an ordinary neighbourhood rhythm.',
        openingNote: 'Schedule varies · confirm today before leaving',
        coordinates: matsunoyu,
        evidence: [matsunoyuEvidence],
      },
      {
        id: 'uchinada-coast',
        order: 2,
        title: 'Uchinada Coast',
        category: 'Dune & sea walk',
        travelModeFromPrevious: 'WALK',
        durationMinutes: 75,
        travelMinutesFromPrevious: 20,
        note: 'A broad dune, cold air and the western horizon with almost nothing competing for attention.',
        openingNote: '1.6 km from the final stop · best before sunset',
        coordinates: uchinadaCoast,
        evidence: [uchinadaCoastEvidence],
      },
    ],
    routeWaypoints: [
      {
        id: 'matsunoyu',
        coordinates: matsunoyu,
        travelModeFromPrevious: 'WALK',
      },
      {
        id: 'outbound-kanazawa-station',
        coordinates: hokutetsuKanazawa,
        travelModeFromPrevious: 'WALK',
      },
      {
        id: 'outbound-uchinada-station',
        coordinates: uchinadaStation,
        travelModeFromPrevious: 'TRANSIT',
        transitModesFromPrevious: ['TRAIN'],
        curatedPathFromPrevious: asanogawaLine,
      },
      {
        id: 'uchinada-coast',
        coordinates: uchinadaCoast,
        travelModeFromPrevious: 'WALK',
      },
      {
        id: 'return-uchinada-station',
        coordinates: uchinadaStation,
        travelModeFromPrevious: 'WALK',
      },
      {
        id: 'return-kanazawa-station',
        coordinates: hokutetsuKanazawa,
        travelModeFromPrevious: 'TRANSIT',
        transitModesFromPrevious: ['TRAIN'],
        curatedPathFromPrevious: [...asanogawaLine].reverse(),
      },
    ],
    travelModeToAnchor: 'WALK',
    phrases: [
      {
        id: 'towel',
        context: 'At the bathhouse',
        english: 'May I rent a towel?',
        japanese: 'タオルを借りられますか？',
        romanized: 'Taoru o kariraremasu ka?',
      },
    ],
    evidence: [
      matsunoyuEvidence,
      asanogawaEvidence,
      asanogawaGeometryEvidence,
      uchinadaCoastEvidence,
      routeEvidence,
    ],
  },
]

const journal: JournalEntry[] = [
  {
    id: 'blue-tile',
    occurredAt: '2026-11-11T16:30:00+09:00',
    place: 'Higashiyama',
    observation: 'Blue tile holding the last of the wet light.',
    object: 'A small kutani cup',
    palette: 'indigo',
    coordinates: { latitude: 36.5726, longitude: 136.6661 },
  },
  {
    id: 'station-window',
    occurredAt: '2026-11-10T12:40:00+09:00',
    place: 'Toyama',
    observation: 'The mountains appeared for exactly seven minutes.',
    palette: 'moss',
    coordinates: { latitude: 36.7016, longitude: 137.2137 },
  },
  {
    id: 'brass-handle',
    occurredAt: '2026-11-08T15:10:00+09:00',
    place: 'Kiyosumi',
    observation: 'A brass door pull, polished only where hands reach.',
    palette: 'clay',
    coordinates: { latitude: 35.6815, longitude: 139.8021 },
  },
]

export const demoToday: TodaySnapshot = {
  trip,
  context: {
    observedAt: '2026-11-12T09:36:00+09:00',
    locationName: 'Higashiyama, Kanazawa',
    coordinates: { latitude: 36.5725, longitude: 136.6663 },
    weather: {
      temperatureC: 13,
      condition: 'Light rain',
      precipitationNow: true,
      clearsAt: '2026-11-12T10:40:00+09:00',
      sunsetAt: '2026-11-12T16:46:00+09:00',
    },
    energy: 'open',
    nextAnchor: anchors[1],
    minutesUntilAnchor: 534,
  },
  radar: {
    id: 'orslow-window',
    title: 'An easy orSlow window',
    body: 'A confirmed stockist is 11 minutes away and closes in 54 minutes. Your remaining Kanazawa routes do not return here.',
    actionLabel: 'See the detour',
    threadId: 'clay-after-rain',
    expiresAt: '2026-11-12T10:30:00+09:00',
    relevance: 0.96,
    urgency: 0.88,
    convenience: 0.91,
    confidence: 'strong',
  },
  threads,
  anchors,
  journal,
}
