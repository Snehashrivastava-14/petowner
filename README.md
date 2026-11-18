# Pet Owner Dashboard

Pet management dashboard with AI-powered pet care assistance. Features include pet profiles, appointment booking, prescription tracking, and medical history.

## Features

- User authentication (Supabase)
- Pet management (add, view, delete profiles)
- Appointment booking system
- Prescription tracking with dosage instructions
- Medical history records
- AI assistant with multiple providers (OpenAI, NVIDIA, OpenRouter)

## Quick Start

1. Set up Supabase (see below)
2. Open `index.html` in your browser
3. Sign up for an account
4. Start managing your pets

## Setup

### Supabase Backend (Required)

1. **Create a Supabase Project**
   - Go to https://supabase.com and sign up
   - Create a new project

2. **Run the SQL Schema**
   - In Supabase dashboard, go to SQL Editor
   - Copy and run the contents of `supabase-schema.sql`

3. **Configure API Keys**
   - In Supabase dashboard, go to Settings > API
   - Copy your project URL and anon key
   - Add to your `.env` file:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   - Run `node setup-env.js` to generate `config.js`

4. **Disable Email Verification (Optional)**
   - In Supabase dashboard, go to Authentication > Providers
   - Disable email confirmation for easier testing

### For AI Features (Optional)

Create a `.env` file (copy from `.env.example`):
```
OPENAI_API_KEY=your_key
NVIDIA_API_KEY=your_key
OPENROUTER_API_KEY=your_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run setup:
```bash
npm install
node setup-env.js
```

### CORS Proxy (for OpenAI/NVIDIA)

```bash
npm run proxy
```

Server runs on `http://localhost:3001`

## Data Storage

All data stored in Supabase cloud database, accessible from any device.

## Tech Stack

- HTML5, JavaScript (ES6+)
- Tailwind CSS (CDN)
- Font Awesome (CDN)
- Supabase (backend database & auth)
- AI APIs: OpenAI, NVIDIA, OpenRouter

## File Structure

```
index.html              # Main application
app.js                  # Application logic
config.js               # Generated from .env (not in git)
supabase-schema.sql     # Database schema for Supabase
proxy-server.js         # CORS proxy for AI APIs
setup-env.js            # Config generator
package.json            # Dependencies
.env                    # API keys (not in git)
```

## License

Provided as-is for educational purposes.

