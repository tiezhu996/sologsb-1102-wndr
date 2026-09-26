/**
 * 排练工时拆分工具
 *
 * 每位操耍人的工时分两笔：
 * - 场次工时（自动）：已派角色「所在场次」的时长逐场相加折成小时。
 *   同一场次派多个角色只计一次；场次时长变化、角色换绑/解绑后随数据实时重算。
 *   该笔不落库，避免把手工登记的额外排练一起盖掉。
 * - 额外排练（手工）：Operator.extraRehearsalHours，由操耍人档手工 +/- 登记。
 *
 * 入参采用结构化最小类型，领域模型与数据库行（带 revision）均可直接传入。
 */
import type { Operator } from '../types/operator';
import type { Scene } from '../types/scene';
import type { ShadowRole } from '../types/role';

/** 计算工时所需的角色字段 */
export type RehearsalRoleLike = Readonly<Pick<ShadowRole, 'operatorId' | 'sceneId'>>;
/** 计算工时所需的场次字段 */
export type RehearsalSceneLike = Readonly<Pick<Scene, 'id' | 'durationMin'>>;
/** 计算工时所需的操耍人字段 */
export type RehearsalOperatorLike = Readonly<Pick<Operator, 'id' | 'extraRehearsalHours'>>;

export interface RehearsalBreakdown {
  /** 参与场次 id（去重，与角色数无关） */
  sceneIds: string[];
  /** 参与场次数（去重） */
  sceneCount: number;
  /** 场次工时分钟数（逐场相加） */
  sceneMinutes: number;
  /** 场次工时小时数（分钟 / 60，保留精确值，展示时再舍入） */
  sceneHours: number;
  /** 额外排练小时数（手工登记） */
  extraHours: number;
  /** 合计小时数（精确值） */
  totalHours: number;
}

/** 取一次有效场次时长；非法值按 0 处理 */
function finiteDurationMinute(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** 某操耍人已派角色所在的场次 id（同场多角色只保留一次） */
export function sceneIdsOfOperator(operatorId: string, roles: ReadonlyArray<RehearsalRoleLike>): string[] {
  const ids = new Set<string>();
  roles.forEach((role) => {
    if (role.operatorId === operatorId) ids.add(role.sceneId);
  });
  return [...ids];
}

/**
 * 计算一位操耍人的工时两笔账。
 * 以角色上的 operatorId 为派活准据（assignedRoleIds 仅作展示冗余）。
 */
export function rehearsalBreakdown(
  operator: RehearsalOperatorLike,
  roles: ReadonlyArray<RehearsalRoleLike>,
  scenes: ReadonlyArray<RehearsalSceneLike>,
): RehearsalBreakdown {
  const durationOf = new Map<string, number>(scenes.map((scene) => [scene.id, finiteDurationMinute(scene.durationMin)]));
  const sceneIds = sceneIdsOfOperator(operator.id, roles);
  const sceneMinutes = sceneIds.reduce((acc, sceneId) => acc + (durationOf.get(sceneId) ?? 0), 0);
  const sceneHours = sceneMinutes / 60;
  const extraHours =
    typeof operator.extraRehearsalHours === 'number' && Number.isFinite(operator.extraRehearsalHours)
      ? Math.max(0, operator.extraRehearsalHours)
      : 0;
  return {
    sceneIds,
    sceneCount: sceneIds.length,
    sceneMinutes,
    sceneHours,
    extraHours,
    totalHours: sceneHours + extraHours,
  };
}

/** 小时数舍入到两位（工分结算展示用，内部仍以精确值相加） */
export function roundHours2(hours: number): number {
  return Math.round((Number.isFinite(hours) ? hours : 0) * 100) / 100;
}

/** 小时数格式化为最多两位小数的字符串（去掉尾随 0） */
export function formatHours(hours: number): string {
  return String(roundHours2(hours));
}
