-- A mano (Prisma no soporta índices parciales en el schema):
-- como máximo un WorkLog abierto por empleado
CREATE UNIQUE INDEX "WorkLog_employeeId_open_key" ON "WorkLog"("employeeId") WHERE "endedAt" IS NULL;
