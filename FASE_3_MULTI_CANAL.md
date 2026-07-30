# FASE 3: INTEGRACIÓN MULTI-CANAL - Plan Detallado de Desarrollo

**Duración**: 4 semanas (160 horas)  
**Equipo**: 2 Backend Developers + 1 Frontend Developer + 1 DevOps + 1 QA  
**Objetivo**: Soportar múltiples canales como ManyChat (Instagram, WhatsApp, Facebook Messenger)  
**Resultado**: CRM completamente multi-canal con envío y recepción en tiempo real

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura Multi-Canal](#arquitectura-multi-canal)
3. [Integración Instagram](#integración-instagram)
4. [Integración WhatsApp](#integración-whatsapp)
5. [Integración Facebook Messenger](#integración-facebook-messenger)
6. [Queue System](#queue-system)
7. [Tareas de Desarrollo](#tareas-de-desarrollo)
8. [Código de Ejemplo](#código-de-ejemplo)
9. [Testing Plan](#testing-plan)

---

## Resumen Ejecutivo

### De Genérico a Multi-Canal

**Cambio principal**: Transformar el sistema de "canal genérico" a uno que soporte múltiples canales con sus respectivas APIs y formatos.

| Aspecto | Antes | Después | Complejidad |
|---------|-------|---------|-------------|
| Canales | Genérico | Instagram/WA/Messenger | Alta |
| APIs externas | 0 | 3 | Alta |
| Webhooks | 1 (genérico) | 3 (canal-específicos) | Alta |
| Autenticación | Simple | OAuth 2.0 + Tokens | Media |
| Rate limiting | No | Sí (por canal) | Media |
| Queue de mensajes | No | Sí (RabbitMQ/Redis) | Alta |
| Errores/Retries | Básico | Robusto | Media |

### Stack Nuevo

```
Autenticación:
  ├─ Instagram Graph API (v18.0+)
  ├─ WhatsApp Business API (Meta)
  └─ Facebook Messenger Platform

Webhooks:
  ├─ POST /webhook/instagram
  ├─ POST /webhook/whatsapp
  └─ POST /webhook/messenger

Mensajería:
  ├─ Queue: Redis/RabbitMQ
  ├─ Workers: Node.js queue processors
  └─ Retry logic: Exponential backoff

Rate Limiting:
  ├─ Instagram: 200 req/hora
  ├─ WhatsApp: 1000 msg/día (tier dependiente)
  └─ Messenger: 600 calls/min
```

---

## Arquitectura Multi-Canal

### Estructura de Directorios

```
server/
├── channels/
│  ├── base-channel.js        (clase abstracta)
│  ├── instagram-channel.js   (implementación)
│  ├── whatsapp-channel.js    (implementación)
│  ├── messenger-channel.js   (implementación)
│  └── channel-factory.js     (factory pattern)
│
├── webhooks/
│  ├── instagram-webhook.js
│  ├── whatsapp-webhook.js
│  ├── messenger-webhook.js
│  └── webhook-validator.js
│
├── queue/
│  ├── queue-worker.js        (procesador de cola)
│  ├── queue-config.js        (configuración)
│  ├── retry-handler.js       (reintentos)
│  └── queue-tests.js
│
├── rate-limit/
│  ├── rate-limiter.js
│  └── channel-limits.js
│
├── models/
│  ├── channel-account.js     (credenciales del canal)
│  ├── channel-message.js     (mensaje enviado)
│  └── webhook-log.js         (log de webhooks)
│
└── routes/
   ├── channels.js             (CRUD de canales)
   └── webhook.js              (handlers de webhooks)
```

### Clase Base: Channel

```javascript
// Todos los canales heredan de esto
class BaseChannel {
  constructor(credentials) {
    this.credentials = credentials;
    this.apiBaseUrl = null;
  }

  // Métodos que TODO canal debe implementar
  async sendMessage(recipientId, message) {
    throw new Error('Not implemented');
  }

  async sendMedia(recipientId, media, caption) {
    throw new Error('Not implemented');
  }

  async sendTemplate(recipientId, templateId, variables) {
    throw new Error('Not implemented');
  }

  async getContact(contactId) {
    throw new Error('Not implemented');
  }

  async updateContact(contactId, data) {
    throw new Error('Not implemented');
  }

  async validateWebhook(payload, signature) {
    throw new Error('Not implemented');
  }

  // Métodos helper
  async rateLimit() {
    // Verificar y aplicar rate limiting
  }

  async logMessage(messageData) {
    // Registrar mensaje
  }
}

module.exports = BaseChannel;
```

### Factory Pattern

```javascript
// channels/channel-factory.js
const InstagramChannel = require('./instagram-channel');
const WhatsAppChannel = require('./whatsapp-channel');
const MessengerChannel = require('./messenger-channel');

class ChannelFactory {
  static createChannel(type, credentials) {
    switch (type.toLowerCase()) {
      case 'instagram':
        return new InstagramChannel(credentials);
      case 'whatsapp':
        return new WhatsAppChannel(credentials);
      case 'messenger':
        return new MessengerChannel(credentials);
      default:
        throw new Error(`Unknown channel type: ${type}`);
    }
  }

  static getChannelInstance(accountId, supabase) {
    // Buscar cuenta en DB, obtener credenciales, crear instancia
  }
}

module.exports = ChannelFactory;
```

---

## Integración Instagram

### 1. Requisitos Previos

```
1. App de Facebook Developer (ya creada)
2. Instagram Business Account
3. Página de Facebook vinculada
4. Permisos necesarios:
   - instagram_basic
   - instagram_manage_messages
   - instagram_manage_pages
   - page_messaging
   - pages_read_engagement
   - pages_read_user_content
   - pages_manage_messaging
```

### 2. Autenticación & Tokens

```javascript
// Flujo OAuth 2.0 estándar de Facebook
const instagramAuth = {
  // Step 1: Redirect usuario a Facebook
  authUrl: `https://www.facebook.com/v18.0/dialog/oauth?
    client_id=YOUR_APP_ID
    &redirect_uri=https://yourapp.com/auth/instagram/callback
    &scope=instagram_basic,instagram_manage_messages,pages_messaging
    &response_type=code`,

  // Step 2: Intercambiar code por token
  exchangeCode: async (code) => {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/oauth/access_token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: 'https://yourapp.com/auth/instagram/callback',
          code: code
        })
      }
    );
    return response.json();
  },

  // Step 3: Obtener Page Access Token (token a largo plazo)
  getPageToken: async (userAccessToken) => {
    const response = await fetch(
      `https://graph.instagram.com/me/accounts?access_token=${userAccessToken}`
    );
    const data = response.json();
    // Retorna: { id, name, access_token (page token) }
    return data.accounts[0].access_token;
  }
};
```

### 3. Modelo de Datos - Canal Instagram

```javascript
{
  id: "channel_ig_1",
  flowId: "flow_abc123",
  type: "instagram",
  
  // Credenciales
  credentials: {
    pageAccessToken: "EAACCC...",         // Long-lived token
    pageId: "123456789",                  // Facebook Page ID
    instagramBusinessAccountId: "987654", // IG Business Account ID
    instagramHandle: "@faroles_rusticos"
  },
  
  // Configuración
  config: {
    autoReplyEnabled: true,
    autoReplyMessage: "Hola! Gracias por tu mensaje...",
    webhookUrl: "https://yourapp.com/webhook/instagram",
    rateLimit: "200/hour" // Instagram limit
  },
  
  // Metadata
  status: "active|inactive|expired",
  lastWebhookReceived: "2026-07-30T10:30:00Z",
  lastMessageSent: "2026-07-30T10:25:00Z",
  
  createdAt: "2026-07-30T10:00:00Z",
  updatedAt: "2026-07-30T10:00:00Z"
}
```

### 4. Implementación: Instagram Channel

```javascript
// channels/instagram-channel.js
const BaseChannel = require('./base-channel');

class InstagramChannel extends BaseChannel {
  constructor(credentials) {
    super(credentials);
    this.apiBaseUrl = 'https://graph.instagram.com/v18.0';
    this.pageAccessToken = credentials.pageAccessToken;
    this.instagramAccountId = credentials.instagramBusinessAccountId;
  }

  // Enviar mensaje de texto
  async sendMessage(recipientId, text) {
    try {
      // recipientId es el Instagram User ID del contacto
      const payload = {
        messaging_type: 'RESPONSE', // o 'MESSAGE_TAG' para proactive
        recipient: { id: recipientId },
        message: { text }
      };

      const response = await this.makeApiCall(
        `/${recipientId}/messages`,
        'POST',
        payload
      );

      await this.logMessage({
        channel: 'instagram',
        type: 'text',
        recipientId,
        text,
        messageId: response.message_id,
        status: 'sent'
      });

      return response;
    } catch (error) {
      this.logger.error('Error sending Instagram message', { error });
      throw error;
    }
  }

  // Enviar media (foto, video, etc.)
  async sendMedia(recipientId, mediaUrl, caption, mediaType = 'image') {
    const payload = {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'image', // 'image', 'video', 'file'
          payload: { url: mediaUrl }
        }
      }
    };

    if (caption) {
      payload.message.text = caption;
    }

    const response = await this.makeApiCall(
      `/${recipientId}/messages`,
      'POST',
      payload
    );

    return response;
  }

  // Obtener datos del contacto
  async getContact(igUserId) {
    const response = await this.makeApiCall(
      `/${igUserId}`,
      'GET',
      null,
      'fields=id,username,name'
    );

    return {
      instagramId: response.id,
      username: response.username,
      name: response.name
    };
  }

  // Validar webhook (Facebook signature)
  validateWebhook(payload, signature) {
    const crypto = require('crypto');
    const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

    const hash = crypto
      .createHmac('sha256', APP_SECRET)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  // Request a la API
  async makeApiCall(endpoint, method = 'GET', data = null, params = '') {
    const url = new URL(this.apiBaseUrl + endpoint);
    url.searchParams.append('access_token', this.pageAccessToken);
    if (params) {
      params.split('&').forEach(param => {
        const [key, value] = param.split('=');
        url.searchParams.append(key, value);
      });
    }

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram API error: ${error.message}`);
    }

    return response.json();
  }
}

module.exports = InstagramChannel;
```

### 5. Webhook Handler - Instagram

```javascript
// webhooks/instagram-webhook.js
const router = require('express').Router();
const InstagramChannel = require('../channels/instagram-channel');
const ChannelFactory = require('../channels/channel-factory');

// Verificación del webhook (GET request from Facebook)
router.get('/webhook/instagram', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Invalid token' });
  }
});

// Recibir eventos (POST request from Facebook)
router.post('/webhook/instagram', async (req, res) => {
  try {
    const { body: { entry } } = req;
    const signature = req.headers['x-hub-signature-256'];
    const payload = req.rawBody; // Raw body para validar firma

    // Validar firma
    const channel = new InstagramChannel({}); // Dummy instance
    if (!channel.validateWebhook(payload, signature)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Procesar cada evento
    for (const event of entry) {
      for (const messaging of event.messaging || []) {
        await handleMessagingEvent(messaging);
      }
    }

    // Responder rápido a Facebook
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing Instagram webhook', { error });
    res.status(500).json({ error: error.message });
  }
});

async function handleMessagingEvent(messaging) {
  const { sender, recipient, message, delivery, read, postback } = messaging;

  if (message) {
    // Mensaje recibido
    await TriggerEngine.processTrigger({
      channel: 'instagram',
      type: 'dm',
      event: 'message_received',
      data: {
        contactId: sender.id,
        messageText: message.text,
        messageId: message.mid,
        timestamp: message.timestamp,
        attachments: message.attachments || []
      }
    });
  } else if (delivery) {
    // Confirmación de entrega
    logger.info('Message delivered', { messageIds: delivery.mids });
  } else if (read) {
    // Mensaje leído
    logger.info('Message read', { watermark: read.watermark });
  } else if (postback) {
    // Acción de botón
    await TriggerEngine.processTrigger({
      channel: 'instagram',
      type: 'system_action',
      event: 'postback_received',
      data: {
        contactId: sender.id,
        payload: postback.payload,
        title: postback.title
      }
    });
  }
}

module.exports = router;
```

---

## Integración WhatsApp

### 1. Requisitos Previos

```
1. Meta Business Account
2. WhatsApp Business Account
3. Número de teléfono verificado
4. Acceso a WhatsApp Business API
5. Permisos: whatsapp_business_messaging
```

### 2. Configuración de API

```javascript
const whatsappConfig = {
  // Base URL
  apiBaseUrl: 'https://graph.instagram.com/v18.0',
  
  // Endpoints principales
  endpoints: {
    sendMessage: `/${businessAccountId}/messages`,
    uploadMedia: `/${businessAccountId}/media`,
    registerWebhook: `/${businessAccountId}/subscribed_apps`
  },
  
  // Límites por tier
  rateLimits: {
    standard: 1000,      // mensajes/día
    business: 10000,     // mensajes/día
    enterprise: 100000   // mensajes/día
  }
};
```

### 3. Modelo de Datos - Canal WhatsApp

```javascript
{
  id: "channel_wa_1",
  flowId: "flow_abc123",
  type: "whatsapp",
  
  // Credenciales
  credentials: {
    phoneNumberId: "1234567890",
    businessAccountId: "xxxxxxxx",
    accessToken: "EAAAAx...",
    phoneNumber: "+57 3001234567"
  },
  
  // Configuración
  config: {
    autoReplyEnabled: true,
    autoReplyMessage: "Gracias por contactarnos!",
    webhookUrl: "https://yourapp.com/webhook/whatsapp",
    rateLimit: "1000/day", // Standard tier
    mediaUploadPath: "/uploads/whatsapp"
  },
  
  // Metadata
  status: "active|inactive",
  tier: "standard|business|enterprise",
  messagesSentToday: 247,
  lastWebhookReceived: "2026-07-30T10:30:00Z"
}
```

### 4. Implementación: WhatsApp Channel

```javascript
// channels/whatsapp-channel.js
const BaseChannel = require('./base-channel');
const FormData = require('form-data');

class WhatsAppChannel extends BaseChannel {
  constructor(credentials) {
    super(credentials);
    this.apiBaseUrl = 'https://graph.instagram.com/v18.0';
    this.phoneNumberId = credentials.phoneNumberId;
    this.businessAccountId = credentials.businessAccountId;
    this.accessToken = credentials.accessToken;
  }

  // Enviar mensaje de texto
  async sendMessage(phoneNumber, text) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber, // +57 formato
        type: 'text',
        text: { body: text }
      };

      const response = await this.makeApiCall(
        `/${this.phoneNumberId}/messages`,
        'POST',
        payload
      );

      await this.logMessage({
        channel: 'whatsapp',
        type: 'text',
        phoneNumber,
        text,
        messageId: response.messages[0].id,
        status: 'sent'
      });

      return response;
    } catch (error) {
      logger.error('Error sending WhatsApp message', { error });
      throw error;
    }
  }

  // Enviar media
  async sendMedia(phoneNumber, mediaUrl, mediaType = 'image', caption = null) {
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: mediaType, // 'image', 'video', 'audio', 'document'
      [mediaType]: {
        link: mediaUrl,
        ...(caption && { caption })
      }
    };

    return this.makeApiCall(
      `/${this.phoneNumberId}/messages`,
      'POST',
      payload
    );
  }

  // Enviar plantilla (template)
  async sendTemplate(phoneNumber, templateName, parameters = []) {
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName, // Ej: 'hello_world'
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: parameters.map(p => ({ type: 'text', text: p }))
          }
        ]
      }
    };

    return this.makeApiCall(
      `/${this.phoneNumberId}/messages`,
      'POST',
      payload
    );
  }

  // Enviar botones
  async sendButtons(phoneNumber, text, buttons) {
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.map((btn, index) => ({
            type: 'reply',
            reply: {
              id: `btn_${index}`,
              title: btn.text.substring(0, 20) // Max 20 chars
            }
          }))
        }
      }
    };

    return this.makeApiCall(
      `/${this.phoneNumberId}/messages`,
      'POST',
      payload
    );
  }

  // Subir media
  async uploadMedia(filePath, mediaType) {
    const fs = require('fs');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('type', mediaType);

    const response = await fetch(
      `${this.apiBaseUrl}/${this.phoneNumberId}/media?access_token=${this.accessToken}`,
      {
        method: 'POST',
        body: form
      }
    );

    const data = await response.json();
    return data.id; // Media ID para usar luego
  }

  // Validar webhook
  validateWebhook(payload, signature) {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  async makeApiCall(endpoint, method = 'GET', data = null) {
    const url = `${this.apiBaseUrl}${endpoint}?access_token=${this.accessToken}`;

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${error.error.message}`);
    }

    return response.json();
  }
}

module.exports = WhatsAppChannel;
```

### 5. Webhook Handler - WhatsApp

```javascript
// webhooks/whatsapp-webhook.js
const router = require('express').Router();

router.get('/webhook/whatsapp', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Invalid token' });
  }
});

router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { body: { entry } } = req;
    const signature = req.headers['x-hub-signature-256'];

    // Validar firma
    const channel = new (require('../channels/whatsapp-channel'))({});
    if (!channel.validateWebhook(req.rawBody, signature)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Procesar cambios
    for (const change of entry[0].changes || []) {
      const { field, value } = change;

      if (field === 'messages') {
        for (const message of value.messages || []) {
          await handleWhatsAppMessage(message, value.contacts[0]);
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing WhatsApp webhook', { error });
    res.status(500).json({ error: error.message });
  }
});

async function handleWhatsAppMessage(message, contactInfo) {
  const { id: messageId, timestamp, from, type, text, image, video, document, button } = message;

  let eventData = {
    contactId: from, // Número de teléfono
    messageId,
    timestamp,
    contactName: contactInfo.profile.name
  };

  // Determinar tipo de evento
  let eventType = type;

  if (type === 'text') {
    eventData.messageText = text.body;
    eventType = 'dm'; // Reutilizar trigger de DM
  } else if (type === 'image' || type === 'video' || type === 'document') {
    eventData.mediaType = type;
    eventData.mediaId = message[type].id;
    eventType = 'media_received';
  } else if (type === 'button') {
    eventData.buttonId = button.payload;
    eventType = 'button_pressed';
  }

  await TriggerEngine.processTrigger({
    channel: 'whatsapp',
    type: eventType,
    data: eventData
  });
}

module.exports = router;
```

---

## Integración Facebook Messenger

### 1. Configuración Similar a Instagram

```javascript
const messengerConfig = {
  // Mismo App ID que Instagram
  appId: process.env.FACEBOOK_APP_ID,
  appSecret: process.env.FACEBOOK_APP_SECRET,
  
  // Access Token para página específica
  pageAccessToken: 'EAACCC...',
  pageId: '123456789',
  
  // Webhook
  webhookUrl: 'https://yourapp.com/webhook/messenger',
  verifyToken: process.env.MESSENGER_VERIFY_TOKEN'
};
```

### 2. Implementación: Messenger Channel

```javascript
// channels/messenger-channel.js
const BaseChannel = require('./base-channel');

class MessengerChannel extends BaseChannel {
  constructor(credentials) {
    super(credentials);
    this.apiBaseUrl = 'https://graph.facebook.com/v18.0';
    this.pageAccessToken = credentials.pageAccessToken;
    this.pageId = credentials.pageId;
  }

  async sendMessage(recipientId, text) {
    const payload = {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: { text }
    };

    return this.makeApiCall(`/${this.pageId}/messages`, 'POST', payload);
  }

  async sendQuickReplies(recipientId, text, quickReplies) {
    const payload = {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: {
        text,
        quick_replies: quickReplies.map((qr, index) => ({
          content_type: 'text',
          title: qr.text,
          payload: `qr_${index}`
        }))
      }
    };

    return this.makeApiCall(`/${this.pageId}/messages`, 'POST', payload);
  }

  async makeApiCall(endpoint, method = 'GET', data = null) {
    const url = new URL(this.apiBaseUrl + endpoint);
    url.searchParams.append('access_token', this.pageAccessToken);

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Messenger API error`);
    }

    return response.json();
  }
}

module.exports = MessengerChannel;
```

---

## Queue System

### ¿Por qué una Queue?

**Problemas sin Queue:**
- Si API de canal falla, mensaje se pierde
- Sin control de rate limiting
- Sin reintentos automáticos
- Sin visibilidad de mensajes pendientes

**Solución: Redis Queue**

```
Flujo:
1. Crear mensaje → Agregar a Redis Queue
2. Worker procesa → Intenta enviar via API
3. Si falla → Reintentar (exponential backoff)
4. Si éxito → Registrar en DB
5. Si max retries → Dead Letter Queue (revisar manual)
```

### Implementación: Queue Worker

```javascript
// queue/queue-worker.js
const Queue = require('bull');
const Redis = require('redis');
const ChannelFactory = require('../channels/channel-factory');

const messageQueue = new Queue('messages', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

// Procesar mensajes
messageQueue.process(5, async (job) => {
  const { channelId, recipientId, content, contentType, attempt = 1 } = job.data;
  const MAX_ATTEMPTS = 3;

  try {
    // Obtener canal
    const channelAccount = await db
      .from('channel_accounts')
      .select('*')
      .eq('id', channelId)
      .single();

    const channel = ChannelFactory.createChannel(
      channelAccount.type,
      channelAccount.credentials
    );

    // Enviar mensaje
    let response;
    if (contentType === 'text') {
      response = await channel.sendMessage(recipientId, content.text);
    } else if (contentType === 'media') {
      response = await channel.sendMedia(
        recipientId,
        content.url,
        content.mediaType,
        content.caption
      );
    } else if (contentType === 'template') {
      response = await channel.sendTemplate(
        recipientId,
        content.templateName,
        content.parameters
      );
    }

    // Registrar éxito
    await db.from('channel_messages').insert({
      channel_id: channelId,
      recipient_id: recipientId,
      content_type: contentType,
      content,
      response,
      status: 'sent',
      sent_at: new Date()
    });

    return { success: true, messageId: response.messages[0].id };
  } catch (error) {
    logger.error('Error processing message', { error, attempt });

    if (attempt < MAX_ATTEMPTS) {
      // Reintentar con delay exponencial
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      throw new Error(`Retry in ${delayMs}ms`);
    } else {
      // Max retries alcanzados → Dead Letter Queue
      await messageQueue.add('dead-letter', job.data, { priority: 1 });
      throw new Error('Max retries exceeded');
    }
  }
});

// Event listeners
messageQueue.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job.id, error: err.message });
});

messageQueue.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

// Agregar mensaje a queue
async function enqueueMessage(channelId, recipientId, content, contentType) {
  const job = await messageQueue.add(
    {
      channelId,
      recipientId,
      content,
      contentType
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true
    }
  );

  return job.id;
}

module.exports = {
  messageQueue,
  enqueueMessage
};
```

### Rate Limiter

```javascript
// rate-limit/rate-limiter.js
const Redis = require('redis');

class RateLimiter {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async checkLimit(channelId, limit, window = 3600) {
    const key = `ratelimit:${channelId}`;
    
    // Obtener contador actual
    const current = await this.redis.incr(key);
    
    // Establecer expiración la primera vez
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    return current <= limit;
  }

  async getRemaining(channelId, limit) {
    const key = `ratelimit:${channelId}`;
    const current = await this.redis.get(key) || 0;
    return Math.max(0, limit - parseInt(current));
  }
}

// Límites por canal
const CHANNEL_LIMITS = {
  instagram: 200,  // por hora
  whatsapp: 1000,  // por día (depende del tier)
  messenger: 600   // por minuto (es en calls, no mensajes)
};

module.exports = { RateLimiter, CHANNEL_LIMITS };
```

---

## Tareas de Desarrollo

### Semana 1 (40 horas): Arquitectura & Instagram

#### Día 1-2: Base de Arquitectura (16 horas)

- [ ] **Estructura de directorios** (4 horas)
  - [ ] Crear carpetas: channels/, webhooks/, queue/, rate-limit/
  - [ ] Crear base-channel.js (clase abstracta)
  - [ ] Crear channel-factory.js

- [ ] **Modelos de datos** (8 horas)
  - [ ] Crear tabla channel_accounts (Supabase)
  - [ ] Crear tabla channel_messages
  - [ ] Crear tabla webhook_logs
  - [ ] Migrations

- [ ] **Setup de testing** (4 horas)
  - [ ] Jest configuration
  - [ ] Mock de APIs externas
  - [ ] Test helpers

#### Día 3-5: Instagram Integration (24 horas)

- [ ] **Instagram Channel class** (8 horas)
  - [ ] Implementar sendMessage()
  - [ ] Implementar sendMedia()
  - [ ] Implementar getContact()
  - [ ] Tests unitarios

- [ ] **Instagram Webhook** (8 horas)
  - [ ] Endpoint GET para verificación
  - [ ] Endpoint POST para eventos
  - [ ] Validación de firma
  - [ ] Handlers de eventos (message, delivery, read)

- [ ] **Instagram Auth** (8 horas)
  - [ ] OAuth flow
  - [ ] Token storage seguro
  - [ ] Token refresh (si aplica)
  - [ ] Tests

---

### Semana 2 (40 horas): WhatsApp & Messenger

#### Día 1-3: WhatsApp Integration (24 horas)

- [ ] **WhatsApp Channel class** (8 horas)
  - [ ] sendMessage()
  - [ ] sendMedia()
  - [ ] sendTemplate()
  - [ ] sendButtons()
  - [ ] Tests

- [ ] **WhatsApp Webhook** (8 horas)
  - [ ] Verificación y recepción
  - [ ] Parsear eventos de texto, media, botones
  - [ ] Validación

- [ ] **WhatsApp Auth & Setup** (8 horas)
  - [ ] Onboarding
  - [ ] Almacenamiento de credenciales
  - [ ] Verificación de números

#### Día 4-5: Messenger Integration (16 horas)

- [ ] **Messenger Channel class** (6 horas)
  - [ ] sendMessage()
  - [ ] sendQuickReplies()
  - [ ] Otros tipos de mensajes

- [ ] **Messenger Webhook** (6 horas)
  - [ ] Setup similar a Instagram
  - [ ] Handlers

- [ ] **Testing** (4 horas)

---

### Semana 3 (40 horas): Queue System & Rate Limiting

#### Día 1-3: Queue Implementation (24 horas)

- [ ] **Redis Queue setup** (8 horas)
  - [ ] Instalar y configurar Redis
  - [ ] Crear messageQueue
  - [ ] Setup worker process

- [ ] **Queue Processor** (12 horas)
  - [ ] Procesar mensajes con reintentos
  - [ ] Exponential backoff
  - [ ] Dead Letter Queue
  - [ ] Logging y monitoring

- [ ] **Testing** (4 horas)
  - [ ] Tests de enqueue
  - [ ] Tests de reintentos

#### Día 4-5: Rate Limiting (16 horas)

- [ ] **Rate Limiter class** (6 horas)
  - [ ] Implementar checkLimit()
  - [ ] Implementar getRemaining()

- [ ] **Integration con Queue** (6 horas)
  - [ ] Verificar límites antes de enviar
  - [ ] Retrasar si se alcanza límite

- [ ] **Monitoring** (4 horas)
  - [ ] Dashboards de uso por canal
  - [ ] Alertas de límites próximos

---

### Semana 4 (40 horas): Integration & Testing

#### Día 1-2: API Endpoints (16 horas)

- [ ] **CRUD de Canales** (8 horas)
  - [ ] POST /api/channels (crear)
  - [ ] GET /api/channels (listar)
  - [ ] PUT /api/channels/:id (actualizar)
  - [ ] DELETE /api/channels/:id (eliminar)

- [ ] **Envío de Mensajes** (8 horas)
  - [ ] POST /api/messages (enqueue)
  - [ ] GET /api/messages/status (verificar estado)
  - [ ] Logging completo

#### Día 3-4: Testing & Integration (20 horas)

- [ ] **Integration tests** (10 horas)
  - [ ] Flujo completo: crear canal → enviar mensaje
  - [ ] Tests con mocks de APIs externas
  - [ ] Edge cases

- [ ] **E2E Testing** (8 horas)
  - [ ] Pruebas con accounts reales (si es posible)
  - [ ] Validar entregas reales
  - [ ] Performance testing

- [ ] **Documentation** (2 horas)
  - [ ] Setup guide
  - [ ] API documentation
  - [ ] Troubleshooting guide

---

## Código de Ejemplo

### Frontend: Channel Selector

```javascript
// components/channels/channel-selector.js
const ChannelSelector = (function() {
  const CHANNELS = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: '📷',
      description: 'DMs, comentarios, story replies',
      color: '#E1306C'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: '💬',
      description: 'Mensajes, templates, botones',
      color: '#25D366'
    },
    {
      id: 'messenger',
      name: 'Facebook Messenger',
      icon: '👥',
      description: 'Mensajes directos, quick replies',
      color: '#0084FF'
    }
  ];

  function render(container) {
    container.innerHTML = `
      <div class="channels-grid">
        ${CHANNELS.map(channel => `
          <div class="channel-card" data-channel="${channel.id}" style="border-left: 4px solid ${channel.color}">
            <div class="channel-icon">${channel.icon}</div>
            <h3>${channel.name}</h3>
            <p>${channel.description}</p>
            <button class="btn btn-sm btn-primary">Conectar</button>
          </div>
        `).join('')}
      </div>
    `;

    setupListeners(container);
  }

  function setupListeners(container) {
    container.querySelectorAll('.channel-card').forEach(card => {
      card.querySelector('button').addEventListener('click', () => {
        const channelId = card.dataset.channel;
        openAuthFlow(channelId);
      });
    });
  }

  function openAuthFlow(channelId) {
    // Redirigir a página de autenticación
    window.location.href = `/auth/${channelId}`;
  }

  return { render };
})();
```

### Backend: Channel Manager

```javascript
// routes/channels.js
const express = require('express');
const router = express.Router();
const ChannelFactory = require('../channels/channel-factory');
const { RateLimiter, CHANNEL_LIMITS } = require('../rate-limit/rate-limiter');
const { enqueueMessage } = require('../queue/queue-worker');

// Listar canales
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('channel_accounts')
      .select('id, type, status, credentials->phoneNumber, credentials->instagramHandle, created_at');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear canal
router.post('/', async (req, res) => {
  try {
    const { type, credentials } = req.body;

    // Validar credenciales según tipo
    if (!validateCredentials(type, credentials)) {
      return res.status(400).json({ error: 'Invalid credentials for channel type' });
    }

    // Probar conexión
    const channel = ChannelFactory.createChannel(type, credentials);
    // TODO: Hacer test call para validar token

    // Guardar en DB
    const { data, error } = await supabase
      .from('channel_accounts')
      .insert({
        type,
        credentials,
        status: 'active'
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensaje
router.post('/:channelId/send', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { recipientId, content, contentType } = req.body;

    // Obtener canal
    const { data: channelAccount, error: channelError } = await supabase
      .from('channel_accounts')
      .select('*')
      .eq('id', channelId)
      .single();

    if (channelError) throw channelError;

    // Verificar rate limit
    const rateLimiter = new RateLimiter(redisClient);
    const limit = CHANNEL_LIMITS[channelAccount.type];
    const canSend = await rateLimiter.checkLimit(channelId, limit);

    if (!canSend) {
      const remaining = await rateLimiter.getRemaining(channelId, limit);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        remaining,
        retryAfter: 3600
      });
    }

    // Enqueue mensaje
    const jobId = await enqueueMessage(
      channelId,
      recipientId,
      content,
      contentType
    );

    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function validateCredentials(type, credentials) {
  switch (type) {
    case 'instagram':
      return credentials.pageAccessToken && credentials.instagramBusinessAccountId;
    case 'whatsapp':
      return credentials.phoneNumberId && credentials.businessAccountId && credentials.accessToken;
    case 'messenger':
      return credentials.pageAccessToken && credentials.pageId;
    default:
      return false;
  }
}

module.exports = router;
```

---

## Testing Plan

### Unit Tests

- [ ] Cada Channel class:
  - [ ] sendMessage()
  - [ ] sendMedia()
  - [ ] Validación de webhooks
  - [ ] Manejo de errores

- [ ] Queue worker:
  - [ ] Enqueue + procesar
  - [ ] Reintentos
  - [ ] Exponential backoff

- [ ] Rate limiter:
  - [ ] Verificar límites
  - [ ] Reset de ventana

### Integration Tests

- [ ] Auth flow completo
- [ ] Enviar mensaje → Procesado en queue → Enviado via API
- [ ] Recibir webhook → Crear trigger
- [ ] Rate limiting actua correctamente

### E2E Tests (si es posible)

- [ ] Crear channel Instagram real
- [ ] Enviar mensaje real a test account
- [ ] Verificar recepción
- [ ] Mismo para WhatsApp y Messenger

---

## Checklist Final

### Código
- [ ] Todos los canales implementados
- [ ] Queue system funcionando
- [ ] Rate limiting activo
- [ ] Validación de webhooks
- [ ] Logging completo

### Testing
- [ ] Coverage >80%
- [ ] Todos los tests verdes
- [ ] E2E tests pasando
- [ ] Performance testing

### Deployment
- [ ] Environment variables configuradas
- [ ] Redis configurado
- [ ] Webhooks registrados en Meta
- [ ] Monitoring configurado

### Documentation
- [ ] Setup guide completo
- [ ] API documentation
- [ ] Troubleshooting guide
- [ ] Example flows por canal

---

## Timeline

### Semana 1: Instagram
### Semana 2: WhatsApp + Messenger
### Semana 3: Queue + Rate Limiting
### Semana 4: Integration + Testing

**Hito Final**: Sistema multi-canal completo y testeado ✅

---

**Última actualización**: 30 de Julio 2026  
**Versión**: 1.0  
**Estado**: Listo para desarrollo
