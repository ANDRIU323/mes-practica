-- Prisma no declara CHECK en el schema: añadido a mano
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_range_check" CHECK ("startsAt" < "endsAt");
