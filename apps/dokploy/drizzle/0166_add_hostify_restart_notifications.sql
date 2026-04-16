-- Rename dokployRestart to hostifyRestart (branding update)
ALTER TABLE "notification" RENAME COLUMN "dokployRestart" TO "hostifyRestart";
ALTER TABLE "notification" RENAME COLUMN "dokployBackup" TO "hostifyBackup";
