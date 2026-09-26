/**
 * 排练时长折算：把操耍人的排练投入拆成两笔账。
 * - 场次折算：已派角色所在场次时长逐场累加（同一场次派多个角色只计一次），折成小时。
 *   这笔是派生值，不落地；场次时长变了、角色换绑或解绑，重算即跟着变。
 * - 额外排练：操耍人档里手工登记的那笔（extraRehearsalHours），独立保存，
 *   任何重算都不会把它盖掉。两笔分开显示，月底对工分时再给合计。
 */
import type { Operator } from '../types/operator';
import type { ShadowRole } from '../types/role';
import type { Scene } from '../types/scene';

/** 一位操耍人的排练时长拆分 */
export interface RehearsalBreakdown {
  /** 场次折算（小时）：已派角色所在场次时长逐场累加折成小时 */
  sceneHours: number;
  /** 计入折算的场次数（同一场次多个角色只计一次） */
  sceneCount: number;
  /** 额外排练（小时）：手工登记的那笔 */
  extraHours: number;
  /** 合计（小时）= 场次折算 + 额外排练 */
  totalHours: number;
}

/** 保留 1 位小数，与手工登记的精度对齐 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

type OperatorHoursSource = Pick<Operator, 'assignedRoleIds' | 'extraRehearsalHours'>;
type RoleHoursSource = Pick<ShadowRole, 'id' | 'sceneId'>;
type SceneHoursSource = Pick<Scene, 'id' | 'durationMin'>;

/** 计算一位操耍人的排练时长拆分 */
export function rehearsalBreakdownOf(
  operator: OperatorHoursSource,
  roles: ReadonlyArray<RoleHoursSource>,
  scenes: ReadonlyArray<SceneHoursSource>,
): RehearsalBreakdown {
  const durationOf = new Map(scenes.map((scene) => [scene.id, scene.durationMin]));
  const assigned = new Set(operator.assignedRoleIds);
  const sceneIds = new Set<string>();
  roles.forEach((role) => {
    if (assigned.has(role.id)) sceneIds.add(role.sceneId);
  });
  let minutes = 0;
  sceneIds.forEach((sceneId) => {
    const duration = durationOf.get(sceneId);
    if (typeof duration === 'number' && Number.isFinite(duration)) {
      minutes += Math.max(0, duration);
    }
  });
  const sceneHours = round1(minutes / 60);
  const extraHours = round1(
    Number.isFinite(operator.extraRehearsalHours) ? Math.max(0, operator.extraRehearsalHours) : 0,
  );
  return {
    sceneHours,
    sceneCount: sceneIds.size,
    extraHours,
    totalHours: round1(sceneHours + extraHours),
  };
}

/** 全档批量折算：key 为操耍人 id */
export function rehearsalBreakdownMap(
  operators: ReadonlyArray<OperatorHoursSource & { id: string }>,
  roles: ReadonlyArray<RoleHoursSource>,
  scenes: ReadonlyArray<SceneHoursSource>,
): Map<string, RehearsalBreakdown> {
  return new Map(operators.map((operator) => [operator.id, rehearsalBreakdownOf(operator, roles, scenes)]));
}
