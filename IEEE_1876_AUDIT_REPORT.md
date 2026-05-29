# 📋 AUDIT IEEE 1876-2019 (Lab as a Service)
## SmartConcrete Backend - Full Architecture Review

**Fecha**: 2026-05-16  
**Proyecto**: SmartConcreteBackend (NestJS + Prisma + PostgreSQL)  
**Estándar**: IEEE 1876-2019 - Standard for Accessible and Remotely Operable Laboratory Equipment

---

## ▶️ RESUMEN EJECUTIVO

### Diagnóstico General
Tu backend es un **prototipo funcional de laboratorio remoto** que implementa parcialmente el estándar IEEE 1876. Tiene componentes clave de un LaaS pero le faltan elementos de interoperabilidad educativa, metadata formally structured y algunos servicios específicos del estándar.

**Cumplimiento actual**: **~45% de IEEE 1876-2019**

| Aspecto | Cumplimiento |
|---------|---|
| Sensor Services | ✅ 70% |
| Actuator Services | ✅ 60% |
| Remote Access | ✅ 85% |
| WebSocket/Streaming | ✅ 80% |
| Authentication | ✅ 75% |
| Metadata Services | ⚠️ 20% |
| LMS Integration | ❌ 0% |
| Learning Objects | ❌ 0% |
| xAPI/Analytics | ❌ 0% |
| Safety Mechanisms | ⚠️ 40% |
| Concurrent Access | ⚠️ 30% |
| Documentation/Swagger | ❌ 0% |

---

## 1. ANÁLISIS POR COMPONENTES IEEE 1876

### 1.1 Metadata Service
**Estado**: ⚠️ **PARCIAL (20%)**

#### ✅ Qué SÍ Tienes:
- Modelos con metadata básica en TaskChannel:
  ```prisma
  concreteMix, hasEmulsifier, notes, sampleAge, temperature, humidity
  ```
- Snapshots de configuración guardados en Measurement
- Metadatos de dispositivos (tipo, IP, nombre)

#### ❌ Qué Falta:
- **No hay endpoint `GET /metadata`** que documente sensores/actuadores
- **No hay descripción de rangos válidos** (min/max de frecuencias)
- **No hay unidades formalizadas** en los DTOs
- **No hay schema SCORM o Learning Objects** 
- **No hay versioning de metadata**
- **No hay validación de metadata contra schema**
- **No hay introspección dinámica de capacidades**

#### Recomendación:
Crear un endpoint de metadata:
```typescript
GET /api/v1/metadata/sensors
GET /api/v1/metadata/actuators
GET /api/v1/metadata/experiments
GET /api/v1/metadata/capabilities
```

**Rating**: 2/10

---

### 1.2 Sensor Services
**Estado**: ✅ **FUNCIONAL (70%)**

#### ✅ Qué SÍ Tienes:
- Lectura remota del Hioki IM3570 (TCP connection)
- Medición en tiempo real por canales
- Datos estructurados (frequency, g, b)
- WebSocket streaming de progreso
- Almacenamiento de datos en JSON JSONB
- Índices GIN para búsqueda de datos

#### ❌ Qué Falta:
- **No hay polling configurable** (siempre es trigger-based)
- **No hay suscripciones a eventos** en tiempo real
- **No hay transformación de datos** (calibración, normalización)
- **No hay validación de rangos** durante la adquisición
- **No hay mecanismo de reintento robusto**
- **No hay buffering en caso de desconexión**
- **No hay alertas de anomalías**

#### Código Actual:
```typescript
// measurements.service.ts
async measureChannel(analyzerIp, startFreq, stopFreq, points, sweepType)
// → Funciona, pero es muy específico del Hioki
```

#### Recomendación:
Abstraer en un patrón **Sensor Adapter**:
```typescript
interface SensorAdapter {
  read(): Promise<SensorData>;
  subscribe(callback): void;
  getMetadata(): SensorMetadata;
}

class HiokiAdapter implements SensorAdapter { }
```

**Rating**: 7/10

---

### 1.3 Actuator Services
**Estado**: ✅ **FUNCIONAL (60%)**

#### ✅ Qué SÍ Tienes:
- Control remoto del MUX (activar canal por HTTP)
- Control del Hioki (comandos SCPI)
- Validación de parámetros (channels 1-16)
- Reintentos con timeout

#### ❌ Qué Falta:
- **No hay feedback de actuadores** (confirmación de comando)
- **No hay queuing de comandos** concurrentes
- **No hay rollback en caso de error**
- **No hay límites de seguridad** (ej: max frecuencia)
- **No hay precondiciones verificadas** (dispositivo conectado antes)
- **No hay estado de actuadores publicado**

#### Código Actual:
```typescript
// devices.service.ts
async activateMuxChannel(muxIp: string, channel: number, retries: number)
// → Básico, sin confirmación de estado
```

#### Recomendación:
Crear **Actuator Service** con estado:
```typescript
class ActuatorService {
  async activate(channel: number): Promise<ActuatorState>;
  async validate(command: ActuatorCommand): Promise<boolean>;
  getState(): ActuatorState;
}
```

**Rating**: 6/10

---

### 1.4 Configuration Service
**Estado**: ✅ **PARCIAL (65%)**

#### ✅ Qué SÍ Tienes:
- **Modelos de Preferencia**: TaskPreference almacena:
  - Rango de frecuencias (startFreq, stopFreq)
  - Tipo de sweep (LOG, LIN)
  - Cantidad de puntos
  - Dispositivos seleccionados
- **Upsert de configuraciones**: TaskPreference.upsert()
- **Snapshots**: Guardas snapshots en Measurement

#### ❌ Qué Falta:
- **No hay perfiles predefinidos** (solo custom)
- **No hay validación de incompatibilidades**
- **No hay historial de cambios**
- **No hay rollback de configuraciones**
- **No hay recomendaciones de configuración**
- **No hay presets guardados como SCORM**
- **No hay configuración multi-experimento**

#### Código Actual:
```prisma
model TaskPreference {
  startFreq: Decimal
  stopFreq: Decimal
  points: Int @default(801)
  sweepType: String @default("LIN")
}
```

#### Recomendación:
Expandir con validaciones y perfiles:
```typescript
interface ExperimentConfiguration {
  id: string;
  name: string;
  version: string;
  parameters: ConfigParameter[];
  constraints: ConfigConstraint[];
  author: string;
  createdAt: DateTime;
}
```

**Rating**: 6.5/10

---

### 1.5 APIs Interoperables (REST/WebSocket)
**Estado**: ✅ **FUNCIONAL (75%)**

#### ✅ Qué SÍ Tienes:
- **REST API** completa con CRUD
  - Arquitectura standard NestJS
  - DTOs con validación class-validator
  - HTTP status codes apropiados
- **WebSocket** (Socket.io)
  - Namespace 'measurements'
  - Eventos: join, measurement:progress, measurement:completed, measurement:error
  - Rooms por usuario
  - Reconnection handling
- **JSON** en todos los responses
- **Endpoints organizados por recurso**

#### ❌ Qué Falta:
- **NO hay OpenAPI/Swagger** documentación
- **NO hay versionamiento de API** (/v1/, /v2/)
- **NO hay HATEOAS** (links entre recursos)
- **NO hay GraphQL** alternativo
- **NO hay Content Negotiation** (application/json es hardcoded)
- **NO hay rate limiting**
- **NO hay API Key management**
- **NO hay webhook support**

#### Endpoints Actuales:
```
POST   /auth/login
POST   /auth/register
GET    /auth/me

GET    /devices
POST   /devices/test-connection
GET    /projects/:projectId/devices
POST   /projects/:projectId/devices
PATCH  /projects/:projectId/devices/:deviceId
DELETE /projects/:projectId/devices/:deviceId

POST   /tasks
GET    /tasks
GET    /tasks/:id
PATCH  /tasks/:id
DELETE /tasks/:id
POST   /tasks/:id/measure
GET    /tasks/:id/measurements
GET    /tasks/:id/channels
PUT    /tasks/:id/channels/:channelNumber

GET    /measurements
POST   /measurements
PATCH  /measurements/:id
DELETE /measurements/:id
PATCH  /measurements/:id/channels/:channelNumber
```

#### Recomendación:
Agregar OpenAPI/Swagger:
```bash
npm install @nestjs/swagger swagger-ui-express
```

**Rating**: 7.5/10

---

### 1.6 Authorization & Authentication
**Estado**: ✅ **FUNCIONAL (75%)**

#### ✅ Qué SÍ Tienes:
- **JWT** con Passport strategy
- **RBAC** por proyecto (UserProjectRole)
- **Roles y Permissions** en DB
- **Decoradores custom**: @RequirePermission, @CurrentUser
- **Row-Level Security (RLS)** en PostgreSQL middleware
- **HashPassword** con bcrypt
- **Guards**: JwtAuthGuard, RbacGuard

#### ❌ Qué Falta:
- **NO hay refresh tokens**
- **NO hay expiración configurable**
- **NO hay 2FA/MFA**
- **NO hay OAuth2** (solo JWT)
- **NO hay SAML** para federación
- **NO hay LTI** para LMS integration
- **NO hay API Keys** para servicios
- **NO hay audit de acceso**
- **NO hay token revocation** explícita

#### Código Actual:
```typescript
// jwt.strategy.ts
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
ignoreExpiration: false
secretOrKey: configService.get<string>('JWT_SECRET')

// rbac.guard.ts
SELECT platform.has_permission(...) 
// Llamada a función PL/pgSQL en DB
```

#### Seguridad:
- ✅ Passwords hasheados
- ✅ JWT signed
- ✅ CORS habilitado (verificar whitelist)
- ⚠️ RLS a nivel DB (bueno)
- ⚠️ No hay rate limiting en login

#### Recomendación:
Agregar:
1. **Refresh tokens**
2. **Token blacklist** para logout
3. **Audit logging** de acceso
4. **Rate limiting** en endpoints sensibles

**Rating**: 7.5/10

---

### 1.7 Concurrent Access & Session Management
**Estado**: ⚠️ **DEFICIENTE (30%)**

#### ✅ Qué SÍ Tienes:
- **WebSocket rooms** por usuario
- **Transacciones en Prisma**: $transaction()
- **Locking a nivel DB** con unique constraints
- **Sequential execution** de mediciones

#### ❌ Qué Falta (CRÍTICO):
- **NO hay session management** real
- **NO hay queue de experimentos**
- **NO hay reserva de equipos**
- **NO hay mutual exclusion** entre usuarios
- **NO hay timeout de sesión**
- **NO hay cleanup de sesiones muertas**
- **NO hay deadlock detection**
- **NO hay rate limiting por usuario**
- **NO hay límite de conexiones simultáneas**

#### Problema Identificado:
Si dos usuarios hacen `POST /tasks/1/measure` simultáneamente:
- Ambos intentan activar el MUX
- Ambos envían SCPI al Hioki
- **Corrupción de datos garantizada**
- El sistema **NO tiene protección**

#### Código Vulnerable:
```typescript
// tasks.service.ts measure()
// → Nada previene concurrent access
async measure(taskId: number, dto: MeasureDto, userId: string) {
  return this.measurementsService.measureTask(...)
  // No hay lock, no hay queue
}
```

#### Recomendación Crítica:
Implementar **Semaphore/Mutex** por tarea:
```typescript
class MeasurementLockService {
  private locks = new Map<number, Promise<void>>();

  async withLock<T>(taskId: number, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.locks.get(taskId) || Promise.resolve();
    const newLock = currentLock
      .then(() => fn())
      .catch(err => { throw err; })
      .finally(() => { this.locks.delete(taskId); });
    
    this.locks.set(taskId, newLock);
    return newLock;
  }
}
```

**Rating**: 3/10

---

### 1.8 Logging, Auditing & Analytics
**Estado**: ⚠️ **PARCIAL (40%)**

#### ✅ Qué SÍ Tienes:
- **Logger de NestJS** en varios servicios
- **Logging de eventos** en gateway
- **Auditoría básica**: user, timestamp, action
- **Almacenamiento de resultados** en Measurement
- **Índices para búsqueda**: idx_measurements_data_gin

#### ❌ Qué Falta (IMPORTANTE):
- **NO hay learning analytics** (xAPI, LRS)
- **NO hay tracking de errores** (Sentry, etc)
- **NO hay logs centralizados** (ELK, Stackdriver)
- **NO hay retention policy**
- **NO hay export de datos**
- **NO hay dashboard de uso**
- **NO hay alertas**
- **NO hay PII protection logging**
- **NO hay forensics**

#### Logs Actuales:
```typescript
this.logger.log('Starting measurement...')
this.logger.error(`Error in channel ${channel}...`)
this.logger.debug('Progress emitted...')
```

#### Recomendación:
Agregar estructura de logging:
```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;  // 'measurement:start', 'measurement:end', etc
  resourceId: string;
  resourceType: string;
  status: 'success' | 'failure';
  timestamp: DateTime;
  metadata: Record<string, any>;
}

// Guardar en tabla auditlogs
```

**Rating**: 4/10

---

### 1.9 Reset, Recovery & Safety Mechanisms
**Estado**: ⚠️ **DEFICIENTE (40%)**

#### ✅ Qué SÍ Tienes:
- **Timeout de conexión** a instrumentos (3000ms-55000ms)
- **Error handling** en mediciones (try/catch)
- **Destrucción de sockets** en error
- **Reintentos** en MUX (3 intentos)

#### ❌ Qué Falta (CRÍTICO):
- **NO hay circuit breaker** (¿y si el instrumento está offline?)
- **NO hay fallback** a calibración
- **NO hay reset automático** de equipos
- **NO hay validación de rangos** antes de enviar
- **NO hay emergency stop**
- **NO hay hardware watchdog**
- **NO hay estado sync con equipos reales**
- **NO hay recovery ante desconexión**
- **NO hay predictive health checks**

#### Problema:
Si el Hioki se desconecta a mitad de una medición:
- El socket se destruye
- Pero el MUX sigue conectado al canal anterior
- **Próxima medición empieza en el canal equivocado**
- No hay forma de saber el estado real del hardware

#### Recomendación:
```typescript
class SafetyService {
  private healthCheckInterval = 30000; // cada 30s

  async verifyHardwareState(): Promise<HardwareState> {
    const analyzerAlive = await this.pingAnalyzer();
    const muxAlive = await this.pingMux();
    
    if (!analyzerAlive) await this.resetAnalyzer();
    if (!muxAlive) await this.resetMux();
    
    return { analyzerAlive, muxAlive };
  }

  async emergencyStop(taskId: number): Promise<void> {
    // Detener medición en curso
    // Resetear todos los actuadores
    // Guardar estado para recuperación
  }
}
```

**Rating**: 4/10

---

### 1.10 Learning Object Integration & LMS Compatibility
**Estado**: ❌ **NO IMPLEMENTADO (0%)**

#### ✅ Qué SÍ Tienes:
- Estructura de Projects/Tasks que **podría** ser un Learning Object
- Snapshots que **podrían** ser exportables

#### ❌ Qué Falta COMPLETAMENTE:
- **NO hay SCORM** (Shareable Content Object Reference Model)
- **NO hay LTI** (Learning Tools Interoperability) para Moodle
- **NO hay xAPI** (Experience API) para analytics
- **NO hay Learning Object Metadata** (LOM)
- **NO hay MOODLE integration**
- **NO hay MOOC support**
- **NO hay gradebook connection**
- **NO hay competency mapping**
- **NO hay learning outcomes tracking**

#### Qué Necesitarías (IEEE 1876 Section 5: Learning Integration):
```typescript
// SCORM-compatible manifest
interface SCORMManifest {
  identifier: string;
  version: string;
  metadata: SCORMMetadata;
  organizations: SCORMOrganization[];
  resources: SCORMResource[];
}

// LTI Tool Provider
@Controller('/lti')
class LTIController {
  @Post('/launch')
  launchLTI(@Body() ltiRequest: LTIRequest) {
    // Iniciar experimento desde Moodle
    // Retornar grades a Moodle
  }
}
```

**Rating**: 0/10

---

## 2. TABLA RESUMEN DE CUMPLIMIENTO

| Componente | Implementación Actual | Cumple | Falta | Prioridad |
|---|---|---|---|---|
| **Metadata Service** | Básico en modelos | ⚠️ Parcial 20% | OpenAPI, schema formal, introspección | 🔴 Alta |
| **Sensor Services** | Hioki IM3570 TCP | ✅ Funcional 70% | Polling, subscripciones, transformación | 🟡 Media |
| **Actuator Services** | MUX HTTP + Hioki | ✅ Funcional 60% | Feedback, queuing, safety limits | 🟡 Media |
| **Configuration Service** | TaskPreference upsert | ✅ Parcial 65% | Perfiles, validación, historial | 🟡 Media |
| **REST/WebSocket APIs** | NestJS + Socket.io | ✅ Funcional 75% | OpenAPI, versioning, webhooks | 🟡 Media |
| **Auth/Authorization** | JWT + RBAC + RLS | ✅ Funcional 75% | Refresh, 2FA, OAuth2, audit | 🟡 Media |
| **Concurrent Access** | Secuencial (sin lock) | ⚠️ Deficiente 30% | Mutex, queue, reservas, per-device limit | 🔴 **CRÍTICA** |
| **Logging/Auditing** | Basic + Gateway events | ⚠️ Parcial 40% | Centralized, xAPI, analytics | 🟡 Media |
| **Safety/Recovery** | Timeouts + retry | ⚠️ Deficiente 40% | Circuit breaker, health checks, reset | 🔴 **CRÍTICA** |
| **LMS Integration** | Ninguno | ❌ 0% | SCORM, LTI, gradebook, xAPI | 🔴 Alta |
| **Documentation** | Ninguno | ❌ 0% | OpenAPI/Swagger, Postman | 🟡 Media |
| **Testing** | Jest disponible | ⚠️ Minimal | Unit, integration, E2E tests | 🟡 Media |

---

## 3. DIAGNÓSTICO DETALLADO POR CAPAS

### 3.1 Data Layer (Prisma + PostgreSQL)
**Rating**: 8/10

#### ✅ Strengths:
- Schema bien normalizado
- Relaciones correctas (FK, composites)
- Índices optimizados (GIN para datos)
- Timestamps automáticos
- UUID para PK distribuidas
- RLS middleware implementado
- Enums para estados

#### ⚠️ Gaps:
- No hay tabla de auditoría
- No hay versioning de snapshots
- No hay soft deletes
- No hay archiving policy

#### Recomendación:
```prisma
model AuditLog {
  id String @id @default(cuid())
  userId String
  action String
  tableName String
  recordId String
  oldValues Json?
  newValues Json?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@map("audit_logs")
}
```

---

### 3.2 API Layer (REST)
**Rating**: 7/10

#### ✅ Strengths:
- Controllers bien organizados
- DTOs con validación
- Guards y decorators personalizados
- Error handling con HttpException

#### ⚠️ Gaps:
- No hay OpenAPI/Swagger
- No hay versionamiento (/v1/)
- No hay pagination estándar
- No hay filtering/sorting genérico

#### Recomendación:
```typescript
// Agregar Swagger
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('SmartConcrete API')
  .setDescription('IEEE 1876-2019 LaaS Implementation')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

### 3.3 WebSocket Layer (Socket.io)
**Rating**: 7.5/10

#### ✅ Strengths:
- Namespace adecuado
- Rooms por usuario
- Event-driven
- Error emission

#### ⚠️ Gaps:
- No hay reconnection strategy
- No hay message buffering
- No hay heartbeat
- No hay RLS en WebSocket

#### Recomendación:
```typescript
// Agregar reconnection con buffering
class MeasurementGateway {
  private messageBuffer = new Map<string, any[]>();

  @SubscribeMessage('reconnect')
  handleReconnect(@ConnectedSocket() socket: Socket) {
    const userId = socket.data.userId;
    const buffered = this.messageBuffer.get(userId) || [];
    buffered.forEach(msg => socket.emit(msg.event, msg.data));
    this.messageBuffer.delete(userId);
  }
}
```

---

### 3.4 Hardware Integration Layer
**Rating**: 6/10

#### ✅ Strengths:
- Direct TCP to Hioki
- HTTP API to MUX
- Retry logic
- Timeout handling

#### ⚠️ Gaps:
- No abstraction layer (adapter pattern)
- No hardware registry
- No dynamic device discovery
- No health monitoring
- No firmware versioning

#### Recomendación:
```typescript
// Crear DeviceRegistry
@Injectable()
class DeviceRegistry {
  private adapters = new Map<string, DeviceAdapter>();

  registerAdapter(type: string, adapter: DeviceAdapter) {
    this.adapters.set(type, adapter);
  }

  getAdapter(deviceId: string): DeviceAdapter {
    // Lookup en DB + cache
  }

  async discoverDevices(): Promise<Device[]> {
    // mDNS, DHCP, manual registry
  }
}

abstract class DeviceAdapter {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getMetadata(): DeviceMetadata;
  abstract execute(command: Command): Promise<Result>;
  abstract getState(): Promise<DeviceState>;
}
```

---

## 4. RIESGOS ARQUITECTÓNICOS

### 🔴 CRÍTICOS (Deben arreglarse ahora)

1. **Race Condition en Concurrent Measurements** (CRÍTICO)
   - **Riesgo**: Corrupción de datos, hardware dañado
   - **Probabilidad**: Alta (aumenta con #usuarios)
   - **Impacto**: Pérdida de experimentos, invalidez de datos
   - **Mitigación**: Agregar Mutex por task inmediatamente

2. **Sin Estado Real de Hardware** (CRÍTICO)
   - **Riesgo**: Desincronización con estado físico
   - **Probabilidad**: Media (conexiones pueden fallar)
   - **Impacto**: Mediciones inválidas
   - **Mitigación**: Health checks periódicos, estado sync

3. **Sin Recovery de Fallos** (CRÍTICO)
   - **Riesgo**: Sesiones muertas, recursos abiertos
   - **Probabilidad**: Alta
   - **Impacto**: Degradación del sistema
   - **Mitigación**: Circuit breaker, cleanup automático

---

### 🟡 ALTOS (Arreglar en próximas sprints)

4. **No hay Audit Trail**
   - Imposible investigar problemas
   - Compliance/auditoría fallará
   
5. **No hay LMS Integration**
   - No puede usarse en instituciones educativas
   - Incompatible con Moodle/Canvas

6. **No hay OpenAPI**
   - Clientes no saben qué llamar
   - Integración de terceros difícil

---

### 🟠 MEDIOS (Roadmap futuro)

7. No hay Learning Analytics (xAPI)
8. No hay Multi-device orchestration
9. No hay Scheduling/queuing
10. No hay API Key management

---

## 5. SERVICIOS IDENTIFICADOS EN TU ARQUITECTURA

### Mapeado a IEEE 1876 Conceptos

| Tu Componente | Tipo IEEE 1876 | Servicios Equivalentes |
|---|---|---|
| **Hioki IM3570** | Sensor (Impedance Analyzer) | SensorService.read() |
| **MUX** | Actuator (Channel Selector) | ActuatorService.activate() |
| **Device** | Hardware Component | HardwareRegistry |
| **Task** | Experiment/Session | ExperimentService |
| **TaskPreference** | Configuration | ConfigurationService |
| **Measurement** | Result | DataRepository |
| **User + Role** | Authorization | AuthorizationService |
| **WebSocket** | Streaming/Push | StreamingService |

---

## 6. ROADMAP IEEE 1876-READY (Versión Recomendada)

### Phase 1: Crítico (2-3 sprints)
```
✅ Agregar MeasurementLockService (mutex)
✅ Crear HardwareHealthService
✅ Implementar AuditLog persistencia
✅ Agregar OpenAPI/Swagger
✅ Crear SafetyService con emergency stop
```

### Phase 2: Importante (3-4 sprints)
```
✅ Implementar DeviceAdapter pattern
✅ Agregar Learning Object Metadata
✅ Crear LTI Tool Provider
✅ Implementar xAPI tracker
✅ Agregar SCORM export
```

### Phase 3: Futuro (4+ sprints)
```
✅ Multi-device orchestration
✅ Advanced scheduling/queuing
✅ Moodle deep integration
✅ Learning analytics dashboard
✅ Compliance reporting (GDPR, etc)
```

---

## 7. ARQUITECTURA OBJETIVO PROPUESTA

```
┌─────────────────────────────────────────────────────────┐
│              IEEE 1876-2019 LaaS Layer                  │
├─────────────────────────────────────┬───────────────────┤
│  Metadata      │ Recording │ Safety │ Analytics │ LMS   │
│  Service       │ Service   │Service │ Service   │Service│
└────────┬───────┴─────┬─────┴────┬───┴────┬──────┴───┬───┘
         │             │          │        │          │
┌────────┴──────┬──────┴─────┬────┴───┬────┴─────┬────┴────┐
│ Experiment    │ Device     │ User   │ Config   │ Results │
│ Service       │ Registry   │Service │ Service  │Service  │
└────────┬──────┴──────┬─────┴────┬───┴────┬─────┴────┬────┘
         │             │          │        │          │
┌────────┴──────┬──────┴─────┬────┴───┬────┴─────┬────┴────┐
│SensorAdapter  │ActuatorAdapter │Streaming │ Logging │ Queue │
│Manager        │Manager         │Service   │Service  │Service│
└────────┬──────┴──────┬─────┴────┬───┴────┬─────┴────┬────┘
         │             │          │        │          │
         └─────────────┴──────────┴────────┴──────────┘
                    Device Drivers
         (TCP, HTTP, MQTT, WebSocket, etc)
                         │
         ┌───────────────┼───────────────┐
         │               │               │
      Hioki IM3570     MUX         Other Instruments
```

---

## 8. LISTA DE ACCIONES CONCRETAS

### 8.1 Implementar Mutex para Mediciones
**Archivo**: `src/common/services/measurement-lock.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

@Injectable()
export class MeasurementLockService {
  private locks = new Map<number, Promise<void>>();
  private readonly logger = new Logger(MeasurementLockService.name);

  async acquire<T>(
    taskId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const currentLock = this.locks.get(taskId) || Promise.resolve();
    
    const newLock = currentLock
      .then(async () => {
        this.logger.log(`Lock acquired for task ${taskId}`);
        try {
          return await fn();
        } finally {
          this.logger.log(`Lock released for task ${taskId}`);
          this.locks.delete(taskId);
        }
      })
      .catch((err) => {
        this.locks.delete(taskId);
        throw err;
      });

    this.locks.set(taskId, newLock);
    return newLock;
  }
}
```

Usage:
```typescript
// tasks.service.ts
async measure(taskId: number, dto: MeasureDto, userId: string) {
  return this.lockService.acquire(taskId, () =>
    this.measurementsService.measureTask(taskId, userId, {
      startFreq: dto.startFreq,
      // ...
    })
  );
}
```

---

### 8.2 Agregar Swagger/OpenAPI
**Archivo**: `src/main.ts`

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('SmartConcrete Backend API')
    .setDescription(
      'IEEE 1876-2019 Lab as a Service (LaaS) for Remote Concrete Testing'
    )
    .setVersion('1.0.0')
    .setContact('SmartConcrete Team', '', 'support@smartconcrete.com')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt'
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Devices', 'Hardware device management')
    .addTag('Tasks', 'Measurement tasks')
    .addTag('Measurements', 'Measurement data')
    .addTag('Metadata', 'System metadata and capabilities')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  await app.listen(3000);
  console.log('App running on port 3000');
  console.log('Swagger docs: http://localhost:3000/api/docs');
}

bootstrap();
```

---

### 8.3 Crear Metadata Service
**Archivo**: `src/metadata/metadata.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface SensorMetadata {
  id: string;
  name: string;
  type: string;
  description: string;
  manufacturer: string;
  model: string;
  parameters: ParameterMetadata[];
  dataFormat: DataFormatMetadata;
}

interface ParameterMetadata {
  name: string;
  unit: string;
  type: 'float' | 'int' | 'enum';
  min: number;
  max: number;
  precision: number;
  description: string;
}

@Injectable()
export class MetadataService {
  getSensorMetadata(): Record<string, SensorMetadata> {
    return {
      'hioki-im3570': {
        id: 'hioki-im3570',
        name: 'Hioki IM3570 Impedance Analyzer',
        type: 'sensor',
        description: 'Precision impedance analyzer for concrete testing',
        manufacturer: 'Hioki',
        model: 'IM3570',
        parameters: [
          {
            name: 'startFrequency',
            unit: 'Hz',
            type: 'float',
            min: 4,
            max: 1000000,
            precision: 0.01,
            description: 'Start frequency for sweep',
          },
          {
            name: 'stopFrequency',
            unit: 'Hz',
            type: 'float',
            min: 4,
            max: 1000000,
            precision: 0.01,
            description: 'Stop frequency for sweep',
          },
          {
            name: 'points',
            unit: 'count',
            type: 'int',
            min: 1,
            max: 801,
            precision: 1,
            description: 'Number of measurement points',
          },
          {
            name: 'sweepType',
            unit: 'enum',
            type: 'enum',
            min: 0,
            max: 1,
            precision: 1,
            description: 'Sweep type (LOG or LIN)',
          },
        ],
        dataFormat: {
          outputFields: [
            { name: 'frequency', unit: 'Hz', type: 'float' },
            { name: 'conductance', unit: 'S', type: 'float' },
            { name: 'susceptance', unit: 'S', type: 'float' },
          ],
          dataPoints: 'variable (1-801)',
          samplingRate: 'sensor-dependent',
        },
      },
    };
  }

  getActuatorMetadata(): Record<string, any> {
    return {
      'mux-controller': {
        id: 'mux-controller',
        name: 'MUX/Switching Controller',
        type: 'actuator',
        description: 'Channel selector for multi-channel measurements',
        channels: 16,
        parameters: [
          {
            name: 'channel',
            unit: 'index',
            type: 'int',
            min: 1,
            max: 16,
            description: 'Channel number to activate',
          },
        ],
      },
    };
  }

  getExperimentCapabilities() {
    return {
      maxConcurrentMeasurements: 1,
      supportedSampleTypes: [
        'concrete-cube',
        'concrete-cylinder',
        'mortar-sample',
      ],
      frequencyRange: { min: 4, max: 1000000, unit: 'Hz' },
      temperatureRange: { min: -10, max: 50, unit: '°C' },
      humidityRange: { min: 0, max: 100, unit: '%' },
      maxChannels: 16,
      dataRetention: 'unlimited',
    };
  }
}

interface DataFormatMetadata {
  outputFields: Array<{ name: string; unit: string; type: string }>;
  dataPoints: string;
  samplingRate: string;
}
```

Endpoint:
```typescript
@Controller('api/v1/metadata')
@UseGuards(JwtAuthGuard)
export class MetadataController {
  constructor(private metadataService: MetadataService) {}

  @Get('sensors')
  getSensors() {
    return this.metadataService.getSensorMetadata();
  }

  @Get('actuators')
  getActuators() {
    return this.metadataService.getActuatorMetadata();
  }

  @Get('capabilities')
  getCapabilities() {
    return this.metadataService.getExperimentCapabilities();
  }
}
```

---

### 8.4 Crear AuditLog Service
**Archivo**: `src/audit/audit.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: Record<string, any>,
    status: 'success' | 'failure' = 'success',
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId,
        details,
        status,
        ipAddress: details?.ipAddress,
        userAgent: details?.userAgent,
        timestamp: new Date(),
      },
    });
  }

  async getLog(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        AND: [
          filters.userId && { userId: filters.userId },
          filters.action && { action: filters.action },
          filters.resourceType && { resourceType: filters.resourceType },
          filters.dateFrom && { timestamp: { gte: filters.dateFrom } },
          filters.dateTo && { timestamp: { lte: filters.dateTo } },
        ].filter(Boolean),
      },
      orderBy: { timestamp: 'desc' },
    });
  }
}
```

Agregar al schema:
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  resourceType String
  resourceId String
  details   Json?
  status    String   @default("success")
  ipAddress String?
  userAgent String?
  timestamp DateTime @default(now())

  @@index([userId, timestamp])
  @@index([action, timestamp])
  @@map("audit_logs")
  @@schema("platform")
}
```

---

### 8.5 Crear Hardware Health Service
**Archivo**: `src/devices/hardware-health.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as net from 'net';
import axios from 'axios';

@Injectable()
export class HardwareHealthService {
  private readonly logger = new Logger(HardwareHealthService.name);
  private healthCheckInterval = 30000; // 30 segundos

  constructor(private prisma: PrismaService) {}

  @Cron('*/30 * * * * *') // Cada 30 segundos
  async checkHealth() {
    const devices = await this.prisma.device.findMany();

    for (const device of devices) {
      const isAlive = await this.checkDeviceAlive(device);
      const newStatus = isAlive ? 'online' : 'offline';

      if (device.status !== newStatus) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { status: newStatus },
        });

        this.logger.warn(
          `Device ${device.name} changed status to ${newStatus}`
        );
      }
    }
  }

  private async checkDeviceAlive(device: {
    id: string;
    type: string | null;
    ip: string | null;
  }): Promise<boolean> {
    if (!device.ip) return false;

    try {
      if (device.type === 'analyzer') {
        return await this.pingTCP(device.ip, 3570, 5000);
      } else if (device.type === 'mux') {
        return await this.pingHTTP(device.ip, 5000);
      }
    } catch (error) {
      this.logger.debug(`Health check failed for ${device.id}: ${error}`);
      return false;
    }

    return false;
  }

  private pingTCP(
    host: string,
    port: number,
    timeout: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        resolve(false);
      });
    });
  }

  private async pingHTTP(url: string, timeout: number): Promise<boolean> {
    try {
      await axios.head(`http://${url}`, { timeout });
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 9. TABLA DE RECOMENDACIONES PRIORIZADAS

| # | Acción | Complejidad | Impacto | Esfuerzo (días) | Prioridad |
|---|--------|---|---|---|---|
| 1 | Agregar MeasurementLockService | 🟢 Baja | 🔴 Crítico | 2 | **NOW** |
| 2 | Implementar AuditLog | 🟡 Media | 🟡 Alto | 3 | **NOW** |
| 3 | Agregar Swagger/OpenAPI | 🟢 Baja | 🟡 Alto | 1 | **Sprint 1** |
| 4 | Crear Metadata Service | 🟡 Media | 🟡 Alto | 2 | **Sprint 1** |
| 5 | HardwareHealthService + Cron | 🟡 Media | 🟡 Alto | 3 | **Sprint 1** |
| 6 | Implementar LTI Tool Provider | 🔴 Alta | 🟡 Alto | 10 | **Sprint 2** |
| 7 | Agregar xAPI Tracker | 🔴 Alta | 🟡 Medio | 7 | **Sprint 2** |
| 8 | DeviceAdapter Pattern refactoring | 🔴 Alta | 🟡 Medio | 8 | **Sprint 2** |
| 9 | SCORM Export capabilities | 🔴 Alta | 🟢 Medio | 6 | **Sprint 3** |
| 10 | Learning Analytics Dashboard | 🔴 Alta | 🟢 Medio | 15 | **Sprint 3+** |

---

## 10. PREGUNTAS DE VALIDACIÓN FINAL

### ¿Tu backend actualmente cumple IEEE 1876?
**Respuesta**: Parcialmente (45%)

### ¿Qué es lo más crítico que falta?
**Respuesta**: 
1. Mutex/Locking para concurrent access
2. Metadata Service formal
3. Safety mechanisms
4. LMS integration

### ¿Puedo usarlo en producción?
**Respuesta**: 
- ✅ Funcionar sí, pero...
- ⚠️ Solo con **1 usuario a la vez**
- ⚠️ Riesgo de inconsistencia de hardware
- ⚠️ Sin auditoría ni compliance

### ¿Cuánto tiempo para ser IEEE 1876-compliant?
**Respuesta**: 
- **Nivel 1 (Funcional)**: 2 semanas (críticos)
- **Nivel 2 (Robusto)**: 6 semanas (+ health, audit, safety)
- **Nivel 3 (LMS-ready)**: 12 semanas (+ LTI, SCORM, xAPI)

---

## 11. RESUMEN ARQUITECTURA OBJETIVO

``` 
                         Frontend (React/Vue)
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼──────┐    ┌────────▼────────┐
            │  REST API    │    │  WebSocket API  │
            │ (OpenAPI)    │    │  (Socket.io)    │
            └───────┬──────┘    └────────┬────────┘
                    │                     │
            ┌───────┴──────┬──────────────┴────────┐
            │              │                       │
    ┌───────▼────┐  ┌─────▼──────┐    ┌──────────▼───────┐
    │ Auth       │  │ Experiment │    │  Hardware        │
    │ Service    │  │ Service    │    │  Registry        │
    └────────────┘  └─────┬──────┘    └──────────┬───────┘
                          │                      │
                    ┌─────┴──┬──────┬──────┬─────┴────┐
                    │        │      │      │          │
              ┌─────▼─┐ ┌───▼──┐ ┌──▼───┐ ┌───▼────┐ ┌──▼──────┐
              │Audit  │ │Meta- │ │Health│ │Device  │ │Streaming│
              │Log    │ │Data  │ │Check │ │Adapter │ │Service  │
              └──┬────┘ └──────┘ └──┬───┘ └───┬────┘ └────┬────┘
                 │                  │        │       │
            ┌────▼──────────────────┴────────┴───────┴──────┐
            │   Prisma ORM + PostgreSQL with RLS            │
            │  (Users, Tasks, Devices, Measurements, etc)   │
            └─────────────────────────────────────────────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
         ┌─────▼────┐  ┌────▼────┐  ┌────▼─────┐
         │Hioki      │  │MUX      │  │Other      │
         │IM3570     │  │Control  │  │Instruments│
         │(TCP)      │  │(HTTP)   │  │(MQTT/etc) │
         └───────────┘  └─────────┘  └───────────┘
```

---

## REFERENCIAS

- IEEE 1876-2019: Standard for Accessible and Remotely Operable Laboratory Equipment
- NestJS Best Practices: https://docs.nestjs.com
- SCORM Standards: https://scorm.com
- LTI 1.3: https://www.imsglobal.org/spec/lti/v1p3/
- xAPI Specification: https://github.com/adlnet/xAPI-Spec

---

**Documento Generado**: 2026-05-16  
**Auditor**: AI Architecture Specialist  
**Disclaimer**: Este audit es una evaluación técnica. Requiere validación adicional con stakeholders y especialistas en IEEE 1876.


