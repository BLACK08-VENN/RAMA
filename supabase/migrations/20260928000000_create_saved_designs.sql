-- Create saved designs table
CREATE TABLE IF NOT EXISTS saved_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  design_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE saved_designs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own designs
CREATE POLICY "Users can view own designs"
  ON saved_designs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own designs
CREATE POLICY "Users can insert own designs"
  ON saved_designs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own designs
CREATE POLICY "Users can update own designs"
  ON saved_designs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own designs
CREATE POLICY "Users can delete own designs"
  ON saved_designs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_saved_designs_user_id ON saved_designs(user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_saved_designs_updated_at
  BEFORE UPDATE ON saved_designs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
