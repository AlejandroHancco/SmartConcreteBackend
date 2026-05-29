import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Device, Prisma, TaskPreference } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskPreferenceDto } from './dto/create-task-preference.dto';
import { UpdateTaskPreferenceDto } from './dto/update-task-preference.dto';

export interface TaskPreferenceResponse {
  id: number;
  taskId: number;
  name: string;
  startFreq: number;
  stopFreq: number;
  points: number;
  sweepType: string;
  createdAt: string;
  updatedAt: string;
  analyzerDevice: {
    id: string;
    name: string;
    type: string | null;
    ip: string | null;
  };
  muxDevice: {
    id: string;
    name: string;
    type: string | null;
    ip: string | null;
  };
}

type TaskPreferenceWithDevices = TaskPreference & {
  analyzerDevice: Device;
  muxDevice: Device;
};

@Injectable()
export class TaskPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTaskPreference(taskId: number): Promise<TaskPreferenceResponse | null> {
    const preference = await this.prisma.taskPreference.findUnique({
      where: { taskId },
      include: {
        analyzerDevice: true,
        muxDevice: true,
      },
    });

    return preference ? this.mapToResponse(preference) : null;
  }

  async createTaskPreference(
    taskId: number,
    dto: CreateTaskPreferenceDto,
  ): Promise<TaskPreferenceResponse> {
    const existing = await this.prisma.taskPreference.findUnique({
      where: { taskId },
    });

    if (existing) {
      throw new HttpException(
        'Ya existe una preferencia para esta tarea',
        HttpStatus.CONFLICT,
      );
    }

    const analyzer = await this.prisma.device.findUnique({
      where: { id: dto.analyzerDeviceId },
    });

    if (!analyzer) {
      throw new HttpException(
        'Analizador no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const mux = await this.prisma.device.findUnique({
      where: { id: dto.muxDeviceId },
    });

    if (!mux) {
      throw new HttpException('MUX no encontrado', HttpStatus.NOT_FOUND);
    }

    const preference = await this.prisma.taskPreference.create({
      data: {
        taskId,
        ...dto,
      },
      include: {
        analyzerDevice: true,
        muxDevice: true,
      },
    });

    return this.mapToResponse(preference);
  }

  async updateTaskPreference(
    taskId: number,
    dto: UpdateTaskPreferenceDto,
  ): Promise<TaskPreferenceResponse> {
    try {
      const preference = await this.prisma.taskPreference.update({
        where: { taskId },
        data: dto,
        include: {
          analyzerDevice: true,
          muxDevice: true,
        },
      });

      return this.mapToResponse(preference);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new HttpException(
          'TaskPreference no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }

      throw error;
    }
  }

  async removeTaskPreference(taskId: number): Promise<TaskPreferenceResponse> {
    try {
      const preference = await this.prisma.taskPreference.delete({
        where: { taskId },
        include: {
          analyzerDevice: true,
          muxDevice: true,
        },
      });

      return this.mapToResponse(preference);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new HttpException(
          'TaskPreference no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }

      throw error;
    }
  }

  private mapToResponse(
    preference: TaskPreferenceWithDevices,
  ): TaskPreferenceResponse {
    return {
      id: preference.id,
      taskId: preference.taskId,
      name: preference.name,
      startFreq: Number(preference.startFreq),
      stopFreq: Number(preference.stopFreq),
      points: preference.points,
      sweepType: preference.sweepType,
      createdAt: preference.createdAt?.toISOString() ?? '',
      updatedAt: preference.updatedAt?.toISOString() ?? '',
      analyzerDevice: {
        id: preference.analyzerDevice.id,
        name: preference.analyzerDevice.name,
        type: preference.analyzerDevice.type,
        ip: preference.analyzerDevice.ip,
      },
      muxDevice: {
        id: preference.muxDevice.id,
        name: preference.muxDevice.name,
        type: preference.muxDevice.type,
        ip: preference.muxDevice.ip,
      },
    };
  }
}
