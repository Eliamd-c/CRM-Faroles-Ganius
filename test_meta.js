const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data } = await s.from('settings').select('*');
    const t = data.find(s => s.key === 'page_access_token')?.value;
    
    if(!t) return console.log('no token');
    
    try {
        const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${t}`);
        const pageId = meRes.data.id;
        console.log('Page:', pageId);
        const { data: set } = await s.from('settings').select('*');
        const igId = set.find(s => s.key === 'instagram_account_id')?.value;
        const convUrl = `https://graph.facebook.com/v19.0/${pageId}/conversations?access_token=${t}&limit=45`;
        console.log('Fetching convs for igId:', igId);
        const convRes = await axios.get(convUrl);
        console.log('Convs:', convRes.data.data.length);


        /*
        if (convRes.data.data.length > 0) {
            const conv = convRes.data.data[0];
            const msgUrl = `https://graph.facebook.com/v19.0/${conv.id}?fields=messages.limit(20){id,created_time,message,from,to}&access_token=${t}`;
            const msgRes = await axios.get(msgUrl);
            console.log('Msgs fetched');
        }
        */

    } catch(e) {
        console.error('Error:', e.response?.data || e.message);
    }
}
test();
