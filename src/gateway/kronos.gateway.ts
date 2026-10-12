import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

export interface JobStatusPayload {
  jobId: string;
  taskId?: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying';
  attempt?: number;
  error?: string;
}

/**
 * Gateway principal de tiempo real (namespace /kronos).
 * - Sala `user:{userId}`  → estado de jobs y notificaciones personales
 * - Sala `task:{taskId}`  → updates de mediciones de una tarea específica
 */
@WebSocketGateway({
  namespace: 'kronos',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
@Injectable()
export class KronosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(KronosGateway.name);

  @WebSocketServer() server: Server;

  handleConnection(socket: Socket) {
    this.logger.log(`Client connected: ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  /** Frontend: socket.emit('join', userId) → sala personal */
  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() socket: Socket, @MessageBody() userId: string) {
    socket.join(`user:${userId}`);
    this.logger.log(`User ${userId} joined personal room`);
  }

  /** Frontend: socket.emit('join-task', taskId) → suscripción a updates de la tarea */
  @SubscribeMessage('join-task')
  handleJoinTask(@ConnectedSocket() socket: Socket, @MessageBody() taskId: number | string) {
    socket.join(`task:${taskId}`);
    this.logger.log(`Socket ${socket.id} joined task room ${taskId}`);
  }

  /** Frontend: socket.emit('leave-task', taskId) */
  @SubscribeMessage('leave-task')
  handleLeaveTask(@ConnectedSocket() socket: Socket, @MessageBody() taskId: number | string) {
    socket.leave(`task:${taskId}`);
  }

  /** Emite a todos los clientes suscritos a la tarea cuando termina una medición */
  emitMeasurementComplete(taskId: number, data: any) {
    this.server.to(`task:${taskId}`).emit('measurement:complete', { taskId, ...data });
    this.logger.log(`measurement:complete emitted to task:${taskId}`);
  }

  /** Notifica el estado del job (queued/processing/completed/failed/retrying) al usuario */
  emitJobStatus(userId: string, status: JobStatusPayload) {
    this.server.to(`user:${userId}`).emit('job:status', status);
    this.logger.debug(`job:status ${status.status} emitted to user:${userId}`);
  }

  /** Notificación in-app en tiempo real */
  emitNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.log(`notification emitted to user:${userId}`);
  }
}
