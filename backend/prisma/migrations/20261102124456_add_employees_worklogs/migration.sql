-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "assignedEmployeeId" INTEGER;

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "producedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE INDEX "WorkLog_employeeId_idx" ON "WorkLog"("employeeId");

-- CreateIndex
CREATE INDEX "WorkLog_orderId_idx" ON "WorkLog"("orderId");

-- CreateIndex
CREATE INDEX "ProductionOrder_assignedEmployeeId_idx" ON "ProductionOrder"("assignedEmployeeId");

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Añadido a mano: como máximo un WorkLog abierto (endedAt NULL) por orden
CREATE UNIQUE INDEX "WorkLog_orderId_open_key" ON "WorkLog"("orderId") WHERE "endedAt" IS NULL;

-- Añadido a mano: unidades nunca negativas
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_producedQty_check" CHECK ("producedQty" >= 0);
