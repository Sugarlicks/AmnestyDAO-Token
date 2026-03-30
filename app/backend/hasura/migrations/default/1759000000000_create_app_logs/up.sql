-- ============================================================================
-- APP LOGS TABLE
-- ============================================================================
-- Stores client-side logs from mobile/web apps for debugging and monitoring
CREATE TABLE public.app_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    level text NOT NULL CHECK (level IN ('log', 'info', 'warn', 'error')),
    message text NOT NULL,
    context jsonb,
    user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
    device_info jsonb,
    app_version text,
    timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON public.app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON public.app_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON public.app_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON public.app_logs(created_at DESC);

-- Index for querying recent errors
CREATE INDEX IF NOT EXISTS idx_app_logs_error_recent ON public.app_logs(level, created_at DESC) 
    WHERE level = 'error';



