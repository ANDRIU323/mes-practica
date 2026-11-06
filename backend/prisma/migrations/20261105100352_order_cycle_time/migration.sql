-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "cycleTimeSec" DOUBLE PRECISION;

-- Prisma no declara CHECK en el schema: añadido a mano
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_cycleTimeSec_check" CHECK ("cycleTimeSec" > 0);
