// 角色与权限模型 —— 零信任 RBAC 核心定义
export type Role = "admin" | "member" | "auditor";

export type Permission =
  | "dashboard:read"
  | "admin:read"
  | "admin:write"
  | "audit:read"
  | "chat:use";

// 角色 -> 权限映射（默认最小权限原则）
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["dashboard:read", "admin:read", "admin:write", "audit:read", "chat:use"],
  member: ["dashboard:read", "chat:use"],
  auditor: ["dashboard:read", "audit:read"],
};

export const ALL_ROLES: Role[] = ["admin", "member", "auditor"];

export interface SessionUser {
  sub: string;          // OIDC subject id
  email: string;
  name: string;
  roles: Role[];
  // 设备/会话绑定信息，用于零信任上下文校验
  deviceId: string;
  ip: string;
  exp: number;          // 短期令牌过期时间
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ALL_ROLES as string[]).includes(value);
}

/**
 * 从 IdP 的 ID Token 声明中提取角色。
 *
 * 兼容三种常见形态：
 *  - Keycloak:  claims.realm_access.roles = ["member", ...]
 *  - 通用 OIDC:  claims.roles = ["admin", ...]
 *  - 单值:        claims.role = "admin"
 *
 * 安全约束：只接受已知角色；过滤未知值；结果为空时降级为 ["member"]，
 * 绝不因为 IdP 配置异常而默认给更高权限。
 */
export function normalizeRoles(claims: Record<string, unknown> | null | undefined): Role[] {
  const raw: unknown[] = [];
  if (claims) {
    const realmAccess = claims.realm_access;
    if (realmAccess && typeof realmAccess === "object") {
      const roles = (realmAccess as { roles?: unknown }).roles;
      if (Array.isArray(roles)) raw.push(...roles);
    }
    if (Array.isArray(claims.roles)) raw.push(...claims.roles);
    if (typeof claims.roles === "string") raw.push(claims.roles);
    if (claims.role !== undefined) raw.push(claims.role);
  }
  const roles = Array.from(new Set(raw.filter(isRole)));
  return roles.length > 0 ? roles : ["member"];
}

export function hasPermission(user: SessionUser | null, perm: Permission): boolean {
  if (!user) return false;
  return user.roles.some((r) => ROLE_PERMISSIONS[r].includes(perm));
}
