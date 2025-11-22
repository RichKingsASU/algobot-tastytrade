import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const TASTY_API_URL = 'https://api.tastyworks.com'; // Use the production environment

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY environment variables must be set.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TastytradeSession {
    email: string;
    username: string;
    external_id: string;
    session_token: string;
    remember_token: string;
    session_expiration: string;
}

async function getLatestTokens(): Promise<TastytradeSession | null> {
    const { data, error } = await supabase
        .from('tastytrade_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching latest tokens from Supabase:', error);
        return null;
    }

    return data && data.length > 0 ? data[0] : null;
}

async function createSessionWithRememberToken(rememberToken: string): Promise<any> {
    const payload = {
        "login": process.env.TASTYTRADE_USERNAME,
        "remember-token": rememberToken,
        "remember-me": true,
    };

    const headers = { "Content-Type": "application/json" };
    const response = await axios.post(`${TASTY_API_URL}/sessions`, payload, { headers });

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`❌ Login failed: ${response.status} - ${response.data}`);
    }

    return response.data.data;
}

async function storeSession(tokens: any): Promise<void> {
    const last = await getLatestTokens();
    const { error } = await supabase.from('tastytrade_sessions').insert([
        {
            email: process.env.TASTYTRADE_USERNAME,
            username: last ? last.username : 'unknown',
            external_id: last ? last.external_id : null,
            session_token: tokens['session-token'],
            remember_token: tokens['remember-token'],
            session_expiration: tokens['session-expiration'],
        },
    ]);

    if (error) {
        console.error('Error storing session in Supabase:', error);
    } else {
        console.log('✅ Session updated in Supabase.');
    }
}

async function getValidSessionToken(): Promise<string> {
    const last = await getLatestTokens();
    if (!last) {
        throw new Error('❌ No remember-token found. Please log in manually once.');
    }
    const newTokens = await createSessionWithRememberToken(last.remember_token);
    await storeSession(newTokens);
    return newTokens['session-token'];
}

export async function getOrRefreshApiQuoteToken(): Promise<{ token: string; dxlinkUrl: string }> {
    const sessionToken = await getValidSessionToken();

    const response = await axios.get(`${TASTY_API_URL}/api-quote-tokens`, {
        headers: {
            Authorization: sessionToken,
        },
    });

    return {
        token: response.data.data.token,
        dxlinkUrl: response.data.data['dxlink-url'],
    };
}