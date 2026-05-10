
-- Add governorate and city to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS governorate TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;

-- Add governorate and city to stores table  
ALTER TABLE stores ADD COLUMN IF NOT EXISTS governorate TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city TEXT;
