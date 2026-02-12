const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- 輔助函數：取得 Google Access Token (OAuth2 模式) ---
async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
    console.log('Step 1: Refreshing Google Access Token...');

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const data = await res.json();
    if (data.error) {
        console.error('OAuth token exchange error:', data);
        throw new Error(`Google Auth Error: ${data.error_description || data.error}`);
    }

    console.log('Step 2: Access Token acquired successfully.');
    return data.access_token;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('--- Edge Function v6 (OAuth2 Mode) received request ---');
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            throw new Error('No file found in request');
        }

        const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
        const folderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');

        if (!clientId || !clientSecret || !refreshToken || !folderId) {
            console.error('Missing secrets:', {
                clientId: !!clientId,
                clientSecret: !!clientSecret,
                refreshToken: !!refreshToken,
                folderId: !!folderId
            });
            throw new Error('Server configuration missing (OAuth2 Secrets not set)');
        }

        console.log(`Processing file: ${file.name} (${file.size} bytes)`);

        // 1. 取得 Access Token
        const token = await getGoogleAccessToken(clientId, clientSecret, refreshToken);

        // 2. 建立檔案元數據 (Metadata)
        const metadata = {
            name: `${Date.now()}_${file.name}`,
            parents: [folderId]
        };

        console.log('Step 3: Uploading to Google Drive...');
        const multipartFormData = new FormData();
        multipartFormData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        multipartFormData.append('file', file);

        const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: multipartFormData
        });

        const driveData = await driveRes.json();
        if (driveData.error) {
            console.error('Drive API Error Body:', driveData.error);
            throw new Error(`Drive API Error: ${driveData.error.message}`);
        }

        console.log('Step 4: Upload successful. Drive ID:', driveData.id);

        return new Response(
            JSON.stringify({
                driveId: driveData.id,
                url: driveData.webViewLink
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error('Critical Function Error:', error.message);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
