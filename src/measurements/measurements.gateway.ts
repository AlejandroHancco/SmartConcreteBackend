import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: 'measurements',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
@Injectable()
export class MeasurementsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MeasurementsGateway.name);

  @WebSocketServer() server: Server;

  afterInit(server: Server) {
    this.logger.log('✅ WebSocket Gateway initialized');
  }

  handleConnection(socket: Socket) {
    this.logger.log(`👤 Client connected: ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`👤 Client disconnected: ${socket.id}`);
  }

  /**
   * Event 'join': Usuario se une a su sala personal
   * Frontend: socket.emit('join', userId)
   */
  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() userId: string,
  ) {
    socket.join(userId);
    this.logger.log(
      `✅ User ${userId} joined their room - Socket ID: ${socket.id}`,
    );
  }

  /**
   * Emitir progreso de medición a usuario específico
   * Se llama desde measurements.service.ts durante cada canal
   */
  emitMeasurementProgress(
    userId: string,
    jobId: string,
    channel: number,
    total: number,
    progress: number,
    message: string,
  ) {
    this.server.to(userId).emit('measurement:progress', {
      jobId,
      channel,
      total,
      percent: progress,
      status: 'measuring',
      message,
    });
    this.logger.debug(
      `📊 Progress emitted - User: ${userId}, Channel: ${channel}/${total} (${progress}%)`,
    );
  }

  /**
   * Emitir finalización de medición
   */
  emitMeasurementCompleted(
    userId: string,
    jobId: string,
    measurementId: number,
    takenAt: Date,
    totalPoints: number,
    data: any,
  ) {
    this.server.to(userId).emit('measurement:completed', {
      jobId,
      measurementId,
      takenAt,
      totalPoints,
      data,
    });
    this.logger.log(
      `✅ Measurement completed - User: ${userId}, ID: ${measurementId}, Points: ${totalPoints}`,
    );
  }

  /**
   * Emitir error de medición
   */
  emitMeasurementError(userId: string, jobId: string, message: string) {
    this.server.to(userId).emit('measurement:error', {
      jobId,
      message,
    });
    this.logger.error(
      `❌ Measurement error - User: ${userId}, Message: ${message}`,
    );
  }
}

