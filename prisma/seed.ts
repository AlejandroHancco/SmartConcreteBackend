import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'team:create', 'team:edit', 'team:delete', 'team:view',
  'member:approve', 'member:reject', 'member:add', 'member:remove', 'member:role:edit',
  'project:create', 'project:edit', 'project:delete', 'project:view',
  'task:create', 'task:edit', 'task:delete', 'task:view',
  'measurement:execute', 'measurement:schedule', 'measurement:view', 'measurement:delete',
  'device:create', 'device:edit', 'device:delete', 'device:view',
  'report:view', 'report:export',
  'permission:edit', 'role:edit',
];

const ROLES = [
  'Super Administrador',
  'Administrador de Equipo',
  'Gestor de Proyecto',
  'Operario',
  'Visualizador',
];

const TEAM_ADMIN_EXCLUDE = new Set([
  'team:create', 'team:delete', 'permission:edit', 'role:edit',
]);

const PROJECT_MANAGER_EXCLUDE = new Set([
  'team:create', 'team:edit', 'team:delete',
  'member:approve', 'member:reject', 'member:role:edit',
  'device:delete', 'permission:edit', 'role:edit',
]);

const OPERATOR_PERMS = new Set([
  'team:view', 'project:view', 'task:view',
  'measurement:execute', 'measurement:schedule', 'measurement:view',
  'device:view', 'report:view',
]);

const VIEWER_PERMS = new Set([
  'team:view', 'project:view', 'task:view',
  'measurement:view', 'device:view', 'report:view',
]);

async function main() {
  console.log('Seeding roles...');
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seeding permissions...');
  for (const id of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id },
      update: {},
      create: { id },
    });
  }

  const allRoles = await prisma.role.findMany();
  const roleId = (name: string) => allRoles.find(r => r.name === name)!.id;

  const assignments: { roleId: number; permissionId: string }[] = [];

  for (const p of ALL_PERMISSIONS) {
    assignments.push({ roleId: roleId('Super Administrador'), permissionId: p });
  }
  for (const p of ALL_PERMISSIONS) {
    if (!TEAM_ADMIN_EXCLUDE.has(p)) {
      assignments.push({ roleId: roleId('Administrador de Equipo'), permissionId: p });
    }
  }
  for (const p of ALL_PERMISSIONS) {
    if (!PROJECT_MANAGER_EXCLUDE.has(p)) {
      assignments.push({ roleId: roleId('Gestor de Proyecto'), permissionId: p });
    }
  }
  for (const p of OPERATOR_PERMS) {
    assignments.push({ roleId: roleId('Operario'), permissionId: p });
  }
  for (const p of VIEWER_PERMS) {
    assignments.push({ roleId: roleId('Visualizador'), permissionId: p });
  }

  console.log('Seeding role_permissions...');
  await prisma.rolePermission.createMany({
    data: assignments,
    skipDuplicates: true,
  });

  console.log(`Seed complete: ${ROLES.length} roles, ${ALL_PERMISSIONS.length} permissions, ${assignments.length} assignments.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
