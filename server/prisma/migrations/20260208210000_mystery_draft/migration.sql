CREATE TABLE "MysteryDraft" (
  "id" TEXT NOT NULL,
  "mysteryId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MysteryDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MysteryDraft_mysteryId_key" ON "MysteryDraft"("mysteryId");

ALTER TABLE "MysteryDraft"
ADD CONSTRAINT "MysteryDraft_mysteryId_fkey"
FOREIGN KEY ("mysteryId") REFERENCES "Mystery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
