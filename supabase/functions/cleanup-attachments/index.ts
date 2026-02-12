import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// --- 輔助函數：取得 Google Access Token (OAuth2 模式) ---
async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
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
    if (data.error) throw new Error(`Google Auth Error: ${data.error_description || data.error}`);
    return data.access_token;
}

Deno.serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

        if (!clientId || !clientSecret || !refreshToken) {
            throw new Error('OAuth2 Secrets not set');
        }

        // 1. 找出所有已過期且尚未標記為已刪除的附件
        const now = new Date().toISOString()
        const { data: expiredRequests, error } = await supabase
            .from('leave_requests')
            .select('id, attachment_drive_id')
            .lt('attachment_expires_at', now)
            .not('attachment_drive_id', 'is', null)

        if (error) throw error

        if (expiredRequests && expiredRequests.length > 0) {
            console.log(`Found ${expiredRequests.length} expired attachments to clean up.`)

            // 2. 取得 Access Token
            const token = await getGoogleAccessToken(clientId, clientSecret, refreshToken);

            for (const r of expiredRequests) {
                console.log(`Deleting file from Drive: ${r.attachment_drive_id}`)

                try {
                    // 3. 呼叫 Google Drive API 刪除檔案
                    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${r.attachment_drive_id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (driveRes.status === 204 || driveRes.status === 404) {
                        // 4. 更新資料庫，移除附件資訊
                        await supabase
                            .from('leave_requests')
                            .update({
                                attachment_drive_id: null,
                                attachment_url: null,
                                attachment_name: '[已過期刪除]'
                            })
                            .eq('id', r.id)
                    } else {
                        const errorData = await driveRes.json();
                        console.error(`Failed to delete file ${r.attachment_drive_id}:`, errorData);
                    }
                } catch (err) {
                    console.error(`Error deleting file ${r.attachment_drive_id}:`, err);
                }
            }
        }

        return new Response(JSON.stringify({ success: true, count: expiredRequests?.length || 0 }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Cleanup Function error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})
