import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/plugins/auth.js';
import { addDays, shiftAt, shiftsBetween } from '../src/modules/shifts/shifts.time.js';

// Datos de ejemplo para no empezar con la base de datos vacía.
// Ejecutar con: npm run db:seed

try {
  process.loadEnvFile();
} catch {
  // Sin .env: las variables deben venir del entorno
}

const prisma = new PrismaClient();

async function seedAdmin() {
  // En minúsculas, igual que normaliza el login
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Faltan ADMIN_EMAIL o ADMIN_PASSWORD en .env');
  }

  const passwordHash = await hashPassword(password);
  // upsert: si el admin ya existe, solo se actualiza su contraseña
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: 'Administrador', role: 'ADMIN' },
  });
}

async function main() {
  const admin = await seedAdmin();

  // WorkLog primero: su relación con Employee es Restrict
  await prisma.shift.deleteMany();
  await prisma.workLog.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.employee.deleteMany();

  // PIN de prueba: el número del empleado repetido (EMP-01 → 1111), ver README
  const [pin1, pin2, pin3, pin4] = await Promise.all(
    ['1111', '2222', '3333', '4444'].map((pin) => hashPassword(pin)),
  );
  const [ana, luis, marta] = await Promise.all([
    prisma.employee.create({ data: { code: 'EMP-01', name: 'Ana López', pinHash: pin1 } }),
    prisma.employee.create({ data: { code: 'EMP-02', name: 'Luis Pérez', pinHash: pin2 } }),
    prisma.employee.create({ data: { code: 'EMP-03', name: 'Marta Ruiz', pinHash: pin3 } }),
    prisma.employee.create({
      data: { code: 'EMP-04', name: 'Jorge Sanz', pinHash: pin4, active: false },
    }),
  ]);

  const [cnc, prensa, soldadora] = await Promise.all([
    prisma.machine.create({ data: { code: 'MAQ-01', name: 'Torno CNC' } }),
    prisma.machine.create({ data: { code: 'MAQ-02', name: 'Prensa hidráulica' } }),
    prisma.machine.create({
      data: { code: 'MAQ-03', name: 'Soldadora robot', status: 'MAINTENANCE' },
    }),
  ]);

  // Fechas relativas a ahora para que los tiempos tengan sentido
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

  // producedQty de cada orden = suma de producedQty de sus WorkLog.
  // cycleTimeSec por debajo del ritmo real para que el Rendimiento del OEE no salga al 100 %
  const eje = await prisma.productionOrder.create({
    data: {
      code: 'OF-2026-0001', product: 'Eje 20mm', quantity: 500, cycleTimeSec: 200, machineId: cnc.id,
      status: 'IN_PROGRESS', producedQty: 230, startedAt: hoursAgo(20), assignedEmployeeId: ana.id,
    },
  });
  const casquillo = await prisma.productionOrder.create({
    data: {
      code: 'OF-2026-0004', product: 'Casquillo latón', quantity: 1000, cycleTimeSec: 45, machineId: cnc.id,
      status: 'DONE', producedQty: 1000, startedAt: hoursAgo(72), finishedAt: hoursAgo(56),
    },
  });
  await prisma.productionOrder.createMany({
    data: [
      {
        code: 'OF-2026-0002', product: 'Brida DN50', quantity: 120, cycleTimeSec: 90, machineId: prensa.id,
        assignedEmployeeId: luis.id, plannedStart: hoursAgo(-2),
      },
      { code: 'OF-2026-0003', product: 'Soporte lateral', quantity: 80, cycleTimeSec: 300, machineId: soldadora.id, plannedStart: hoursAgo(-24) },
      { code: 'OF-2026-0005', product: 'Chapa perforada', quantity: 300 },
      // Se solapa con OF-0001, que aún tiene para ~15 h: el Gantt lo avisa
      { code: 'OF-2026-0006', product: 'Eje 25mm', quantity: 200, cycleTimeSec: 180, machineId: cnc.id, plannedStart: hoursAgo(-6) },
    ],
  });

  await prisma.workLog.createMany({
    data: [
      // OF-0004 (terminada): 600 + 400 = 1000, con una incidencia (2 h de mantenimiento)
      {
        employeeId: luis.id, orderId: casquillo.id, startedAt: hoursAgo(72), endedAt: hoursAgo(66), producedQty: 600,
        stopReason: 'MACHINE_ISSUE', note: 'Atasco en el alimentador de barra',
      },
      { employeeId: ana.id, orderId: casquillo.id, startedAt: hoursAgo(64), endedAt: hoursAgo(56), producedQty: 400, stopReason: 'END_OF_SHIFT' },
      // OF-0001 (en curso): dos cerrados (130 + 100 = 230) y uno abierto de Ana.
      // 1 h parada por la incidencia y 30 min por el cambio de línea (Disponibilidad del OEE)
      {
        employeeId: marta.id, orderId: eje.id, startedAt: hoursAgo(20), endedAt: hoursAgo(12), producedQty: 130,
        stopReason: 'MACHINE_ISSUE', note: 'Vibración en el cabezal, avisado mantenimiento',
      },
      { employeeId: luis.id, orderId: eje.id, startedAt: hoursAgo(11), endedAt: hoursAgo(4), producedQty: 100, stopReason: 'LINE_CHANGE' },
      { employeeId: ana.id, orderId: eje.id, startedAt: hoursAgo(3.5) },
    ],
  });

  // Historial de mantenimiento coherente con las incidencias: el torno se reactivó
  // 2 h y 1 h después de cada una; la soldadora sigue en mantenimiento (puesta a mano)
  const issues = await prisma.workLog.findMany({
    where: { stopReason: 'MACHINE_ISSUE' },
    select: { id: true, endedAt: true },
    orderBy: { endedAt: 'asc' },
  });
  await prisma.machineMaintenance.createMany({
    data: [
      { machineId: cnc.id, workLogId: issues[0].id, startedAt: issues[0].endedAt!, endedAt: hoursAgo(64) },
      { machineId: cnc.id, workLogId: issues[1].id, startedAt: issues[1].endedAt!, endedAt: hoursAgo(11) },
      { machineId: soldadora.id, startedAt: hoursAgo(30) },
    ],
  });

  // Turnos de los últimos 3 días: cerrados los que acabaron hace más de 24 h (10 min
  // después del fin); los más recientes quedan sin cerrar para probar el aviso
  // (el WorkLog abierto de Ana)
  const today = shiftAt(new Date()).date;
  await prisma.shift.createMany({
    data: shiftsBetween(addDays(today, -3), today)
      .filter((s) => s.endsAt < hoursAgo(24))
      .map(({ date, ...s }) => ({
        ...s,
        date: new Date(`${date}T00:00:00Z`),
        closedAt: new Date(s.endsAt.getTime() + 10 * 60_000),
        closedById: admin.id,
      })),
  });

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
