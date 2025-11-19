-- Transaction Notes Feature
-- Allow users to add personal notes to transactions

-- Create transaction_notes table
CREATE TABLE IF NOT EXISTS public.transaction_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_key VARCHAR(50) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one note per transaction per user
  UNIQUE(user_id, chain_key, tx_hash)
);

-- Create index for faster lookups
CREATE INDEX idx_transaction_notes_user_chain ON public.transaction_notes(user_id, chain_key);
CREATE INDEX idx_transaction_notes_tx_hash ON public.transaction_notes(tx_hash);

-- Enable RLS
ALTER TABLE public.transaction_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own transaction notes"
  ON public.transaction_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transaction notes"
  ON public.transaction_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transaction notes"
  ON public.transaction_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transaction notes"
  ON public.transaction_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transaction_note_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_transaction_note_timestamp
  BEFORE UPDATE ON public.transaction_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_note_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_notes TO authenticated;

