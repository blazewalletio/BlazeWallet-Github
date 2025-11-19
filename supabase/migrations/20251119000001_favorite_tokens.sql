-- Favorite Tokens Feature
-- Allow users to star/favorite tokens for quick access

-- Create favorite_tokens table
CREATE TABLE IF NOT EXISTS public.favorite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_key VARCHAR(50) NOT NULL,
  token_address VARCHAR(255) NOT NULL, -- Contract address or 'native' for chain's native token
  token_symbol VARCHAR(20) NOT NULL,
  token_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one favorite per token per user per chain
  UNIQUE(user_id, chain_key, token_address)
);

-- Create index for faster lookups
CREATE INDEX idx_favorite_tokens_user_chain ON public.favorite_tokens(user_id, chain_key);
CREATE INDEX idx_favorite_tokens_token ON public.favorite_tokens(token_address);

-- Enable RLS
ALTER TABLE public.favorite_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own favorite tokens"
  ON public.favorite_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite tokens"
  ON public.favorite_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite tokens"
  ON public.favorite_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.favorite_tokens TO authenticated;

