-- DropIndex
DROP INDEX "ProductionOrder_machineId_idx";

-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "priority" INTEGER;

-- CreateIndex
CREATE INDEX "ProductionOrder_machineId_priority_idx" ON "ProductionOrder"("machineId", "priority");
