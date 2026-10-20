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

export function hasPermission(user: SessionUser | null, perm: Permission): boolean {
  if (!user) return false;
  return user.roles.some((r) => ROLE_PERMISSIONS[r].includes(perm));
}
