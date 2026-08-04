# Flow Builder API Documentation

**Version:** 1.0  
**Status:** Production Ready  
**Base URL:** `/api/flows-builder`

---

## Overview

The Flow Builder API provides a complete REST interface for managing conversation flows in the CRM. It allows you to:

- ✅ Create custom flows
- ✅ Update existing flows
- ✅ Delete flows
- ✅ List all flows
- ✅ Test flows before deployment
- ✅ Export flows as JSON
- ✅ Search flows by keywords

All endpoints require authentication via Bearer token (except webhooks).

---

## Authentication

All API endpoints require the following header:

```
Authorization: Bearer {API_SECRET}
```

The `API_SECRET` should be configured in your `.env` file.

---

## Endpoints

### 1. Create Flow

**Endpoint:** `POST /api/flows-builder`

**Description:** Create a new flow.

**Request Body:**
```json
{
  "name": "Welcome Flow",
  "keywords": ["hola", "welcome", "hi"],
  "matchType": "contains",
  "steps": [
    {
      "type": "text",
      "message": "¡Hola! Bienvenido a nuestro servicio"
    },
    {
      "type": "buttons",
      "message": "¿Cómo puedo ayudarte?",
      "buttons": [
        {
          "type": "postback",
          "title": "Ver precios",
          "payload": "PRICES"
        },
        {
          "type": "postback",
          "title": "Hablar con agente",
          "payload": "AGENT"
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "flow": {
    "id": "flow_1704067200000",
    "name": "Welcome Flow",
    "keywords": ["hola", "welcome", "hi"],
    "matchType": "contains",
    "steps": [...],
    "enabled": true,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "message": "Flujo \"Welcome Flow\" creado exitosamente"
}
```

**Status Codes:**
- `201` - Flow created successfully
- `400` - Invalid request data

---

### 2. List All Flows

**Endpoint:** `GET /api/flows-builder`

**Query Parameters:**
- `enabled` (optional): `true` or `false` - Filter by enabled status
- `search` (optional): Search keyword in flow name or keywords

**Response:**
```json
{
  "status": "success",
  "count": 5,
  "flows": [
    {
      "id": "flow_1704067200000",
      "name": "Welcome Flow",
      "keywords": ["hola", "welcome"],
      "matchType": "contains",
      "enabled": true,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

**Status Codes:**
- `200` - Success

---

### 3. Get Flow Details

**Endpoint:** `GET /api/flows-builder/:id`

**Parameters:**
- `id` - Flow ID (e.g., `flow_1704067200000`)

**Response:**
```json
{
  "status": "success",
  "flow": {
    "id": "flow_1704067200000",
    "name": "Welcome Flow",
    "keywords": ["hola"],
    "matchType": "contains",
    "steps": [...],
    "enabled": true,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Status Codes:**
- `200` - Success
- `404` - Flow not found

---

### 4. Update Flow

**Endpoint:** `PUT /api/flows-builder/:id`

**Parameters:**
- `id` - Flow ID

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Flow Name",
  "keywords": ["new", "keywords"],
  "matchType": "exact",
  "steps": [...],
  "enabled": false
}
```

**Response:**
```json
{
  "status": "success",
  "flow": {
    "id": "flow_1704067200000",
    "name": "Updated Flow Name",
    ...
    "updatedAt": "2024-01-01T13:00:00.000Z"
  },
  "message": "Flujo \"Updated Flow Name\" actualizado exitosamente"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid data
- `404` - Flow not found

---

### 5. Delete Flow

**Endpoint:** `DELETE /api/flows-builder/:id`

**Parameters:**
- `id` - Flow ID

**Response:**
```json
{
  "status": "success",
  "deletedFlowId": "flow_1704067200000",
  "deletedFlowName": "Welcome Flow",
  "message": "Flujo \"Welcome Flow\" eliminado exitosamente"
}
```

**Status Codes:**
- `200` - Success
- `404` - Flow not found

---

### 6. Test Flow

**Endpoint:** `POST /api/flows-builder/:id/test`

**Description:** Validate a flow and prepare it for execution.

**Parameters:**
- `id` - Flow ID

**Request Body:**
```json
{
  "senderId": "123456789",
  "senderName": "John Doe"
}
```

**Response:**
```json
{
  "status": "success",
  "flowId": "flow_1704067200000",
  "flowName": "Welcome Flow",
  "stepsCount": 3,
  "testInput": {
    "senderId": "123456789",
    "senderName": "John Doe"
  },
  "message": "Flujo \"Welcome Flow\" listo para ejecutar con 3 pasos"
}
```

**Status Codes:**
- `200` - Flow is valid
- `400` - Flow invalid or missing data
- `404` - Flow not found

---

### 7. Export Flow

**Endpoint:** `POST /api/flows-builder/:id/export`

**Description:** Export a flow as JSON file.

**Parameters:**
- `id` - Flow ID

**Request Body:**
```json
{
  "format": "json"
}
```

**Response (JSON format):**
The response includes the flow data with proper headers to download as attachment.

**Status Codes:**
- `200` - Success
- `404` - Flow not found

---

### 8. Search Flows

**Endpoint:** `GET /api/flows-builder/search/:keyword`

**Description:** Search flows by keyword.

**Parameters:**
- `keyword` - Search term

**Response:**
```json
{
  "status": "success",
  "keyword": "welcome",
  "count": 2,
  "flows": [
    {
      "id": "flow_1704067200000",
      "name": "Welcome Flow",
      "keywords": ["welcome", "hola"],
      ...
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing keyword

---

## Step Types

Supported flow step types:

### Text Message
```json
{
  "type": "text",
  "message": "Your message here"
}
```

### Buttons
```json
{
  "type": "buttons",
  "message": "Choose one:",
  "buttons": [
    {
      "type": "postback",
      "title": "Option 1",
      "payload": "OPT1"
    }
  ]
}
```

### Card
```json
{
  "type": "card",
  "message": "Card description",
  "card": {
    "title": "Card Title",
    "subtitle": "Card subtitle",
    "image_url": "https://example.com/image.jpg"
  }
}
```

### Condition
```json
{
  "type": "condition",
  "field": "status",
  "operator": "==",
  "value": "active",
  "truePayload": "flow_success",
  "falsePayload": "flow_failure"
}
```

### Input
```json
{
  "type": "input",
  "prompt": "Enter your email:",
  "inputType": "email",
  "field": "email",
  "successPayload": "flow_success",
  "failPayload": "flow_failure"
}
```

### Delay
```json
{
  "type": "delay",
  "seconds": 2
}
```

### AI Agent
```json
{
  "type": "ai_agent",
  "system_prompt": "You are a helpful assistant",
  "ignore_master_context": false
}
```

### GoTo
```json
{
  "type": "goto",
  "flow_id": "flow_target_id"
}
```

### Action
```json
{
  "type": "action",
  "actionType": "add_tag",
  "params": {
    "tag": "vip"
  }
}
```

---

## Match Types

When creating flows, specify how keywords trigger the flow:

- `contains` - Keyword appears anywhere in message
- `exact` - Message exactly matches keyword
- `starts_with` - Message starts with keyword
- `regex` - Use regular expression pattern

---

## Error Handling

All error responses follow this format:

```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

Common errors:

| Error | HTTP Code | Cause |
|-------|-----------|-------|
| Flow not found | 404 | Invalid or non-existent flow ID |
| Missing required fields | 400 | Invalid request data |
| Invalid step type | 400 | Unsupported step type |
| Unauthorized | 401 | Missing or invalid token |

---

## Usage Examples

### Create Welcome Flow
```bash
curl -X POST http://localhost:3000/api/flows-builder \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome",
    "keywords": ["hola", "hi"],
    "matchType": "contains",
    "steps": [
      {"type": "text", "message": "Hola!"}
    ]
  }'
```

### List All Flows
```bash
curl http://localhost:3000/api/flows-builder \
  -H "Authorization: Bearer YOUR_SECRET"
```

### Update Flow
```bash
curl -X PUT http://localhost:3000/api/flows-builder/flow_123 \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Test Flow
```bash
curl -X POST http://localhost:3000/api/flows-builder/flow_123/test \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "senderId": "123456",
    "senderName": "John"
  }'
```

---

## Architecture

The Flow Builder API is built using Clean Architecture principles:

```
HTTP Layer (Express routes)
    ↓
Use Cases (CreateFlow, UpdateFlow, etc.)
    ↓
Gateways (FlowRepository)
    ↓
Domain (State, Config)
    ↓
Storage (Supabase + File)
```

Each flow operation is isolated in its own use case for testability and maintainability.

---

## Testing

Run the test suite:
```bash
node test_flow_builder.js
```

This tests:
- FlowRepository CRUD operations
- All Use Cases
- DI container integration
- Flow validation

---

## Next Steps

Phase 2 (UI Builder):
- [ ] Drawflow visual editor
- [ ] Drag-and-drop node interface
- [ ] Flow preview
- [ ] Live testing

See [FLOW_BUILDER_IMPLEMENTATION.md](./FLOW_BUILDER_IMPLEMENTATION.md) for Phase 2 details.
