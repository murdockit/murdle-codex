ALTER TABLE "Mystery"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ClueChecklist" (
  "id" TEXT NOT NULL,
  "mysteryId" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClueChecklist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClueChecklist_mysteryId_key" ON "ClueChecklist"("mysteryId");

ALTER TABLE "ClueChecklist"
ADD CONSTRAINT "ClueChecklist_mysteryId_fkey"
FOREIGN KEY ("mysteryId") REFERENCES "Mystery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
