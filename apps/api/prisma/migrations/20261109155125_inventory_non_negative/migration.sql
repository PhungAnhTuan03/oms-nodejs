ALTER TABLE "Inventory" ADD CONSTRAINT available_non_negative CHECK (available >= 0);
