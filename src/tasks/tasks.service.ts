import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MeasurementsService } from '../measurements/measurements.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MeasureDto } from './dto/measure.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private measurementsService: MeasurementsService,
  ) {}

  async create(createTaskDto: CreateTaskDto) {
    return this.prisma.task.create({
      data: createTaskDto,
    });
  }

  async findAll() {
    return this.prisma.task.findMany();
  }

  async findOne(id: number) {
    return this.prisma.task.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateTaskDto: UpdateTaskDto) {
    return this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });
  }

  async remove(id: number) {
    return this.prisma.task.delete({
      where: { id },
    });
  }
  async findByProject(projectId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where: { projectId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({
        where: { projectId },
      }),
    ]);

    return { items, total, page, limit };
  }

  async findOneWithPreference(id: number) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const activePreference = await this.prisma.taskPreference.findFirst({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        analyzerDevice: true,
        muxDevice: true,
        ranges: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return {
      ...task,
      activePreference: activePreference ? { ...activePreference } : null,
    };
  }




  async getMeasurements(taskId: number) {
    const measurements = await this.prisma.measurement.findMany({
      where: { taskId },
      orderBy: { takenAt: 'desc' },
      select: {
        id: true,
        takenAt: true,
        takenBy: true,
        startFreq: true,
        stopFreq: true,
        analyzerName: true,
        muxName: true,
      },
    });

    return measurements.map(m => ({
      ...m,
      startFreq: Number(m.startFreq),
      stopFreq: Number(m.stopFreq),
    }));
  }

  async measure(taskId: number, dto: MeasureDto, userId: string) {
    // Generar jobId único para tracking
    const jobId = `${taskId}-${Date.now()}`;

    // Delegar a measurements.service que maneja WebSocket
    return this.measurementsService.measureTask(taskId, userId, {
      startFreq: dto.startFreq,
      stopFreq: dto.stopFreq,
      points: dto.points,
      sweepType: dto.sweepType,
      selectedChannels: dto.selectedChannels,
      jobId,
      rangeId: (dto as any).rangeId,
    });
  }
}
