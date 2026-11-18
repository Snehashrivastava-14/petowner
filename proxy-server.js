const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env');


if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
  
}

require('dotenv').config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Load API keys directly from .env using dotenv
const API_KEYS = {
    openai: process.env.OPENAI_API_KEY,
    nvidia: process.env.NVIDIA_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY
};

// Check if keys are placeholders
if (API_KEYS.openai && API_KEYS.openai.includes('your-')) {
    console.error('⚠️ WARNING: OpenAI key appears to be a placeholder!');
}
if (API_KEYS.nvidia && API_KEYS.nvidia.includes('your-')) {
    console.error('⚠️ WARNING: NVIDIA key appears to be a placeholder!');
}
if (API_KEYS.openrouter && API_KEYS.openrouter.includes('your-')) {
    console.error('⚠️ WARNING: OpenRouter key appears to be a placeholder!');
}

const API_CONFIG = {
    openai: 'https://api.openai.com/v1',
    nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1'
};

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Serve index.html for root
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve config.js dynamically from environment variables
app.get('/config.js', (req, res) => {
    const configContent = `// API Configuration
// This file is dynamically generated from environment variables

const API_KEYS = {
    // OpenAI API Key
    openai: '${process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY'}',

    // NVIDIA build.nvidia API Key
    nvidia: '${process.env.NVIDIA_API_KEY || 'YOUR_NVIDIA_API_KEY'}',

    // OpenRouter API Key
    openrouter: '${process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_API_KEY'}'
};

// Supabase Configuration
const SUPABASE_URL = '${process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL'}';
const SUPABASE_ANON_KEY = '${process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'}';
`;
    res.setHeader('Content-Type', 'application/javascript');
    res.send(configContent);
});


app.post('/api/chat/:provider', async (req, res) => {
    const { provider } = req.params;
    const { model, messages } = req.body;

   
    if (!API_CONFIG[provider]) {
        console.error(`Invalid provider: ${provider}`);
        return res.status(400).json({ error: 'Invalid provider' });
    }

    if (!API_KEYS[provider] || API_KEYS[provider].startsWith('YOUR_')) {
        console.error(`API key not configured for ${provider}`);
        return res.status(400).json({ error: `API key not configured for ${provider}` });
    }

    try {
        const url = provider === 'nvidia' ? API_CONFIG[provider] : `${API_CONFIG[provider]}/chat/completions`;
       
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEYS[provider]}`
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: 1000
            })
        });

        const responseText = await response.text();
     
        if (!response.ok) {
            console.error('API Error Response:', responseText);
            try {
                const data = JSON.parse(responseText);
                return res.status(response.status).json(data);
            } catch (e) {
                return res.status(response.status).json({ error: responseText });
            }
        }

        try {
            const data = JSON.parse(responseText);
            res.json(data);
        } catch (e) {
            console.error('Failed to parse JSON:', responseText.substring(0, 200));
            res.status(500).json({ error: 'Invalid JSON response from API', details: responseText.substring(0, 500) });
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    
});
