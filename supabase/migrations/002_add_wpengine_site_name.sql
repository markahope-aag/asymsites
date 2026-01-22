-- Add WPEngine site name field to distinguish between proper site name and install ID
ALTER TABLE public.sites 
ADD COLUMN wpengine_site_name text;

-- Add comment to clarify the difference
COMMENT ON COLUMN public.sites.wpengine_site_name IS 'Proper WPEngine site name (client-friendly)';
COMMENT ON COLUMN public.sites.wpengine_install_id IS 'WPEngine install/environment name (technical identifier)';