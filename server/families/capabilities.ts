export type FamilyRole = "owner" | "admin" | "guardian" | "member" | "child";
export type FamilyCapability = "family.read" | "family.settings.write" | "family.invitation.create" | "family.audit.read" | "family.owner.transfer" | "learning.family.read";

const capabilities: Record<FamilyRole, ReadonlySet<FamilyCapability>> = {
  owner: new Set(["family.read", "family.settings.write", "family.invitation.create", "family.audit.read", "family.owner.transfer", "learning.family.read"]),
  admin: new Set(["family.read", "family.settings.write", "family.invitation.create", "family.audit.read", "learning.family.read"]),
  guardian: new Set(["family.read", "learning.family.read"]),
  member: new Set(["family.read"]),
  child: new Set(["family.read"]),
};

export function can(role: FamilyRole, capability: FamilyCapability) { return capabilities[role].has(capability); }
