-- CreateEnum
CREATE TYPE "StopReason" AS ENUM ('END_OF_SHIFT', 'BREAK', 'MACHINE_ISSUE', 'LINE_CHANGE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "pinHash" TEXT;

-- AlterTable
ALTER TABLE "WorkLog" ADD COLUMN     "note" TEXT,
ADD COLUMN     "stopReason" "StopReason";

-- A mano (Prisma no declara CHECK): una incidencia de máquina siempre lleva nota
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_machine_issue_note_check"
  CHECK ("stopReason" IS DISTINCT FROM 'MACHINE_ISSUE' OR "note" IS NOT NULL);
