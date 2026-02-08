CREATE TABLE "GridState" (
  "id" TEXT NOT NULL,
  "mysteryId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "rows" INTEGER NOT NULL,
  "cols" INTEGER NOT NULL,
  "cells" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GridState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GridState_mysteryId_mode_key" ON "GridState"("mysteryId", "mode");

ALTER TABLE "GridState"
ADD CONSTRAINT "GridState_mysteryId_fkey"
FOREIGN KEY ("mysteryId") REFERENCES "Mystery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
