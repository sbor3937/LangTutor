const familyRoleLabels: Record<string, string> = {
  owner: "владелец",
  admin: "администратор",
  guardian: "представитель",
  member: "участник",
  child: "ребёнок",
};

export function familyRoleLabel(role: string | null | undefined) {
  if (!role) return "не назначена";
  return familyRoleLabels[role] ?? role;
}
