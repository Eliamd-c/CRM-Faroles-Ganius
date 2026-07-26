const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Credenciales de Supabase no encontradas en variables de entorno.');
    process.exit(1);
}

const s = createClient(supabaseUrl, supabaseKey);

async function resolve24hContacts() {
    console.log('🚀 Iniciando escaneo de contactos en la ventana de 24 horas...');

    // 1. Obtener configuraciones
    const { data: settingsData } = await s.from('settings').select('*');
    const token = settingsData?.find(row => row.key === 'page_access_token')?.value || process.env.META_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    const igId = settingsData?.find(row => row.key === 'instagram_account_id')?.value || process.env.INSTAGRAM_ACCOUNT_ID;

    if (!token || !igId || token.includes('your_page_access_token')) {
        console.error('❌ Error: Page Access Token o Instagram Account ID no configurados.');
        return;
    }

    try {
        const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
        const pageId = meRes.data.id;
        console.log(`✅ Página de Meta detectada: ID ${pageId}`);

        // 2. Obtener conversaciones recientes de la API de Meta
        console.log('🔍 Consultando hilos de conversación recientes en Meta Graph API...');
        const convUrl = `https://graph.facebook.com/v19.0/${pageId}/conversations?access_token=${token}&limit=50`;
        const convRes = await axios.get(convUrl);
        const conversations = convRes.data.data || [];

        const now = Date.now();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        const activeContactIds = new Set();
        const contactStats = {};

        // 3. Analizar cada conversación para identificar mensajes de las últimas 24 horas
        for (const conv of conversations) {
            try {
                const msgUrl = `https://graph.facebook.com/v19.0/${conv.id}?fields=messages.limit(20){id,created_time,message,from,to},updated_time&access_token=${token}`;
                const msgRes = await axios.get(msgUrl);
                const updatedTime = msgRes.data.updated_time ? new Date(msgRes.data.updated_time).getTime() : 0;
                const messages = msgRes.data.messages?.data || [];

                let is24h = (now - updatedTime) <= twentyFourHoursMs;

                // Verificar también cada mensaje individual
                for (const msg of messages) {
                    const msgTime = new Date(msg.created_time).getTime();
                    if ((now - msgTime) <= twentyFourHoursMs) {
                        is24h = true;
                        break;
                    }
                }

                if (is24h && messages.length > 0) {
                    const sampleMsg = messages[0];
                    let participant = null;
                    if (sampleMsg.from && sampleMsg.from.id !== igId) participant = sampleMsg.from;
                    else if (sampleMsg.to && sampleMsg.to.data && sampleMsg.to.data[0] && sampleMsg.to.data[0].id !== igId) participant = sampleMsg.to.data[0];
                    else if (sampleMsg.to && sampleMsg.to.id !== igId) participant = sampleMsg.to;

                    if (participant && participant.id) {
                        activeContactIds.add(participant.id);
                        contactStats[participant.id] = {
                            convId: conv.id,
                            lastActive: new Date(updatedTime || Date.now()).toLocaleString()
                        };
                    }
                }
            } catch (err) {
                // Continuar con otras conversaciones
            }
        }

        // 4. También consultar contactos locales cuya última actividad registrada esté en las últimas 24 horas
        const { data: dbContacts } = await s.from('contacts').select('*');
        if (dbContacts) {
            for (const c of dbContacts) {
                if (c.id && !c.id.startsWith('sim_') && !c.id.startsWith('test_') && c.last_message_received_at) {
                    const lastRec = new Date(c.last_message_received_at).getTime();
                    if ((now - lastRec) <= twentyFourHoursMs) {
                        activeContactIds.add(c.id);
                        if (!contactStats[c.id]) {
                            contactStats[c.id] = { convId: 'db_local', lastActive: new Date(lastRec).toLocaleString() };
                        }
                    }
                }
            }
        }

        const idsList = Array.from(activeContactIds);
        console.log(`\n⏰ Se encontraron ${idsList.length} personas con actividad en la ventana de 24 horas.`);

        if (idsList.length === 0) {
            console.log('ℹ️ No hay conversaciones en las últimas 24 horas para resolver.');
            return;
        }

        console.log('\n🔍 Obteniendo perfiles en tiempo real desde la API de Instagram...');
        let updatedCount = 0;
        const resolvedReports = [];

        // 5. Resolver nombres desde Meta Graph API
        for (const contactId of idsList) {
            let profileName = `Cliente ${contactId.substring(0, 6)}`;
            let profileUsername = `user_${contactId}`;
            let profilePic = null;

            try {
                const profUrl = `https://graph.facebook.com/v19.0/${contactId}?fields=name,username,profile_pic&access_token=${token}`;
                const profRes = await axios.get(profUrl);
                
                if (profRes.data.username) profileUsername = profRes.data.username;
                if (profRes.data.name && profRes.data.name !== 'Unknown') {
                    profileName = profRes.data.name;
                } else if (profRes.data.username) {
                    profileName = `@${profRes.data.username}`;
                }
                if (profRes.data.profile_pic) profilePic = profRes.data.profile_pic;

                // Actualizar o insertar en la base de datos de Supabase
                const existing = dbContacts?.find(c => c.id === contactId);
                const updates = {
                    id: contactId,
                    username: profileUsername,
                    name: profileName,
                    avatar_url: profilePic || existing?.avatar_url || null,
                    updated_at: new Date().toISOString()
                };

                if (existing) {
                    await s.from('contacts').update(updates).eq('id', contactId);
                } else {
                    await s.from('contacts').insert([{ ...updates, stage: 'Lead', flow_step: 'start', created_at: new Date().toISOString() }]);
                }

                updatedCount++;
                resolvedReports.push({
                    id: contactId,
                    name: profileName,
                    username: `@${profileUsername}`,
                    lastActive: contactStats[contactId]?.lastActive || 'Reciente'
                });
                console.log(`✅ Resuelto ID ${contactId} -> Nombre: "${profileName}" (@${profileUsername})`);
            } catch (err) {
                const errorMsg = err.response?.data?.error?.message || err.message;
                console.warn(`⚠️ No se pudo obtener perfil de Meta para ${contactId}: ${errorMsg}`);
            }
        }

        console.log(`\n🎉 Resumen de Identificación en Ventana de 24 Horas:`);
        console.table(resolvedReports);
        console.log(`\n✨ Total resueltos y actualizados en la base de datos: ${updatedCount} de ${idsList.length} contactos.`);

    } catch (err) {
        console.error('❌ Error durante la consulta a la Graph API de Meta:', err.response?.data || err.message);
    }
}

resolve24hContacts().then(() => process.exit(0));
