const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const s = createClient(supabaseUrl, supabaseKey);

async function fixAllNamesAndChats() {
    console.log('🚀 Iniciando reparación definitiva de nombres y mensajes desde Meta...');

    const { data: settingsData } = await s.from('settings').select('*');
    const token = settingsData?.find(row => row.key === 'page_access_token')?.value || process.env.META_PAGE_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN;
    const configuredIgId = settingsData?.find(row => row.key === 'instagram_account_id')?.value || process.env.INSTAGRAM_ACCOUNT_ID;

    if (!token) {
        console.error('❌ Token no disponible.');
        return;
    }

    try {
        const meRes = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
        const pageId = meRes.data.id;
        console.log(`✅ Página detectada: ${meRes.data.name} (ID: ${pageId})`);

        // Actualizar instagram_account_id en settings si está desalineado
        if (configuredIgId !== pageId) {
            console.log(`⚠️ Sincronizando ID de la página en settings DB: ${pageId}`);
            await s.from('settings').upsert({ key: 'instagram_account_id', value: pageId, updated_at: new Date().toISOString() });
        }

        let url = `https://graph.facebook.com/v19.0/${pageId}/conversations?access_token=${token}&limit=50`;
        let allConvs = [];
        let pagesFetched = 0;

        while (url && pagesFetched < 10) {
            const res = await axios.get(url);
            if (res.data.data) allConvs.push(...res.data.data);
            url = res.data.paging?.next || null;
            pagesFetched++;
        }

        console.log(`🔍 Analizando ${allConvs.length} hilos de conversación...`);

        const { data: dbContacts } = await s.from('contacts').select('*');
        let fixedCount = 0;
        let msgsInserted = 0;

        for (const conv of allConvs) {
            try {
                const msgUrl = `https://graph.facebook.com/v19.0/${conv.id}?fields=messages.limit(25){id,created_time,message,from,to,attachments}&access_token=${token}`;
                const msgRes = await axios.get(msgUrl);
                const messagesData = msgRes.data.messages?.data || [];

                if (messagesData.length === 0) continue;

                // Identificar quién es el CLIENTE (no la empresa/bot)
                let customer = null;
                for (const m of messagesData) {
                    if (m.from && m.from.id !== pageId && m.from.id !== configuredIgId && m.from.name !== meRes.data.name) {
                        customer = m.from;
                        break;
                    }
                    if (m.to && m.to.data) {
                        for (const t of m.to.data) {
                            if (t.id !== pageId && t.id !== configuredIgId && t.name !== meRes.data.name) {
                                customer = t;
                                break;
                            }
                        }
                    }
                    if (customer) break;
                }

                if (!customer || !customer.id) continue;
                const contactId = customer.id;

                let profileName = (customer.name && customer.name !== 'Unknown') ? customer.name : `Cliente ${contactId.substring(0, 6)}`;
                let profileUsername = customer.username || `user_${contactId}`;
                let profilePic = null;

                // Intentar enriquecer desde la Graph API
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
                    // Ignore
                }

                // Guardar/Actualizar Contacto con su Nombre Real
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
                        created_at: new Date(messagesData[0].created_time).toISOString()
                    }]);
                }
                fixedCount++;

                // Asegurar Conversación con Último Mensaje visible
                const sampleMsg = messagesData[0];
                const convId = `conv_${contactId}`;
                const lastMsgText = sampleMsg.message || (sampleMsg.attachments ? '📎 Archivo adjunto' : 'Mensaje');
                
                const { data: existingConv } = await s.from('conversations').select('id').eq('id', convId).limit(1);
                if (!existingConv || existingConv.length === 0) {
                    const resConv = await s.from('conversations').insert([{
                        id: convId,
                        contact_id: contactId,
                        last_message_time: new Date(sampleMsg.created_time).toISOString(),
                        unread_count: 0
                    }]);
                    if (resConv.error) console.error(`❌ Error insert conv ${convId}:`, resConv.error.message);
                } else {
                    await s.from('conversations').update({
                        last_message_time: new Date(sampleMsg.created_time).toISOString()
                    }).eq('id', convId);
                }

                // Sincronizar todos los mensajes del hilo
                for (let i = messagesData.length - 1; i >= 0; i--) {
                    const m = messagesData[i];
                    let text = m.message || '';
                    const storyReplyUrl = m.reply_to?.story?.url || null;
                    const attachType = m.attachments?.data?.[0]?.type || null;
                    let mediaUrl = m.attachments?.data?.[0]?.image_data?.url || m.attachments?.data?.[0]?.video_data?.url || null;

                    if (storyReplyUrl) {
                        mediaUrl = storyReplyUrl;
                        if (!text.startsWith('[STORY_REPLY]')) text = `[STORY_REPLY] ${text || 'Respondió a tu historia'}`;
                    } else if (attachType === 'story_mention' || attachType === 'share') {
                        if (!text) text = `[STORY_MENTION] Te mencionó en su historia`;
                        else if (!text.startsWith('[STORY_MENTION]')) text = `[STORY_MENTION] ${text}`;
                    } else if (mediaUrl && !text) {
                        text = `[ATTACHMENT] 📎 Archivo multimedia`;
                    } else if (!text && !mediaUrl) {
                        text = '📎 Archivo adjunto';
                    }

                    const { data: exists } = await s.from('messages').select('id').eq('conversation_id', convId).eq('timestamp', new Date(m.created_time).toISOString()).limit(1);
                    if (!exists || exists.length === 0) {
                        const isBot = (m.from?.id === pageId || m.from?.name === meRes.data.name);
                        const resMsg = await s.from('messages').insert([{
                            conversation_id: convId,
                            sender_id: isBot ? pageId : contactId,
                            recipient_id: isBot ? contactId : pageId,
                            sender_type: isBot ? 'bot' : 'customer',
                            direction: isBot ? 'outgoing' : 'incoming',
                            text: text,
                            media_url: mediaUrl,
                            timestamp: new Date(m.created_time).toISOString(),
                            created_at: new Date(m.created_time).toISOString()
                        }]);
                        if (resMsg.error) console.error(`❌ Error insert msj en ${convId}:`, resMsg.error.message);
                        else msgsInserted++;
                    }
                }

                console.log(`✅ Resuelto: "${profileName}" (ID: ${contactId}) - Último msj: "${lastMsgText.substring(0, 30)}"`);
            } catch (err) {
                // Continue
            }
        }

        console.log(`\n✨ ¡Reparación completada con éxito!`);
        console.log(`✨ Total contactos actualizados con su nombre propio: ${fixedCount}`);
        console.log(`✨ Total mensajes insertados en el historial: ${msgsInserted}`);

    } catch (err) {
        console.error('❌ Error en reparación:', err.message);
    }
}

fixAllNamesAndChats().then(() => process.exit(0));
