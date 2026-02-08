CREATE TABLE "Mystery" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "clues" TEXT NOT NULL,
  "suspects" TEXT[] NOT NULL,
  "locations" TEXT[] NOT NULL,
  "weapons" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mystery_pkey" PRIMARY KEY ("id")
);
