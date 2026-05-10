
-- Add location field to stores table
-- Run this in Supabase Dashboard → SQL Editor
ALTER TABLE stores ADD COLUMN IF NOT EXISTS location TEXT;
