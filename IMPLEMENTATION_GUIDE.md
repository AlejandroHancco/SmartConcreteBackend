# 🛠️ GUÍA DE IMPLEMENTACIÓN PRÁCTICA
## IEEE 1876-2019 Ready - SmartConcrete Backend

---

## PARTE 1: CAMBIOS CRÍTICOS (Implementar Ya)

### 1.1 MeasurementLockService (Mutex)

**Archivo**: `src/common/services/measurement-lock.service.ts`

```typescript
import { Injectable, ConflictException, Logger } from '@nestjs/common';

interface LockAcquisition {
  taskId: number;
  acquiredAt: Date;
  expiresAt: Date;
  userId: string;
}

@Injectable()
export class MeasurementLockService {
  private locks = new Map<number, LockAcquisition>();
  private readonly logger = new Logger(MeasurementLockService.name);
  private readonly LOCK_TIMEOUT = 60000; // 60 segundos max

  /**
   * Adquirir lock para una tarea
   * Espera hasta que esté disponible (máximo LOCK_TIMEOUT)
   */
  async acquire<T>(
    taskId: number,
    userId: string,
    fn: () => Promise<T>,
    timeout = 300000, // 5 minutos max para medición completa
  ): Promise<T> {
    const lockKey = `${taskId}`;
    const startTime = Date.now();

    // Esperar hasta que el lock esté disponible
    while (this.isLocked(taskId)) {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeout) {
        throw new ConflictException(
          `Task ${taskId} is locked by another measurement. Please try again later.`,
        );
      }

      // Esperar 500ms antes de reintentar
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verificar si el lock expiró
      this.cleanupExpiredLocks();
    }

    const acquisition: LockAcquisition = {
      taskId,
      userId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + timeout),
    };

    this.locks.set(taskId, acquisition);
    this.logger.log(
      `🔒 Lock acquired for task ${taskId} by user ${userId}`,
    );

    try {
      const result = await fn();
      this.logger.log(`✅ Measurement completed for task ${taskId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error during measurement of task ${taskId}: ${error.message}`,
      );
      throw error;
    } finally {
      this.locks.delete(taskId);
      this.logger.log(`🔓 Lock released for task ${taskId}`);
    }
  }

  /**
   * Verificar si una tarea está bloqueada
   */
  isLocked(taskId: number): boolean {
    const lock = this.locks.get(taskId);
    if (!lock) return false;

    // Verificar si el lock expiró
    if (new Date() > lock.expiresAt) {
      this.locks.delete(taskId);
      return false;
    }

    return true;
  }

  /**
   * Obtener información del lock
   */
  getLockInfo(taskId: number): LockAcquisition | null {
    return this.locks.get(taskId) || null;
  }

  /**
   * Limpiar locks expirados
   */
  private cleanupExpiredLocks() {
    const now = new Date();
    for (const [taskId, lock] of this.locks) {
      if (now > lock.expiresAt) {
        this.locks.delete(taskId);
        this.logger.warn(`⏰ Lock for task ${taskId} expired and was cleared`);
      }
    }
  }

  /**
   * Forzar liberación de lock (solo admin/system)
   */
  forceRelease(taskId: number): void {
    this.locks.delete(taskId);
    this.logger.warn(`⚠️ Lock for task ${taskId} was forcefully released`);
  }

  /**
   * Obtener estado de todos los locks
   */
  getAllLocks(): Map<number, LockAcquisition> {
    this.cleanupExpiredLocks();
    return new Map(this.locks);
  }
}
```

**Uso en tasks.service.ts**:

```typescript
// tasks.service.ts
import { MeasurementLockService } from '../common/services/measurement-lock.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private measurementsService: MeasurementsService,
    private lockService: MeasurementLockService, // ← Inyectar
  ) {}

  async measure(taskId: number, dto: MeasureDto, userId: string) {
    // El lock se mantiene durante todo el tiempo de medición
    return this.lockService.acquire(
      taskId,
      userId,
      () =>
        this.measurementsService.measureTask(taskId, userId, {
          startFreq: dto.startFreq,
          stopFreq: dto.stopFreq,
          points: dto.points,
          sweepType: dto.sweepType,
          selectedChannels: dto.selectedChannels,
          jobId: `${taskId}-${Date.now()}`,
        }),
      300000, // Timeout de 5 minutos
    );
  }
}
```

**Agregar a módulo**:

```typescript
// tasks.module.ts
import { MeasurementLockService } from '../common/services/measurement-lock.service';

@Module({
  imports: [...],
  controllers: [TasksController],
  providers: [TasksService, MeasurementLockService],
})
export class TasksModule {}
```

---

### 1.2 AuditLog Service + Persiste nencia

**Schema actualizado** (`prisma/schema.prisma`):

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  userId      String   @db.Uuid
  action      String   @db.VarChar(100) // 'measurement:start', 'device:test', etc
  resourceType String  @db.VarChar(50)  // 'task', 'device', 'measurement'
  resourceId  String                    // UUID o ID numérico como string
  details     Json?                     // Datos adicionales (oldValue, newValue, etc)
  status      String   @default("success") @db.VarChar(20) // 'success', 'failure'
  ipAddress   String?  @db.VarChar(45)
  userAgent   String?  @db.VarChar(255)
  timestamp   DateTime @default(now()) @db.Timestamptz(6)

  @@index([userId, timestamp])
  @@index([action, timestamp])
  @@index([resourceType, resourceId])
  @@map("audit_logs")
  @@schema("platform")
}
```

**Archivo**: `src/audit/audit.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  status?: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Registrar evento de auditoría
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          details: entry.details || {},
          status: entry.status || 'success',
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log audit entry: ${error.message}`);
      // No relanzar error para que no rompa el flujo principal
    }
  }

  /**
   * Obtener logs de auditoría
   */
  async getLogs(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const logs = await this.prisma.auditLog.findMany({
      where: {
        AND: [
          filters.userId && { userId: filters.userId },
          filters.action && { action: filters.action },
          filters.resourceType && { resourceType: filters.resourceType },
          filters.resourceId && { resourceId: filters.resourceId },
          filters.status && { status: filters.status },
          filters.dateFrom && { timestamp: { gte: filters.dateFrom } },
          filters.dateTo && { timestamp: { lte: filters.dateTo } },
        ].filter(Boolean),
      },
      orderBy: { timestamp: 'desc' },
      skip: offset,
      take: limit,
      include: {
        // Opcional: incluir usuario si es relación
      },
    });

    return logs;
  }

  /**
   * Obtener resumen de actividad
   */
  async getActivitySummary(dateFrom: Date, dateTo: Date) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        timestamp: { gte: dateFrom, lte: dateTo },
      },
    });

    const summary = {
      totalEvents: logs.length,
      eventsByAction: {} as Record<string, number>,
      eventsByUser: {} as Record<string, number>,
      eventsByResource: {} as Record<string, number>,
      successCount: 0,
      failureCount: 0,
    };

    logs.forEach((log) => {
      summary.eventsByAction[log.action] =
        (summary.eventsByAction[log.action] || 0) + 1;
      summary.eventsByUser[log.userId] =
        (summary.eventsByUser[log.userId] || 0) + 1;
      summary.eventsByResource[log.resourceType] =
        (summary.eventsByResource[log.resourceType] || 0) + 1;

      if (log.status === 'success') summary.successCount++;
      if (log.status === 'failure') summary.failureCount++;
    });

    return summary;
  }
}
```

**Archivo**: `src/audit/audit.controller.ts`

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  @RequirePermission('audit:read') // Requiere permiso especial
  async getLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getLogs({
      userId,
      action,
      resourceType,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  @Get('summary')
  @RequirePermission('audit:read')
  async getSummary(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.auditService.getActivitySummary(
      new Date(dateFrom),
      new Date(dateTo),
    );
  }
}
```

**Uso en servicios**:

```typescript
// measurements.service.ts
async measureTask(taskId: number, userId: string, ...) {
  try {
    const measurement = await this.prisma.measurement.create({...});
    
    // Registrar auditoría
    await this.auditService.log({
      userId,
      action: 'measurement:create',
      resourceType: 'measurement',
      resourceId: measurement.id.toString(),
      status: 'success',
      details: {
        taskId,
        channels: params.selectedChannels,
        dataPoints: measurementData.length,
      },
    });

    return measurement;
  } catch (error) {
    await this.auditService.log({
      userId,
      action: 'measurement:create',
      resourceType: 'measurement',
      resourceId: taskId.toString(),
      status: 'failure',
      details: { error: error.message },
    });
    throw error;
  }
}
```

---

### 1.3 HardwareHealthService (Monitoreo Automático)

**Archivo**: `src/devices/hardware-health.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as net from 'net';
import axios from 'axios';

export interface DeviceHealthStatus {
  deviceId: string;
  deviceName: string;
  isAlive: boolean;
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

@Injectable()
export class HardwareHealthService {
  private readonly logger = new Logger(HardwareHealthService.name);
  private healthStatus = new Map<string, DeviceHealthStatus>();

  constructor(private prisma: PrismaService) {}

  /**
   * Health check cada 30 segundos
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkAllDevicesHealth() {
    const devices = await this.prisma.device.findMany();

    for (const device of devices) {
      const status = await this.checkDeviceHealth(device);
      this.healthStatus.set(device.id, status);

      const newStatus = status.isAlive ? 'online' : 'offline';
      const oldStatus = device.status;

      if (oldStatus !== newStatus) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { status: newStatus },
        });

        this.logger.warn(
          `🔴 Device ${device.name} status changed: ${oldStatus} → ${newStatus}`,
        );

        // Emitir evento para notificar usuarios
        this.onDeviceStatusChanged(device.id, newStatus);
      }
    }
  }

  /**
   * Check individual para un dispositivo
   */
  async checkDeviceHealth(device: {
    id: string;
    name: string;
    type: string | null;
    ip: string | null;
  }): Promise<DeviceHealthStatus> {
    if (!device.ip) {
      return {
        deviceId: device.id,
        deviceName: device.name,
        isAlive: false,
        lastCheck: new Date(),
        error: 'No IP address configured',
      };
    }

    try {
      if (device.type === 'analyzer') {
        const responseTime = await this.checkTCPPort(device.ip, 3570, 5000);
        return {
          deviceId: device.id,
          deviceName: device.name,
          isAlive: responseTime !== null,
          lastCheck: new Date(),
          responseTime: responseTime || undefined,
        };
      } else if (device.type === 'mux') {
        const responseTime = await this.checkHTTP(device.ip, 5000);
        return {
          deviceId: device.id,
          deviceName: device.name,
          isAlive: responseTime !== null,
          lastCheck: new Date(),
          responseTime: responseTime || undefined,
        };
      }
    } catch (error: any) {
      return {
        deviceId: device.id,
        deviceName: device.name,
        isAlive: false,
        lastCheck: new Date(),
        error: error.message || 'Unknown error',
      };
    }

    return {
      deviceId: device.id,
      deviceName: device.name,
      isAlive: false,
      lastCheck: new Date(),
      error: 'Unsupported device type',
    };
  }

  /**
   * Ping TCP (para Hioki)
   */
  private checkTCPPort(
    host: string,
    port: number,
    timeout: number,
  ): Promise<number | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = net.createConnection({ host, port });
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        const responseTime = Date.now() - startTime;
        socket.destroy();
        resolve(responseTime);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(null);
      });

      socket.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Ping HTTP (para MUX)
   */
  private async checkHTTP(
    url: string,
    timeout: number,
  ): Promise<number | null> {
    try {
      const startTime = Date.now();
      await axios.head(`http://${url}`, { timeout });
      const responseTime = Date.now() - startTime;
      return responseTime;
    } catch {
      return null;
    }
  }

  /**
   * Obtener estado de salud de un dispositivo
   */
  getDeviceHealth(deviceId: string): DeviceHealthStatus | null {
    return this.healthStatus.get(deviceId) || null;
  }

  /**
   * Obtener estado de salud de todos
   */
  getAllDevicesHealth(): DeviceHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Callback cuando cambia estado (puede integrar con WebSocket)
   */
  private onDeviceStatusChanged(deviceId: string, newStatus: string) {
    // TODO: Integrar con MeasurementsGateway para notificar usuarios
    // this.gateway.emitStatusChange(deviceId, newStatus);
  }

  /**
   * Forzar health check inmediato
   */
  async forceHealthCheck(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    return this.checkDeviceHealth(device);
  }
}
```

**Agregar permiso en DB**:

```sql
INSERT INTO platform.permissions (id, description) VALUES
('devices:health:read', 'Read device health status')
ON CONFLICT DO NOTHING;
```

**Endpoint**:

```typescript
@Controller('api/v1/devices/health')
@UseGuards(JwtAuthGuard)
export class DeviceHealthController {
  constructor(private healthService: HardwareHealthService) {}

  @Get(':deviceId')
  @RequirePermission('devices:health:read')
  getDeviceHealth(@Param('deviceId') deviceId: string) {
    return this.healthService.getDeviceHealth(deviceId);
  }

  @Get()
  @RequirePermission('devices:health:read')
  getAllDevicesHealth() {
    return this.healthService.getAllDevicesHealth();
  }
}
```

---

## PARTE 2: CAMBIOS MEDIOS (Next Sprint)

### 2.1 Swagger/OpenAPI Documentation

**Instalar**:

```bash
npm install @nestjs/swagger swagger-ui-express
```

**Actualizar `src/main.ts`**:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // ── Swagger Configuration ────────────────────────
  const config = new DocumentBuilder()
    .setTitle('SmartConcrete Backend API')
    .setDescription(
      'IEEE 1876-2019 Lab as a Service (LaaS) for Remote Concrete Testing',
    )
    .setVersion('1.0.0')
    .setContact(
      'SmartConcrete Team',
      'https://smartconcrete.example.com',
      'support@smartconcrete.example.com',
    )
    .setLicense(
      'MIT',
      'https://opensource.org/licenses/MIT',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addTag('Auth', 'Authentication and authorization')
    .addTag('Devices', 'Hardware device management')
    .addTag('Tasks', 'Measurement tasks')
    .addTag('Measurements', 'Measurement data and results')
    .addTag('TaskChannels', 'Channel configuration')
    .addTag('Metadata', 'System metadata and capabilities')
    .addTag('Audit', 'Audit logs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
  console.log('✅ Application running on port 3000');
  console.log('📚 Swagger documentation: http://localhost:3000/api/docs');
}

bootstrap();
```

**Documentar endpoints con `@ApiOperation`, `@ApiResponse`**:

```typescript
// tasks.controller.ts
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class TasksController {
  @Post(':id/measure')
  @ApiOperation({
    summary: 'Start measurement on task',
    description: 'Initiates a measurement on selected channels with specified parameters',
  })
  @ApiResponse({
    status: 201,
    description: 'Measurement started successfully',
    schema: {
      example: {
        measurementId: 123,
        takenAt: '2026-05-16T10:30:00Z',
        totalPoints: 801,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Task is already being measured by another user',
  })
  @RequirePermission('measurements:create')
  measure(
    @Param('id') id: string,
    @Body() measureDto: MeasureDto,
    @Request() req: any,
  ) {
    return this.tasksService.measure(+id, measureDto, req.user.uuid);
  }
}
```

---

### 2.2 Metadata Service

**Archivo**: `src/metadata/metadata.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

export interface ParameterMetadata {
  name: string;
  unit: string;
  type: 'number' | 'integer' | 'enum' | 'boolean' | 'string';
  min?: number;
  max?: number;
  default?: any;
  enum?: any[];
  precision?: number;
  description: string;
}

export interface DeviceMetadata {
  id: string;
  name: string;
  type: 'sensor' | 'actuator';
  manufacturer: string;
  model: string;
  description: string;
  version: string;
  parameters: ParameterMetadata[];
  capabilities: string[];
  limitations?: string[];
}

export interface ExperimentCapabilities {
  maxConcurrentMeasurements: number;
  maxChannels: number;
  frequencyRange: { min: number; max: number; unit: string };
  temperatureRange?: { min: number; max: number; unit: string };
  humidityRange?: { min: number; max: number; unit: string };
  dataFormats: string[];
  exportFormats: string[];
  experimentTypes: string[];
  maxDataRetention: string;
  supportedSampleTypes: string[];
}

@Injectable()
export class MetadataService {
  getSensorMetadata(): Record<string, DeviceMetadata> {
    return {
      'hioki-im3570': {
        id: 'hioki-im3570',
        name: 'Hioki IM3570 Impedance Analyzer',
        type: 'sensor',
        manufacturer: 'Hioki',
        model: 'IM3570',
        version: '1.0',
        description:
          'High-precision impedance analyzer for materials testing. Measures conductance (G) and susceptance (B) across frequency spectrum.',
        capabilities: [
          'frequency-sweep',
          'real-time-measurement',
          'data-logging',
          'temperature-compensation',
        ],
        limitations: [
          'Maximum 1 test at a time',
          'Ambient temperature: 0-40°C',
          'Requires warmup: 30 minutes',
        ],
        parameters: [
          {
            name: 'startFrequency',
            unit: 'Hz',
            type: 'number',
            min: 4,
            max: 1000000,
            default: 1000,
            precision: 0.01,
            description: 'Starting frequency for frequency sweep',
          },
          {
            name: 'stopFrequency',
            unit: 'Hz',
            type: 'number',
            min: 4,
            max: 1000000,
            default: 1000000,
            precision: 0.01,
            description: 'Ending frequency for frequency sweep',
          },
          {
            name: 'points',
            unit: 'count',
            type: 'integer',
            min: 1,
            max: 801,
            default: 801,
            description: 'Number of measurement points in sweep',
          },
          {
            name: 'sweepType',
            unit: 'enumeration',
            type: 'enum',
            enum: ['LOG', 'LIN'],
            default: 'LOG',
            description: 'Sweep type - logarithmic or linear',
          },
        ],
      },
    };
  }

  getActuatorMetadata(): Record<string, DeviceMetadata> {
    return {
      'mux-selector': {
        id: 'mux-selector',
        name: 'Channel Multiplexer (MUX)',
        type: 'actuator',
        manufacturer: 'SmartConcrete',
        model: 'MX-16',
        version: '1.0',
        description: 'Switches measurement circuits between 16 sample channels',
        capabilities: ['channel-selection', 'latching', 'quick-switching'],
        parameters: [
          {
            name: 'channel',
            unit: 'index',
            type: 'integer',
            min: 1,
            max: 16,
            description: 'Channel number to activate (1-16)',
          },
        ],
      },
    };
  }

  getExperimentCapabilities(): ExperimentCapabilities {
    return {
      maxConcurrentMeasurements: 1,
      maxChannels: 16,
      frequencyRange: { min: 4, max: 1000000, unit: 'Hz' },
      temperatureRange: { min: -10, max: 50, unit: '°C' },
      humidityRange: { min: 0, max: 100, unit: '%' },
      dataFormats: ['JSON', 'CSV'],
      exportFormats: ['JSON', 'CSV', 'XLSX'],
      experimentTypes: ['concrete-impedance', 'material-properties'],
      maxDataRetention: 'unlimited',
      supportedSampleTypes: [
        'concrete-cube',
        'concrete-cylinder',
        'mortar-sample',
        'custom',
      ],
    };
  }

  /**
   * Validar parámetros contra metadata
   */
  validateParameters(
    deviceId: string,
    parameters: Record<string, any>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const metadata = this.getSensorMetadata()[deviceId];

    if (!metadata) {
      return {
        valid: false,
        errors: [`Device ${deviceId} not found in metadata`],
      };
    }

    for (const param of metadata.parameters) {
      const value = parameters[param.name];

      if (value === undefined && param.name !== 'optional') {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      if (param.type === 'number' || param.type === 'integer') {
        if (value < param.min! || value > param.max!) {
          errors.push(
            `${param.name} must be between ${param.min} and ${param.max}`,
          );
        }
      }

      if (param.type === 'enum' && param.enum) {
        if (!param.enum.includes(value)) {
          errors.push(
            `${param.name} must be one of: ${param.enum.join(', ')}`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
```

**Endpoint**:

```typescript
@Controller('api/v1/metadata')
@UseGuards(JwtAuthGuard)
export class MetadataController {
  constructor(private metadataService: MetadataService) {}

  @Get('sensors')
  @ApiOperation({ summary: 'Get sensor metadata' })
  getSensorMetadata() {
    return this.metadataService.getSensorMetadata();
  }

  @Get('actuators')
  @ApiOperation({ summary: 'Get actuator metadata' })
  getActuatorMetadata() {
    return this.metadataService.getActuatorMetadata();
  }

  @Get('capabilities')
  @ApiOperation({ summary: 'Get experiment capabilities' })
  getCapabilities() {
    return this.metadataService.getExperimentCapabilities();
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate parameters against metadata' })
  validateParameters(
    @Query('deviceId') deviceId: string,
    @Body() parameters: Record<string, any>,
  ) {
    return this.metadataService.validateParameters(deviceId, parameters);
  }
}
```

---

## PARTE 3: CHECKLIST DE IMPLEMENTACIÓN

### Sprint 1 (Esta semana)
- [ ] Implementar MeasurementLockService + integrar en tasks.service
- [ ] Crear AuditLog table + AuditService
- [ ] Llogar todas las acciones en measurements.service
- [ ] Crear AuditController con permisos
- [ ] Implementar HardwareHealthService + @Cron
- [ ] Agregar DeviceHealthController
- [ ] Instalar @nestjs/swagger
- [ ] Documentar todos los endpoints con @ApiOperation/@ApiResponse
- [ ] Crear MetadataService
- [ ] Crear MetadataController

### Sprint 2 (Próximas 2 semanas)
- [ ] Implementar ErrorBoundary/Circuit Breaker
- [ ] Crear SafetyService con emergency stop
- [ ] Agregar logging centralized (Winston/Pino)
- [ ] Implement DeviceAdapter abstraction
- [ ] Crear DeviceRegistry
- [ ] Add rate limiting

### Sprint 3 (Futuro)
- [ ] LTI Tool Provider para Moodle
- [ ] xAPI Tracker
- [ ] SCORM export
- [ ] Learning analytics dashboard

---

##INSTALACIONES NECESARIAS

```bash
# Ya tienes
npm install @nestjs/common @nestjs/core @nestjs/jwt @nestjs/passport

#Agregar
npm install @nestjs/swagger swagger-ui-express
npm install @nestjs/schedule
npm install express-rate-limit
npm install winston winston-daily-rotate-file

# Desarrollo
npm install --save-dev @types/express-rate-limit
```

---

**Documento Generado**: 2026-05-16  
**Próximos pasos**: Implementar en orden de prioridad


