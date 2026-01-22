# AsymSites - WordPress Site Health Dashboard

A comprehensive WordPress site health monitoring dashboard built for Asymmetric Marketing. Monitor multiple WordPress sites hosted on WPEngine with Cloudflare integration for performance analytics.

## Features

- **Comprehensive Site Auditing**: Plugin management, database health, performance monitoring, security scanning, and SEO analysis
- **Real-time Dashboard**: Health scores, issue tracking, and progress monitoring
- **Cloudflare Integration**: Performance metrics, cache hit ratios, and threat monitoring
- **WPEngine Integration**: Direct server access via SSH and WP-CLI
- **Automated Actions**: Plugin updates, cache clearing, and database optimization

## Quick Start

### 1. Environment Setup

Copy the environment template and configure your settings:

```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cloudflare API Token (with Zone:Read and Analytics:Read permissions)
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token

# WPEngine SSH Private Key
WPENGINE_SSH_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
your_private_key_content_here
-----END OPENSSH PRIVATE KEY-----"
```

### 2. Database Setup

Run the Supabase migrations:

```bash
# Apply the database schema
supabase db push
```

### 3. Import Sites and Zones

```bash
# Import sites from WPEngine
npx tsx scripts/import-wpengine-sites.ts

# Import and match Cloudflare zones
npx tsx scripts/import-cloudflare-zones.ts

# Or seed with example data
npx tsx scripts/seed-sites.ts
```

### 4. Start Development Server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## API Configuration

### Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a custom token with these permissions:
   - **Zone:Read** - for zone information
   - **Analytics:Read** - for performance metrics
3. Include all zones you want to monitor

### WPEngine SSH Setup

1. Generate an SSH key pair:
   ```bash
   ssh-keygen -t rsa -b 4096 -f wpengine_key
   ```
2. Add the public key (`wpengine_key.pub`) to your WPEngine account
3. Add the private key content to your `.env.local` file

## Troubleshooting

### Cloudflare API Issues

The app uses Cloudflare's GraphQL API for analytics (the REST Analytics API was sunset). If you encounter issues:

1. **Authentication errors**: Verify your `CLOUDFLARE_API_TOKEN` is correct
2. **Permission errors**: Ensure your token has `Zone:Read` and `Analytics:Read` permissions
3. **Zone not found**: Check that zone IDs in the database match your Cloudflare zones

Test your Cloudflare configuration:
```bash
node debug-cloudflare.js
```

### WPEngine SSH Issues

1. **Key format**: Ensure the private key is in OpenSSH format
2. **Permissions**: Verify the public key is added to your WPEngine account
3. **Install names**: Check that `wpengine_install_id` matches your actual install names

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run test suite
- `npm run lint` - Run ESLint

## Architecture

- **Frontend**: Next.js 16 with React 19 and TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4
- **APIs**: Cloudflare GraphQL, WPEngine SSH/WP-CLI
- **Testing**: Vitest

## License

Private project for Asymmetric Marketing.
