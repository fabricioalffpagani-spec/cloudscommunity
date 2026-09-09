-- Add 'system' value to MessageType enum
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'system';
