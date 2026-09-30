"use server";

import { backend, combine, id } from "@/lib/api/server";
import type { Permission, Region, Role, User, UserInput } from "@/lib/api/types";

/* ───────────── Roles y permisos ───────────── */

export async function loadRolesPage() {
  const [roles, permissions] = await Promise.all([backend<Role[]>("/roles"), backend<Permission[]>("/permissions")]);
  return combine({ roles, permissions });
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  return backend<Role>(`/roles/${id(roleId)}`, { method: "PUT", body: { permission_ids: permissionIds } });
}

export async function loadPermissions() {
  return backend<Permission[]>("/permissions");
}

export async function savePermission(input: { code: string; description: string | null }, permissionId?: string) {
  return permissionId
    ? backend<Permission>(`/permissions/${id(permissionId)}`, { method: "PUT", body: input })
    : backend<Permission>("/permissions", { method: "POST", body: input });
}

export async function deletePermission(permissionId: string) {
  return backend<null>(`/permissions/${id(permissionId)}`, { method: "DELETE" });
}

/* ───────────── Usuarios ───────────── */

export async function loadUsersPage() {
  const [users, roles, regions] = await Promise.all([
    backend<User[]>("/users"),
    backend<Role[]>("/roles"),
    backend<Region[]>("/regions"),
  ]);
  return combine({ users, roles, regions });
}

export async function saveUser(input: UserInput, userId?: string) {
  return userId
    ? backend<User>(`/users/${id(userId)}`, { method: "PUT", body: input })
    : backend<User>("/users", { method: "POST", body: input });
}

export async function deleteUser(userId: string) {
  return backend<null>(`/users/${id(userId)}`, { method: "DELETE" });
}
