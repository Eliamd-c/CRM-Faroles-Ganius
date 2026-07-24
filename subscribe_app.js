const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAndSubscribe() {
    const { data } = await s.from('settings').select('*');
    const t = data.find(s => s.key === 'page_access_token')?.value;
    if (!t) return console.log('❌ No hay page_access_token en la base de datos');

    try {
        const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${t}`);
        const pageId = meRes.data.id;
        console.log('📄 Page ID:', pageId, 'Name:', meRes.data.name);

        // Check current subscriptions
        const subRes = await axios.get(`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?access_token=${t}`);
        console.log('📌 Apps actualmente suscritas:', JSON.stringify(subRes.data, null, 2));

        // Subscribe Page to Webhook events
        const fields = 'messages,messaging_postbacks,message_deliveries,message_reads,message_echoes,conversations';
        const postRes = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=${fields}&access_token=${t}`);
        console.log('✅ Resultado de suscripción:', JSON.stringify(postRes.data, null, 2));

    } catch (e) {
        console.error('❌ Error en suscripción:', e.response?.data || e.message);
    }
}

checkAndSubscribe();
