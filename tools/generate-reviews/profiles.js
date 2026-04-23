// Pre-generates runner profiles with controlled distribution.
// LLM only writes the review body; profile fields are deterministic.

const INITIALS = 'KJHSMYDPLREWATNOIBGCFVXZU'.split('');

const DISTANCE_BUCKETS = [
  { key: 'daily',  label: '5K · Daily',    kmRange: [20, 40],  weight: 15 },
  { key: 'mid',    label: '10K',           kmRange: [28, 55],  weight: 22 },
  { key: 'mid',    label: '하프',          kmRange: [40, 70],  weight: 25 },
  { key: 'long',   label: '풀코스',        kmRange: [55, 95],  weight: 22 },
  { key: 'long',   label: '울트라',        kmRange: [80, 130], weight: 10 },
  { key: 'long',   label: '트레일',        kmRange: [50, 110], weight: 6 },
];

const AGE_RANGES = [
  { label: '30대 초반', weight: 25 },
  { label: '30대 중반', weight: 30 },
  { label: '30대 후반', weight: 22 },
  { label: '40대 초반', weight: 15 },
  { label: '40대 중반', weight: 8 },
];

const TIME_OF_DAY = ['새벽 러너', '아침 러너', '퇴근 러너', '야간 러너', '주말 러너'];

const CAREER_YEARS = [
  { years: '1~2년', weight: 12 },
  { years: '3년',   weight: 18 },
  { years: '4~5년', weight: 28 },
  { years: '6~8년', weight: 25 },
  { years: '10년+', weight: 17 },
];

const DAYS_TESTED = [22, 25, 30, 30, 30, 45, 45, 60, 60, 75, 90];

// 분포 통제: LLM이 알아서 정하면 "재구매" 마무리로 몰림. 스크립트가 배분.
const CLOSING_STYLES = [
  { key: 'repurchase',         hint: '재구매·한 통 더·정기 결제 걸었다로 자연스럽게 마무리',             weight: 18 },
  { key: 'next_race',          hint: '다음 대회·다음 훈련 사이클 계획으로 마무리 (재구매 언급 금지)',    weight: 18 },
  { key: 'product_detail',     hint: '알갱이 크기·냄새·맛·포장 같은 제품 디테일 한마디로 마무리 (재구매 언급 금지)', weight: 12 },
  { key: 'price_question',     hint: '정기 결제·할인·배송·가격 관련 짧은 질문으로 마무리 (재구매 언급 금지)',         weight: 10 },
  { key: 'with_other',         hint: '같이 먹는 다른 보충제·식단·커피 얘기 한 줄로 마무리 (재구매 언급 금지)',       weight: 10 },
  { key: 'crew',               hint: '런크루·함께 뛰는 친구에게 권한/얘기한 에피소드로 마무리 (재구매 언급 금지)',   weight: 8 },
  { key: 'observation',        hint: '결론 없이 관찰 한 문장을 더 붙이며 자연스럽게 끝. 재구매 언급 금지',           weight: 10 },
  { key: 'aside',              hint: '러닝과 직접 관련 없는 곁가지 한 줄(요즘 날씨·새 신발·코스 변경 등)로 마무리. 재구매 언급 금지', weight: 8 },
  { key: 'next_check',         hint: '다음에 뭘 확인해보고 싶은지 질문 형태로 던지며 마무리. 재구매 언급 금지',      weight: 6 },
];

const CONTEXTS = [
  '대회 준비 중',
  '부상 복귀',
  '훈련량 늘리는 구간',
  '주말 장거리 루틴',
  '인터벌 + 장거리 병행',
  '꾸준히 유지 루틴',
  '시즌 아웃 기간',
  '페이스 유지 시도 중',
];

const PRIOR_ATTEMPTS = [
  'BCAA, 종합비타민',
  '카페인 젤, 전해질 음료',
  '단백질 쉐이크, 마그네슘',
  'BCAA와 종합비타민 섞어서',
  '아미노산 파우더, 전해질',
  '카페인 젤 위주, 가끔 비타민',
  '별다른 보충제 없이',
  '마그네슘, 비타민D',
  '프로틴, 크레아틴',
];

const CONCERNS_BY_BUCKET = {
  long: [
    '30km 이후 페이스 무너짐',
    '후반부 다리 무거움',
    '장거리 후 회복 지연',
    '주말 장거리 뒤 월요일 컨디션',
    '울트라 후반부 체력 저하',
    '훈련 다음날 피로',
    '컨디션 기복',
  ],
  mid: [
    '후반부 다리 무거움',
    '훈련 다음날 피로',
    '주중 누적 피로',
    '컨디션 기복',
    '인터벌 후 회복',
    '템포런 뒤 회복',
  ],
  daily: [
    '주중 누적 피로',
    '컨디션 기복',
    '훈련 다음날 피로',
    '아침 러닝 직후 늘어짐',
    '퇴근 러닝 후 다음날 컨디션',
  ],
};

function weightedPick(arr, rand) {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const item of arr) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return arr[arr.length - 1];
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function intBetween(min, max, rand) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// Mulberry32 seeded PRNG so the same --seed yields the same profile set.
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pbForDistance(label, rand) {
  if (label.startsWith('풀코스')) {
    const m = intBetween(2, 4, rand);
    const s = intBetween(0, 59, rand);
    return `${m}h${String(s).padStart(2, '0')}'`;
  }
  if (label === '하프') {
    const h = rand() < 0.3 ? 1 : 2;
    const m = h === 1 ? intBetween(28, 59, rand) : intBetween(0, 30, rand);
    return `${h}h${String(m).padStart(2, '0')}'`;
  }
  if (label === '10K') {
    const m = intBetween(38, 58, rand);
    const s = intBetween(0, 59, rand);
    return `${m}'${String(s).padStart(2, '0')}"`;
  }
  if (label.startsWith('울트라') || label === '트레일') return null;
  // 5K
  const m = intBetween(18, 28, rand);
  const s = intBetween(0, 59, rand);
  return `${m}'${String(s).padStart(2, '0')}"`;
}

export function buildProfiles(count, seed = 42) {
  const rand = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const dist = weightedPick(DISTANCE_BUCKETS, rand);
    const ageRange = weightedPick(AGE_RANGES, rand);
    const career = weightedPick(CAREER_YEARS, rand);
    const weeklyKm = intBetween(dist.kmRange[0], dist.kmRange[1], rand);
    const days = pick(DAYS_TESTED, rand);
    const stars = rand() < 0.78 ? 5 : 4;
    const repurchase = days >= 45 ? rand() < 0.55 : rand() < 0.15;
    const closing = weightedPick(CLOSING_STYLES, rand);

    out.push({
      id: i + 1,
      initial: pick(INITIALS, rand),
      age: ageRange.label,
      time_of_day: pick(TIME_OF_DAY, rand),
      career_years: career.years,
      distance_label: dist.label,
      distance_bucket: dist.key,
      weekly_km: weeklyKm,
      pb: pbForDistance(dist.label, rand),
      days_tested: days,
      stars,
      repurchase,
      context: pick(CONTEXTS, rand),
      prior_attempts: pick(PRIOR_ATTEMPTS, rand),
      concern: pick(CONCERNS_BY_BUCKET[dist.key], rand),
      closing_style: closing.key,
      closing_hint: closing.hint,
    });
  }
  return out;
}
