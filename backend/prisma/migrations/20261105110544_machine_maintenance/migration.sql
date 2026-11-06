-- CreateTable
CREATE TABLE "MachineMaintenance" (
    "id" SERIAL NOT NULL,
    "machineId" INTEGER NOT NULL,
    "workLogId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "MachineMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineMaintenance_workLogId_key" ON "MachineMaintenance"("workLogId");

-- CreateIndex
CREATE INDEX "MachineMaintenance_machineId_startedAt_idx" ON "MachineMaintenance"("machineId", "startedAt");

-- AddForeignKey
ALTER TABLE "MachineMaintenance" ADD CONSTRAINT "MachineMaintenance_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineMaintenance" ADD CONSTRAINT "MachineMaintenance_workLogId_fkey" FOREIGN KEY ("workLogId") REFERENCES "WorkLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A mano (Prisma no los declara en el schema):
-- como mucho un mantenimiento abierto por máquina
CREATE UNIQUE INDEX "MachineMaintenance_machineId_open_key" ON "MachineMaintenance"("machineId") WHERE "endedAt" IS NULL;

ALTER TABLE "MachineMaintenance" ADD CONSTRAINT "MachineMaintenance_range_check" CHECK ("endedAt" IS NULL OR "startedAt" < "endedAt");

-- Las máquinas que ya están en mantenimiento empiezan con un periodo abierto
-- (no se sabe desde cuándo: se toma su última modificación)
INSERT INTO "MachineMaintenance" ("machineId", "startedAt")
SELECT "id", "updatedAt" FROM "Machine" WHERE "status" = 'MAINTENANCE';
