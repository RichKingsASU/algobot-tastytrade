
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Define the base URL for the Tastytrade API
const TASTYTRADE_BASE_URL = Deno.env.get('TASTYTRADE_BASE_URL') || 'https://api.tastytrade.com';

serve(async (req) => {
  try {
    const { method, url, headers } = req;
    const requestUrl = new URL(url);

    // Extract path variables from the request URL if any
    const pathVariables: Record<string, string> = {};
    

    // Extract query parameters from the incoming request
    const queryParams = new URLSearchParams(requestUrl.search);

    // Extract request body if present
    let requestBody: any;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try {
        requestBody = await req.json();
      } catch (e) {
        // Handle cases where body might be empty or not JSON
        requestBody = null;
      }
    }

    // Construct the target Tastytrade API URL
    let tastytradeApiUrl = `${TASTYTRADE_BASE_URL}/customers/me`;

    // Replace path variables in tastytradeApiUrl
    for (const key in pathVariables) {
      tastytradeApiUrl = tastytradeApiUrl.replace(`:${key}`, pathVariables[key]);
    }

    // Append query parameters from the incoming request
    if (queryParams.toString()) {
      tastytradeApiUrl += `${tastytradeApiUrl.includes('?') ? '&' : '?'}${queryParams.toString()}`;
    }

    // Prepare headers for the Tastytrade API request
    const tastytradeHeaders = new Headers();
    // Copy relevant headers from incoming request
    headers.forEach((value, key) => {
      // Exclude host and other headers that might cause issues
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        tastytradeHeaders.set(key, value);
      }
    });

    // Ensure Authorization header is set from tt_auth_token environment variable
    const ttAuthToken = Deno.env.get('TT_AUTH_TOKEN');
    if (ttAuthToken) {
      tastytradeHeaders.set('Authorization', `Bearer ${ttAuthToken}`);
    } else {
      console.warn('TT_AUTH_TOKEN environment variable not set.');
      return new Response(JSON.stringify({ error: 'Tastytrade authentication token not found.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Make the request to the Tastytrade API
    const tastytradeResponse = await fetch(tastytradeApiUrl, {
      method: method,
      headers: tastytradeHeaders,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });

    // Read the response body as text
    const responseBody = await tastytradeResponse.text();

    // Return the Tastytrade API response directly
    return new Response(responseBody, {
      status: tastytradeResponse.status,
      headers: tastytradeResponse.headers,
    });
  } catch (error) {
    console.error('Error in Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
