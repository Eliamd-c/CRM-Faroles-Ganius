const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Credenciales de Supabase no encontradas.');
    process.exit(1);
}

const s = createClient(supabaseUrl, supabaseKey);

async function recoverHistorySinceJuly() {
    console.log('🚀 Iniciando recuperación histórica de contactos y mensajes desde Meta...');

    const { data: settingsData } = await s.from('settings').select('*');
    const token = settingsData?.find(row => row.key === 'page_access_token')?.value || process.env.META_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    const igId = settingsData?.find(row => row.key === 'instagram_account_id')?.value || process.env.INSTAGRAM_ACCOUNT_ID;

    if (!token || !igId || token.includes('your_page_access_token')) {
        console.error('❌ Error: Token de Meta no disponible.');
        return;
    }

    try {
        const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
        const pageId = meRes.data.id;
        console.log(`✅ Página detectada: ${meRes.data.name} (ID: ${pageId})`);

        let url = `https://graph.facebook.com/v19.0/${pageId}/conversations?access_token=${token}&limit=50`;
        let allConvs = [];
        let pagesFetched = 0;

        while (url && pagesFetched < 4) {
            const res = await axios.get(url);
            if (res.data.data) allConvs.push(...res.data.data);
            url = res.data.paging?.next || null;
            pagesFetched++;
        }

        console.log(`🔍 Total de hilos recuperados de Meta: ${allConvs.length}`);

        // Fecha de corte: 21 de julio del año actual (o 2025/2026 para asegurar captura)
        const cutoffDate = new Date('2025-07-21T00:00:00Z').getTime();

        const { data: dbContacts } = await s.from('contacts').select('*');
        let recoveredContacts = 0;
        let recoveredMessages = 0;
        const report = [];

        for (const conv of allConvs) {
            try {
                const msgUrl = `https://graph.facebook.com/v19.0/${conv.id}?fields=messages.limit(50){id,created_time,message,from,to}&access_token=${token}`;
                const msgRes = await axios.get(msgUrl);
                const messagesData = msgRes.data.messages?.data || [];

                if (messagesData.length === 0) continue;

                // Filtrar mensajes desde la fecha de corte
                const recentMessages = messagesData.filter(m => new Date(m.created_time).getTime() >= cutoffDate);
                if (recentMessages.length === 0 && messagesData.length > 0) {
                    // Aunque sean anteriores, revisamos si podemos cualificar el contacto
                }

                // Identificar al cliente
                const sampleMsg = messagesData[0];
                let participant = null;
                if (sampleMsg.from && sampleMsg.from.id !== igId) participant = sampleMsg.from;
                else if (sampleMsg.to && sampleMsg.to.data && sampleMsg.to.data[0] && sampleMsg.to.data[0].id !== igId) participant = sampleMsg.to.data[0];
                else if (sampleMsg.to && sampleMsg.to.id !== igId) participant = sampleMsg.to;

                const contactId = participant?.id;
                if (!contactId) continue;

                // Consultar perfil en la Graph API de Meta en tiempo real
                let profileName = (participant && participant.name && participant.name !== 'Unknown')
                    ? participant.name
                    : (participant && participant.username ? `@${participant.username}` : `Cliente ${contactId.substring(0, 6)}`);
                let profileUsername = participant?.username || `user_${contactId}`;
                let profilePic = null;

                try {
                    const profUrl = `https://graph.facebook.com/v19.0/${contactId}?fields=name,username,profile_pic&access_token=${token}`;
                    const profRes = await axios.get(profUrl);
                    if (profRes.data.username) profileUsername = profRes.data.username;
                    if (profRes.data.name && profRes.data.name !== 'Unknown') {
                        profileName = profRes.data.name;
                    } else if (profRes.data.username && profileName.startsWith('Cliente ')) {
                        profileName = `@${profRes.data.username}`;
                    }
                    if (profRes.data.profile_pic) profilePic = profRes.data.profile_pic;
                } catch (e) {
                    // Ignore error individual de perfil si ya tenemos nombre del participante
                }

                // Actualizar en base de datos
                const existingContact = dbContacts?.find(c => c.id === contactId);
                const contactData = {
                    id: contactId,
                    username: profileUsername,
                    name: profileName,
                    avatar_url: profilePic || existingContact?.avatar_url || null,
                    updated_at: new Date().toISOString()
                };

                if (existingContact) {
                    await s.from('contacts').update(contactData).eq('id', contactId);
                } else {
                    await s.from('contacts').insert([{
                        ...contactData,
                        stage: 'Lead',
                        flow_step: 'start',
                        created_at: new Date(sampleMsg.created_time).toISOString()
                    }]);
                }
                recoveredContacts++;

                // Asegurar conversación y mensajes en la tabla de Supabase
                const convId = `conv_${contactId}`;
                const { data: existingConv } = await s.from('conversations').select('id').eq('id', convId).single();
                if (!existingConv) {
                    await s.from('conversations').insert([{
                        id: convId,
                        contact_id: contactId,
                        last_message: sampleMsg.message || 'Media',
                        last_message_time: new Date(sampleMsg.created_time).toISOString(),
                        unread_count: 0
                    }]);
                } else {
                    await s.from('conversations').update({
                        last_message: sampleMsg.message || 'Media',
                        last_message_time: new Date(sampleMsg.created_time).toISOString()
                    }).eq('id', convId);
                }

                // Guardar mensajes
                for (let i = messagesData.length - 1; i >= 0; i--) {
                    const m = messagesData[i];
                    if (!m.message) continue;
                    const { data: exists } = await s.from('messages').select('id').eq('conversation_id', convId).eq('text', m.message).limit(1);
                    if (!exists || exists.length === 0) {
                        await s.from('messages').insert([{
                            conversation_id: convId,
                            sender_id: m.from?.id || 'unknown',
                            sender_type: (m.from?.id === igId || m.from?.id === pageId) ? 'bot' : 'user',
                            text: m.message,
                            timestamp: new Date(m.created_time).toISOString(),
                            created_at: new Date(m.created_time).toISOString()
                        }]);
                        recoveredMessages++;
                    }
                }

                report.push({
                    id: contactId,
                    nombre: profileName,
                    usuario: `@${profileUsername}`,
                    hilo: conv.id,
                    msjs_rescatados: messagesData.length
                });

                console.log(`✅ Rescatado contacto: "${profileName}" (@${profileUsername}) - ${messagesData.length} msjs analizados.`);
            } catch (err) {
                // Continue
            }
        }

        console.log(`\n🎉 Resumen de Rescate Histórico:`);
        console.table(report.slice(0, 15));
        console.log(`\n✨ Total perfiles resueltos/actualizados en CRM: ${recoveredContacts}`);
        console.log(`✨ Total mensajes nuevos insertados en historial: ${recoveredMessages}`);

    } catch (err) {
        console.error('❌ Error:', err.response?.data || err.message);
    }
}

recoverHistorySinceJuly().then(() => process.exit(0));
