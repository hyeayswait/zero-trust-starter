/**
 * 资源级授权（ABAC / ReBAC 混合模型）。
 *
 * 粗粒度 permission（如 admin:read）只能表达「这个人能不能读管理接口」，
 * 无法表达「member 只能读自己创建的文档」。企业场景几乎都是后者。
 *
 * 这里提供两层判定：
 *   1. 角色 -> 动作集合（RBAC）：决定能对某类资源做哪些动作
 *   2. 资源归属 / 条件策略（ABAC）：决定能对 *哪一条* 资源做该动作
 *
 * 策略按「显式允许优先，默认拒绝」执行——零信任基本原则。
 */

import type { Role } from "./types";

export type ResourceType = "document" | "audit" | "user" | "dashboard";

export type Action = "read" | "write" | "delete" | "list";

export interface Resource {
  type: ResourceType;
  id?: string;
  /** 资源所有者（用户 sub）；无主资源视为共享 */
  owner?: string;
  /** 额外属性，供条件策略使用 */
  attrs?: Record<string, unknown>;
}

export interface Subject {
  sub: string;
  roles: Role[];
  /** 所属组织/租户，用于隔离 */
  tenant?: string;
}

export type PolicyEffect = "allow" | "deny";

export interface Policy {
  name: string;
  /** 适用角色；不填表示所有角色 */
  roles?: Role[];
  /** 适用动作；不填表示所有动作 */
  actions?: Action[];
  /** 适用资源类型；不填表示所有类型 */
  resources?: ResourceType[];
  /** 附加条件，全部满足才命中 */
  when?: (subject: Subject, resource: Resource) => boolean;
  effect: PolicyEffect;
}

/**
 * 默认策略集。
 * 顺序不重要——deny 永远优先于 allow（见 evaluate）。
 */
export const DEFAULT_POLICIES: Policy[] = [
  // 管理员：全部资源的读写
  {
    name: "admin-full-access",
    roles: ["admin"],
    actions: ["read", "write", "delete", "list"],
    effect: "allow",
  },

  // 审计员：只读审计日志，不能写
  {
    name: "auditor-read-audit",
    roles: ["auditor"],
    resources: ["audit"],
    actions: ["read", "list"],
    effect: "allow",
  },

  // 所有已认证用户：可读自己的 dashboard
  {
    name: "member-own-dashboard",
    roles: ["member", "auditor", "admin"],
    resources: ["dashboard"],
    actions: ["read"],
    effect: "allow",
  },

  // member：可读写自己拥有的文档
  {
    name: "member-own-document",
    roles: ["member"],
    resources: ["document"],
    actions: ["read", "write", "delete", "list"],
    when: (s, r) => r.owner === s.sub,
    effect: "allow",
  },

  // member：可读同租户内标记为 public 的文档
  {
    name: "member-public-document",
    roles: ["member"],
    resources: ["document"],
    actions: ["read"],
    when: (s, r) =>
      r.attrs?.visibility === "public" &&
      (r.attrs?.tenant === undefined || r.attrs?.tenant === s.tenant),
    effect: "allow",
  },

  // 任何角色：禁止写审计日志（审计必须只追加，由系统写入）
  {
    name: "no-write-audit",
    resources: ["audit"],
    actions: ["write", "delete"],
    effect: "deny",
  },

  // 任何角色：禁止访问非本租户资源
  {
    name: "deny-cross-tenant",
    when: (s, r) =>
      r.attrs?.tenant !== undefined &&
      s.tenant !== undefined &&
      r.attrs.tenant !== s.tenant,
    effect: "deny",
  },

  // 任何角色：禁止删除他人拥有的文档（管理员除外，上面的 allow 已含）
  {
    name: "deny-delete-others",
    roles: ["member", "auditor"],
    resources: ["document"],
    actions: ["delete"],
    when: (s, r) => r.owner !== undefined && r.owner !== s.sub,
    effect: "deny",
  },
];

export interface Decision {
  allowed: boolean;
  /** 命中的策略名，便于审计与排障 */
  matched: string[];
  /** 拒绝原因 */
  reason?: string;
}

/**
 * 授权判定。
 *
 * 规则：只要有一条 deny 命中 -> 拒绝（deny 优先）；
 *       否则至少一条 allow 命中 -> 允许；
 *       都没有 -> 拒绝（默认拒绝）。
 */
export function evaluate(
  subject: Subject,
  action: Action,
  resource: Resource,
  policies: Policy[] = DEFAULT_POLICIES
): Decision {
  const hit = (p: Policy): boolean => {
    if (p.roles && !subject.roles.some((r) => p.roles!.includes(r))) return false;
    if (p.actions && !p.actions.includes(action)) return false;
    if (p.resources && !p.resources.includes(resource.type)) return false;
    if (p.when && !p.when(subject, resource)) return false;
    return true;
  };

  const denies = policies.filter((p) => p.effect === "deny" && hit(p));
  if (denies.length > 0) {
    return {
      allowed: false,
      matched: denies.map((p) => p.name),
      reason: denies[0].name,
    };
  }

  const allows = policies.filter((p) => p.effect === "allow" && hit(p));
  if (allows.length > 0) {
    return { allowed: true, matched: allows.map((p) => p.name) };
  }

  return { allowed: false, matched: [], reason: "no-matching-rule" };
}

/** 便捷断言：不通过则抛出，供 API 路由使用 */
export function assertAllowed(
  subject: Subject,
  action: Action,
  resource: Resource
): void {
  const d = evaluate(subject, action, resource);
  if (!d.allowed) {
    const err = new Error(`forbidden: ${d.reason}`);
    (err as Error & { decision?: Decision }).decision = d;
    throw err;
  }
}
