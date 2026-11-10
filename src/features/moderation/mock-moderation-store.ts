import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReportTarget = 'USER' | 'ROOM';
const reasons = [
  { code: 'ABUSE', label: '욕설·비방·혐오 표현', targets: ['USER', 'ROOM'] },
  { code: 'HARASSMENT', label: '괴롭힘·위협·스토킹', targets: ['USER'] },
  { code: 'SEXUAL_CONTENT', label: '음란·성적 불쾌감 유발', targets: ['USER', 'ROOM'] },
  { code: 'SPAM', label: '광고·도배', targets: ['USER', 'ROOM'] },
  { code: 'FRAUD', label: '사기·금전 요구', targets: ['USER', 'ROOM'] },
  { code: 'PRIVACY_VIOLATION', label: '개인정보 노출·침해', targets: ['USER', 'ROOM'] },
  { code: 'IMPERSONATION', label: '타인 사칭', targets: ['USER'] },
  { code: 'INAPPROPRIATE_PROFILE', label: '부적절한 닉네임·프로필 사진', targets: ['USER'] },
  { code: 'MISLEADING_ROOM_INFO', label: '허위 경기·모집 정보', targets: ['ROOM'] },
  { code: 'ILLEGAL_ACTIVITY', label: '불법 거래·활동 유도', targets: ['ROOM'] },
  { code: 'OTHER', label: '기타', targets: ['USER', 'ROOM'] },
] as const;

type Block = { blockerId: number; blockedId: number; blockedAt: string };
type Report = { reporterId: number; targetType: ReportTarget; targetId: number; reason: string; description: string | null; createdAt: string };
type State = { blocks: Block[]; reports: Report[] };
const storageKey = 'jikchin.mock-moderation.v1';
let pendingWrite: Promise<unknown> = Promise.resolve();

async function readState(): Promise<State> {
  const stored = await AsyncStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) as State : { blocks: [], reports: [] };
}

function writeState(update: (state: State) => void) {
  const write = pendingWrite.then(async () => {
    const state = await readState();
    update(state);
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
  });
  pendingWrite = write.catch(() => {});
  return write;
}

export function getMockReportOptions(targetType: ReportTarget) {
  return { enabled: true, targetType, descriptionRequired: targetType === 'USER', descriptionMaxLength: 2000,
    reasons: reasons.filter((reason) => (reason.targets as readonly string[]).includes(targetType)) };
}

export function submitMockReport(reporterId: number, targetType: ReportTarget, targetId: number, reason: string, description: string) {
  if (!Number.isSafeInteger(targetId) || targetId <= 0 || (targetType === 'USER' && reporterId === targetId)) throw new Error('신고할 수 없는 대상이에요.');
  if (!getMockReportOptions(targetType).reasons.some((item) => item.code === reason)) throw new Error('신고 사유를 선택해 주세요.');
  if (description.length > 2000 || (targetType === 'USER' && !description.trim())) throw new Error('신고 내용을 확인해 주세요.');
  return writeState((state) => {
    state.reports.push({ reporterId, targetType, targetId, reason, description: description.trim() || null, createdAt: new Date().toISOString() });
  });
}

export async function getMockBlocks(userId: number) {
  return (await readState()).blocks.filter((block) => block.blockerId === userId).reverse();
}

export async function mockBlocksBetween(first: number, second: number) {
  return (await readState()).blocks.some((block) =>
    (block.blockerId === first && block.blockedId === second) || (block.blockerId === second && block.blockedId === first));
}

export function blockMockUser(userId: number, targetId: number) {
  if (!Number.isSafeInteger(targetId) || targetId <= 0 || userId === targetId) throw new Error('차단할 수 없는 사용자예요.');
  return writeState((state) => {
    if (!state.blocks.some((block) => block.blockerId === userId && block.blockedId === targetId)) {
      state.blocks.push({ blockerId: userId, blockedId: targetId, blockedAt: new Date().toISOString() });
    }
  });
}

export function unblockMockUser(userId: number, targetId: number) {
  return writeState((state) => { state.blocks = state.blocks.filter((block) => block.blockerId !== userId || block.blockedId !== targetId); });
}

export function blockedNickname(nickname: string | null, blocked: boolean) {
  return nickname && blocked ? `${nickname}(차단)` : nickname;
}
