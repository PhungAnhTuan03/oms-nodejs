-- CreateTable
CREATE TABLE "VariantPair" (
    "variantA" INTEGER NOT NULL,
    "variantB" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "VariantPair_pkey" PRIMARY KEY ("variantA","variantB")
);
