-- Add rekassa number and password for re-auth on 401
ALTER TABLE "conf" ADD COLUMN "rekassa_number_encrypted" TEXT;
ALTER TABLE "conf" ADD COLUMN "rekassa_password_encrypted" TEXT;
