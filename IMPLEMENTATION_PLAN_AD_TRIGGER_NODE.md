# 📋 PLAN DE IMPLEMENTACIÓN: Nodo Disparador de Anuncios Instagram

**Basado en:** Node.js Design Patterns (Casciaro & Mammino, 2020)  
**Arquitectura:** Clean Architecture + Design Patterns  
**Objetivo:** Convertir Welcome Message Ads en nodo del Flow Builder  
**Complejidad:** Alta | **Tiempo estimado:** 8-10 horas | **Riesgo:** Medio

---

## 📐 ARQUITECTURA Y PATRONES DE DISEÑO

### **Patrones a Usar:**

1. **Factory Pattern** (Cap. 7 - Creational Patterns)
   - Crear diferentes tipos de nodos sin conocer detalles internos
   - `NodeFactory.create(type, config)`

2. **Strategy Pattern** (Cap. 9 - Behavioral Patterns)
   - Diferentes estrategias de ejecución para cada tipo de nodo
   - `NodeExecutor.execute(step, context)`

3. **Observer Pattern** (Cap. 3 - Event-Driven)
   - Notificar cambios en estado del nodo
   - `NodeStateObserver`

4. **Middleware Pattern** (Cap. 9)
   - Validar, preparar, ejecutar, limpiar
   - `NodeMiddleware.chain(validators, executors)`

5. **Decorator Pattern** (Cap. 8 - Structural)
   - Agregar funcionalidad a nodos existentes
   - `AdTriggerDecorator.wrap(node)`

---

## 🏗️ ESTRUCTURA DE ARCHIVOS

```
src/
├── nodes/
│   ├── index.js                          (Exports de todos los nodos)
│   ├── base/
│   │   ├── BaseNode.js                   (Clase base abstracta)
│   │   ├── NodeValidator.js              (Validación de nodos)
│   │   └── NodeExecutor.js               (Ejecución genérica)
│   │
│   ├── factories/
│   │   ├── NodeFactory.js                (Factory para crear nodos)
│   │   └── NodeRegistry.js               (Registro de tipos de nodos)
│   │
│   ├── strategies/
│   │   ├── ExecutionStrategy.js          (Interfaz)
│   │   ├── TextExecutionStrategy.js
│   │   ├── ButtonsExecutionStrategy.js
│   │   └── AdTriggerExecutionStrategy.js (NUEVO)
│   │
│   ├── decorators/
│   │   ├── LoggingDecorator.js           (Log de ejecución)
│   │   ├── ErrorHandlingDecorator.js     (Manejo de errores)
│   │   └── MetricsDecorator.js           (Métricas)
│   │
│   └── implementations/
│       ├── TextNode.js
│       ├── ButtonsNode.js
│       ├── ConditionNode.js
│       └── AdTriggerNode.js              (NUEVO)
│
├── services/
│   ├── node-executor.service.js          (NUEVO - ejecutor de nodos)
│   ├── ad-trigger.service.js             (NUEVO - lógica de ad trigger)
│   ├── welcome-flows.service.js          (REFACTORIZADO)
│   └── flow.service.js                   (Existente - se actualiza)
│
├── validators/
│   ├── AdTriggerValidator.js             (NUEVO)
│   └── NodeValidator.js
│
└── use-cases/
    └── CreateAdTriggerFlowUseCase.js     (NUEVO)
```

---

## 🔑 IMPLEMENTACIÓN PASO A PASO

### **PASO 1: Crear Clase Base Abstracta (BaseNode)**

**Archivo:** `src/nodes/base/BaseNode.js`

```javascript
/**
 * BaseNode - Clase base abstracta para todos los tipos de nodos
 * Sigue el patrón Template Method del libro (Cap. 9)
 */
class BaseNode {
  constructor(config = {}) {
    this.id = config.id || `node_${Date.now()}`;
    this.type = config.type || 'unknown';
    this.enabled = config.enabled !== false;
    this.metadata = {
      createdAt: config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
  }

  /**
   * Template Method Pattern - Define estructura pero delega implementación
   */
  async execute(step, context) {
    // 1. Validar
    this.validate(step);
    
    // 2. Preparar
    const preparedStep = this.prepare(step, context);
    
    // 3. Ejecutar (delegado a subclase)
    await this.executeImpl(preparedStep, context);
    
    // 4. Post-procesar
    await this.postProcess(preparedStep, context);
  }

  /**
   * Validar estructura del paso
   * DEBE ser sobrescrito en subclases
   */
  validate(step) {
    if (!step || typeof step !== 'object') {
      throw new Error(`Paso inválido: se esperaba objeto, recibió ${typeof step}`);
    }
    if (step.type !== this.type) {
      throw new Error(`Tipo de paso incorrecto: esperado ${this.type}, recibió ${step.type}`);
    }
  }

  /**
   * Preparar datos antes de ejecutar
   */
  prepare(step, context) {
    return {
      ...step,
      _executedAt: new Date().toISOString(),
      _context: context
    };
  }

  /**
   * Implementación específica del nodo
   * DEBE ser sobrescrito en subclases
   */
  async executeImpl(step, context) {
    throw new Error(`${this.constructor.name} must implement executeImpl()`);
  }

  /**
   * Post-procesamiento (logging, análitica, etc)
   */
  async postProcess(step, context) {
    // Registrar ejecución
    if (context.trackExecution) {
      context.executionLog.push({
        nodeId: this.id,
        nodeType: this.type,
        executedAt: step._executedAt,
        success: true
      });
    }
  }
}

module.exports = BaseNode;
```

---

### **PASO 2: Crear Strategy Pattern para Ejecución**

**Archivo:** `src/nodes/strategies/ExecutionStrategy.js`

```javascript
/**
 * ExecutionStrategy - Interfaz para diferentes estrategias de ejecución
 * Strategy Pattern del libro (Cap. 9 - Behavioral Patterns)
 */
class ExecutionStrategy {
  async execute(step, context) {
    throw new Error('execute() must be implemented');
  }

  /**
   * Verificar pre-condiciones antes de ejecutar
   */
  async validatePreconditions(step, context) {
    return true;
  }

  /**
   * Rollback si falla la ejecución
   */
  async rollback(step, context, error) {
    console.warn(`Rollback para ${this.constructor.name}:`, error.message);
  }
}

module.exports = ExecutionStrategy;
```

**Archivo:** `src/nodes/strategies/AdTriggerExecutionStrategy.js`

```javascript
const ExecutionStrategy = require('./ExecutionStrategy');
const axios = require('axios');

/**
 * AdTriggerExecutionStrategy - Ejecuta lógica del disparador de anuncios
 */
class AdTriggerExecutionStrategy extends ExecutionStrategy {
  constructor(metaService, welcomeFlowsService) {
    super();
    this.metaService = metaService;
    this.welcomeFlowsService = welcomeFlowsService;
  }

  async validatePreconditions(step, context) {
    // Validaciones antes de crear el Welcome Flow
    if (!step.message || step.message.trim().length === 0) {
      throw new Error('Ad Trigger: Mensaje requerido');
    }

    if (!step.quick_replies || step.quick_replies.length === 0) {
      throw new Error('Ad Trigger: Mínimo 1 botón de respuesta rápida requerido');
    }

    if (step.quick_replies.length > 13) {
      throw new Error('Ad Trigger: Máximo 13 botones permitidos (limitación Meta)');
    }

    // Verificar que no hay variables en el primer mensaje (limitación Meta)
    if (step.message.includes('{{') || step.message.includes('{username}')) {
      throw new Error('Ad Trigger: No se permiten variables en el mensaje inicial (limitación Meta)');
    }

    return true;
  }

  async execute(step, context) {
    try {
      // 1. Crear Welcome Message Flow en Meta
      const flowId = await this.createWelcomeMessageFlow(step, context);

      // 2. Guardar en DB (tabla welcome_ad_flows)
      await this.saveAdTriggerMetadata(flowId, step, context);

      // 3. Notificar al usuario
      context.broadcastLog?.('AD_TRIGGER', `Disparador de anuncio creado: ${flowId}`);

      return {
        success: true,
        flowId,
        message: `Welcome Message Flow creado exitosamente`
      };
    } catch (error) {
      await this.rollback(step, context, error);
      throw error;
    }
  }

  async createWelcomeMessageFlow(step, context) {
    // Construcción del payload para Meta API
    const metaPayload = {
      eligible_platforms: ['instagram'],
      name: step.flowName || `Ad Flow ${Date.now()}`,
      welcome_message_flow: [{
        message: {
          text: step.message,
          quick_replies: (step.quick_replies || []).map(qr => ({
            content_type: 'text',
            title: qr.title,
            payload: qr.payload
          }))
        }
      }]
    };

    // Llamar a Meta API
    const response = await axios.post(
      `https://graph.instagram.com/v26.0/me/welcome_message_flows`,
      metaPayload,
      {
        params: { access_token: context.accessToken }
      }
    );

    if (!response.data.flow_id) {
      throw new Error('Meta no devolvió flow_id');
    }

    return response.data.flow_id;
  }

  async saveAdTriggerMetadata(flowId, step, context) {
    if (!context.supabase) return;

    await context.supabase
      .from('welcome_ad_flows')
      .insert({
        flow_id: flowId,
        meta_flow_id: flowId,
        flow_name: step.flowName,
        message: step.message,
        quick_replies: step.quick_replies,
        linked_flow_id: step.linkedFlowId,
        created_by: context.userId,
        created_at: new Date().toISOString()
      });
  }

  async rollback(step, context, error) {
    console.error('AdTrigger rollback:', error.message);
    context.broadcastLog?.('ERROR', `Error creando Welcome Flow: ${error.message}`);
  }
}

module.exports = AdTriggerExecutionStrategy;
```

---

### **PASO 3: Factory Pattern para Crear Nodos**

**Archivo:** `src/nodes/factories/NodeFactory.js`

```javascript
/**
 * NodeFactory - Factory Pattern (Cap. 7 - Creational Patterns)
 * Crea instancias de nodos sin exponer detalles de construcción
 */
class NodeFactory {
  static registry = new Map();

  /**
   * Registrar un tipo de nodo
   */
  static register(type, NodeClass, dependencies = {}) {
    NodeFactory.registry.set(type, {
      Class: NodeClass,
      dependencies
    });
  }

  /**
   * Crear nodo del tipo especificado
   */
  static create(type, config) {
    const entry = NodeFactory.registry.get(type);

    if (!entry) {
      throw new Error(`Tipo de nodo no registrado: ${type}`);
    }

    const { Class, dependencies } = entry;

    // Inyectar dependencias
    return new Class({
      ...config,
      ...dependencies
    });
  }

  /**
   * Obtener todos los tipos de nodos registrados
   */
  static getRegisteredTypes() {
    return Array.from(NodeFactory.registry.keys());
  }

  /**
   * Verificar si un tipo está registrado
   */
  static isRegistered(type) {
    return NodeFactory.registry.has(type);
  }
}

module.exports = NodeFactory;
```

**Archivo:** `src/nodes/factories/NodeRegistry.js`

```javascript
/**
 * NodeRegistry - Registra todos los tipos de nodos disponibles
 * Ejecutar en app.js durante la inicialización
 */
const NodeFactory = require('./NodeFactory');
const TextNode = require('../implementations/TextNode');
const ButtonsNode = require('../implementations/ButtonsNode');
const AdTriggerNode = require('../implementations/AdTriggerNode');
// ... otros nodos

function initializeNodeRegistry(dependencies) {
  // Nodos existentes
  NodeFactory.register('text', TextNode, dependencies);
  NodeFactory.register('buttons', ButtonsNode, dependencies);
  
  // Nodo nuevo
  NodeFactory.register('ad_trigger', AdTriggerNode, dependencies);

  console.log(`✅ Node Registry inicializado con ${NodeFactory.getRegisteredTypes().length} tipos`);
}

module.exports = { initializeNodeRegistry };
```

---

### **PASO 4: Implementación del Nodo AdTrigger**

**Archivo:** `src/nodes/implementations/AdTriggerNode.js`

```javascript
const BaseNode = require('../base/BaseNode');

/**
 * AdTriggerNode - Nodo disparador de anuncios Instagram
 * Integra Welcome Message Ads al Flow Builder
 */
class AdTriggerNode extends BaseNode {
  constructor(config) {
    super({
      type: 'ad_trigger',
      ...config
    });
    this.executionStrategy = config.executionStrategy;
    this.validator = config.validator;
  }

  /**
   * Validar estructura del paso (sobrescribe BaseNode)
   */
  validate(step) {
    super.validate(step);

    // Validaciones específicas de Ad Trigger
    if (!step.message || typeof step.message !== 'string') {
      throw new Error('Ad Trigger: "message" debe ser un string');
    }

    if (step.message.trim().length === 0) {
      throw new Error('Ad Trigger: "message" no puede estar vacío');
    }

    if (!Array.isArray(step.quick_replies)) {
      throw new Error('Ad Trigger: "quick_replies" debe ser un array');
    }

    if (step.quick_replies.length === 0) {
      throw new Error('Ad Trigger: Mínimo 1 botón requerido');
    }

    if (step.quick_replies.length > 13) {
      throw new Error('Ad Trigger: Máximo 13 botones permitidos');
    }

    // Validar estructura de cada quick reply
    for (let i = 0; i < step.quick_replies.length; i++) {
      const qr = step.quick_replies[i];
      if (!qr.title || !qr.payload) {
        throw new Error(`Ad Trigger: Quick reply ${i} debe tener "title" y "payload"`);
      }
      if (qr.title.length > 20) {
        throw new Error(`Ad Trigger: Título de botón no puede exceder 20 caracteres`);
      }
    }

    // Validar que no hay variables en primer mensaje (limitación Meta)
    if (step.message.includes('{{') || step.message.includes('{username}')) {
      throw new Error('Ad Trigger: No se permiten variables en el mensaje (limitación Meta)');
    }
  }

  /**
   * Implementación específica (ejecuta el strategy)
   */
  async executeImpl(step, context) {
    return await this.executionStrategy.execute(step, context);
  }

  /**
   * Marcar que este es un nodo especial que crea un Welcome Flow
   */
  createsWelcomeFlow() {
    return true;
  }

  /**
   * El nodo debe ser el primero en el flujo
   */
  isFirstNodeOnly() {
    return true;
  }
}

module.exports = AdTriggerNode;
```

---

### **PASO 5: Servicio de Ejecución de Nodos**

**Archivo:** `src/services/node-executor.service.js`

```javascript
/**
 * NodeExecutorService - Orquesta la ejecución de nodos
 * Middleware Pattern del libro (Cap. 9)
 */
class NodeExecutorService {
  constructor(nodeFactory, logger) {
    this.nodeFactory = nodeFactory;
    this.logger = logger;
  }

  /**
   * Ejecutar un paso del flujo
   */
  async executeStep(step, context) {
    try {
      // 1. Crear instancia del nodo
      const node = this.nodeFactory.create(step.type, {
        executionStrategy: context.strategies[step.type]
      });

      // 2. Ejecutar (con validación, preparación, etc)
      const result = await node.execute(step, context);

      return result;
    } catch (error) {
      this.logger.error(`Error ejecutando nodo ${step.type}:`, error);
      throw error;
    }
  }

  /**
   * Ejecutar todos los pasos de un flujo
   */
  async executeFlow(steps, context) {
    const executionLog = [];
    context.executionLog = executionLog;

    for (const step of steps) {
      try {
        const result = await this.executeStep(step, context);
        executionLog.push({
          stepId: step.id,
          type: step.type,
          status: 'success',
          result
        });
      } catch (error) {
        executionLog.push({
          stepId: step.id,
          type: step.type,
          status: 'error',
          error: error.message
        });
        throw error;
      }
    }

    return executionLog;
  }
}

module.exports = NodeExecutorService;
```

---

### **PASO 6: Actualizar CreateFlowUseCase**

**Archivo:** `src/use-cases/CreateFlowUseCase.js` (MODIFICADO)

```javascript
class CreateFlowUseCase {
  constructor({ flowRepository }) {
    this.flowRepository = flowRepository;
  }

  async execute(input) {
    const { name, keywords, matchType, steps } = input;

    if (!name || typeof name !== 'string') {
      throw new Error('El nombre del flujo es requerido');
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('El flujo debe tener al menos un paso');
    }

    // Validar todos los pasos
    this._validateSteps(steps);

    // NUEVO: Si el primer paso es ad_trigger, marcar como flujo de anuncio
    const isAdFlow = steps[0]?.type === 'ad_trigger';
    const flowData = {
      name: name.trim(),
      keywords: (keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean),
      matchType: matchType || 'contains',
      steps,
      isAdFlow, // NUEVO
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const flow = await this.flowRepository.create(flowData);

    return {
      status: 'success',
      flow,
      isAdFlow,
      message: isAdFlow 
        ? `Flujo de anuncio "${flow.name}" creado exitosamente`
        : `Flujo "${flow.name}" creado exitosamente`
    };
  }

  _validateSteps(steps) {
    // ACTUALIZADO: Agregar 'ad_trigger' a tipos válidos
    const validTypes = [
      'text', 'buttons', 'template', 'card', 'carousel', 'gallery',
      'audio', 'video', 'file', 'delay', 'input', 'condition',
      'randomizer', 'goto', 'action', 'ai_agent',
      'ad_trigger'  // NUEVO
    ];

    for (const [index, step] of steps.entries()) {
      if (!step.type || !validTypes.includes(step.type)) {
        throw new Error(`Paso ${index}: tipo inválido: ${step.type}`);
      }

      // NUEVO: ad_trigger solo permitido como primer paso
      if (step.type === 'ad_trigger' && index !== 0) {
        throw new Error('Ad Trigger debe ser el primer paso del flujo');
      }

      // Validaciones específicas por tipo
      this._validateStepByType(step, index);
    }
  }

  _validateStepByType(step, index) {
    switch (step.type) {
      case 'text':
        if (!step.message) throw new Error(`Paso ${index}: text requiere "message"`);
        break;
      case 'ad_trigger':
        if (!step.message) throw new Error(`Paso ${index}: ad_trigger requiere "message"`);
        if (!Array.isArray(step.quick_replies)) {
          throw new Error(`Paso ${index}: ad_trigger requiere "quick_replies"`);
        }
        if (step.quick_replies.length === 0) {
          throw new Error(`Paso ${index}: ad_trigger requiere al menos 1 botón`);
        }
        if (step.quick_replies.length > 13) {
          throw new Error(`Paso ${index}: ad_trigger máximo 13 botones`);
        }
        if (step.message.includes('{{') || step.message.includes('{username}')) {
          throw new Error(`Paso ${index}: ad_trigger no permite variables en mensaje`);
        }
        break;
      // ... otros validaciones
    }
  }
}

module.exports = CreateFlowUseCase;
```

---

### **PASO 7: Integración en app.js**

**Archivo:** `app.js` (MODIFICADO)

```javascript
// Al inicio del archivo, agregar:
const { initializeNodeRegistry } = require('./src/nodes/factories/NodeRegistry');
const NodeFactory = require('./src/nodes/factories/NodeFactory');
const NodeExecutorService = require('./src/services/node-executor.service');

// ... después de conectar Supabase y Meta service:

// Inicializar registro de nodos
const nodeDependencies = {
  metaService: meta,
  welcomeFlowsService: welcomeFlows,
  supabase,
  broadcastLog,
  accessToken: state.ACCESS_TOKEN,
  userId: 'admin' // Obtener del contexto real
};

initializeNodeRegistry(nodeDependencies);
const nodeExecutor = new NodeExecutorService(NodeFactory, console);

// Guardar en estado global
state.nodeFactory = NodeFactory;
state.nodeExecutor = nodeExecutor;
```

---

## ✅ VALIDACIONES Y SEGURIDAD

### **Validaciones de AdTriggerNode**

```javascript
class AdTriggerValidator {
  static validate(step) {
    const errors = [];

    // 1. Mensaje
    if (!step.message) errors.push('Mensaje requerido');
    if (step.message && step.message.length > 2000) errors.push('Mensaje > 2000 caracteres');
    if (step.message?.includes('{{') || step.message?.includes('{username}')) {
      errors.push('Variables no permitidas en mensaje inicial');
    }

    // 2. Quick Replies
    if (!step.quick_replies || !Array.isArray(step.quick_replies)) {
      errors.push('Quick replies debe ser un array');
    }
    if (step.quick_replies?.length === 0) errors.push('Mínimo 1 botón');
    if (step.quick_replies?.length > 13) errors.push('Máximo 13 botones');

    // 3. Cada quick reply
    step.quick_replies?.forEach((qr, i) => {
      if (!qr.title) errors.push(`Botón ${i}: título requerido`);
      if (qr.title?.length > 20) errors.push(`Botón ${i}: título > 20 caracteres`);
      if (!qr.payload) errors.push(`Botón ${i}: payload requerido`);
      if (qr.payload?.length > 1000) errors.push(`Botón ${i}: payload > 1000 caracteres`);
    });

    // 4. Flujo vinculado
    if (!step.linkedFlowId) errors.push('Flujo vinculado requerido');

    if (errors.length > 0) {
      throw new Error(`Validación Ad Trigger fallida:\n${errors.join('\n')}`);
    }
  }
}

module.exports = AdTriggerValidator;
```

---

## 🧪 TESTING

### **Unit Tests: AdTriggerNode**

**Archivo:** `test/nodes/AdTriggerNode.test.js`

```javascript
const AdTriggerNode = require('../../src/nodes/implementations/AdTriggerNode');
const MockAdTriggerStrategy = require('../mocks/MockAdTriggerStrategy');

describe('AdTriggerNode', () => {
  let node;
  let mockStrategy;

  beforeEach(() => {
    mockStrategy = new MockAdTriggerStrategy();
    node = new AdTriggerNode({
      executionStrategy: mockStrategy
    });
  });

  test('debe validar mensaje requerido', () => {
    const step = {
      type: 'ad_trigger',
      quick_replies: [{ title: 'Btn', payload: 'P1' }]
      // falta: message
    };

    expect(() => node.validate(step)).toThrow('message');
  });

  test('debe validar máximo 13 botones', () => {
    const buttons = Array.from({ length: 14 }, (_, i) => ({
      title: `Btn ${i}`,
      payload: `P${i}`
    }));

    const step = {
      type: 'ad_trigger',
      message: 'Test',
      quick_replies: buttons
    };

    expect(() => node.validate(step)).toThrow('13');
  });

  test('debe rechazar variables en mensaje', () => {
    const step = {
      type: 'ad_trigger',
      message: 'Hola {username}',
      quick_replies: [{ title: 'Btn', payload: 'P1' }]
    };

    expect(() => node.validate(step)).toThrow('variables');
  });

  test('debe ejecutar strategy correctamente', async () => {
    const step = {
      type: 'ad_trigger',
      message: 'Mensaje de prueba',
      quick_replies: [
        { title: 'Opción 1', payload: 'OPT1' },
        { title: 'Opción 2', payload: 'OPT2' }
      ]
    };

    const context = { accessToken: 'test_token' };
    await node.execute(step, context);

    expect(mockStrategy.executeCalled).toBe(true);
  });
});
```

---

## 🚀 PLAN DE DESPLIEGUE

### **Fase 1: Desarrollo (Día 1-2)**
```
1. ✓ Crear BaseNode.js
2. ✓ Crear ExecutionStrategy.js
3. ✓ Crear AdTriggerExecutionStrategy.js
4. ✓ Crear NodeFactory.js
5. ✓ Crear AdTriggerNode.js
6. ✓ Crear NodeExecutorService.js
7. ✓ Tests unitarios
```

### **Fase 2: Integración (Día 3)**
```
1. ✓ Actualizar CreateFlowUseCase.js
2. ✓ Integrar en app.js
3. ✓ Migrar lógica existente de flow.service.js
4. ✓ Tests de integración
```

### **Fase 3: Migración (Día 4)**
```
1. ✓ Refactorizar flow.service.js para usar NodeExecutor
2. ✓ Actualizar flow-builder.html para mostrar nodo
3. ✓ Tests E2E en Flow Builder
```

### **Fase 4: Validación (Día 5)**
```
1. ✓ Pruebas en staging
2. ✓ Performance testing
3. ✓ Security audit
4. ✓ Deploy a producción
```

---

## 📊 BASE DE DATOS

### **Nueva tabla: welcome_ad_flows**

```sql
CREATE TABLE welcome_ad_flows (
  id BIGSERIAL PRIMARY KEY,
  flow_id UUID NOT NULL UNIQUE,
  meta_flow_id TEXT NOT NULL UNIQUE,
  flow_name TEXT NOT NULL,
  message TEXT NOT NULL,
  quick_replies JSONB NOT NULL,
  linked_flow_id UUID NOT NULL REFERENCES app_flows(id),
  
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Auditoría
  status TEXT DEFAULT 'active', -- active, paused, archived
  is_used_in_ad BOOLEAN DEFAULT FALSE,
  
  -- Analytics
  total_clicks BIGINT DEFAULT 0,
  last_clicked_at TIMESTAMP,
  
  CONSTRAINT message_length CHECK (length(message) <= 2000),
  CONSTRAINT min_buttons CHECK (jsonb_array_length(quick_replies) >= 1),
  CONSTRAINT max_buttons CHECK (jsonb_array_length(quick_replies) <= 13)
);

CREATE INDEX idx_welcome_ad_flows_flow_id ON welcome_ad_flows(flow_id);
CREATE INDEX idx_welcome_ad_flows_linked_flow_id ON welcome_ad_flows(linked_flow_id);
```

---

## ⚠️ CONSIDERACIONES ESPECIALES

### **1. Backward Compatibility**
- La refactorización NO debe romper flujos existentes
- Mantener `processFlowSteps()` en `flow.service.js` como fallback
- Usar feature flags para rollout gradual

### **2. Manejo de Errores**
- Todas las estrategias deben implementar `rollback()`
- Logging detallado en cada paso
- Notificaciones a usuario en caso de error

### **3. Performance**
- Cachear tipos de nodos registrados
- Lazy-load estrategias si es necesario
- Limitar concurrencia de ejecuciones

### **4. Seguridad**
- Validar ALL inputs (mensajes, payloads, títulos)
- Sanitizar antes de enviar a Meta
- Limitar tamaño de Quick Replies
- Auditoría de cambios en flujos de anuncios

### **5. Observabilidad**
- Log cada ejecución de nodo
- Métricas de éxito/fallo
- Tracing de flujos complejos
- Alertas en errores críticos

---

## 📋 CHECKLIST PRE-DEPLOYMENT

- [ ] Todos los tests pasan (unitarios + integración + E2E)
- [ ] No hay warnings en console
- [ ] Performance acceptable (< 2s por nodo)
- [ ] Documentación actualizada
- [ ] Backward compatibility verificada
- [ ] Security review completado
- [ ] Load testing completado
- [ ] Rollback plan preparado
- [ ] Monitoreo configurado
- [ ] Comunicación al equipo

---

## 📚 REFERENCIAS DEL LIBRO

- **Cap. 3:** Event-Driven Architecture & Observer Pattern
- **Cap. 7:** Factory Pattern (Creational Patterns)
- **Cap. 8:** Decorator Pattern (Structural Patterns)
- **Cap. 9:** Strategy Pattern & Middleware Pattern (Behavioral)
- **Cap. 12:** Scalability & Architectural Patterns

---

## 🎯 BENEFICIOS ESPERADOS

```
ANTES:
- Welcome Ads como módulo separado
- Código duplicado (UI + lógica)
- UX fragmentada

DESPUÉS:
✅ Welcome Ads como nodo del Flow Builder
✅ Reutilización de código (Factory, Strategy)
✅ UX unificada
✅ Acceso a TODOS los tipos de mensajes
✅ Escalable (fácil agregar nuevos nodos)
✅ Testeable (cada patrón aislado)
✅ Mantenible (clean architecture)
```

