import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';

@Injectable()
export class ScheduledJobsService {
  constructor(private prisma: PrismaService) {}

  async create(createScheduledJobDto: CreateScheduledJobDto, userId: string) {
    const { taskId, ...data } = createScheduledJobDto;

    // Verificar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return this.prisma.scheduledJob.create({
      data: {
        ...data,
        taskId: taskId,
        createdBy: userId,
        status: 'pending',
      },
    });
  }

  async findAll() {
    return this.prisma.scheduledJob.findMany({
      include: {
        task: true,
        createdByUser: {
          select: {
            uuid: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(id: number) {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id },
      include: {
        task: true,
        createdByUser: {
          select: {
            uuid: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Scheduled job with ID ${id} not found`);
    }

    return job;
  }
}
