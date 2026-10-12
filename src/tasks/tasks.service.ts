import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { MeasurementSchedulingService } from '../scheduler/scheduling.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MeasureDto } from './dto/measure.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private teamScope: TeamScopeService,
    private schedulingService: MeasurementSchedulingService,
  ) {}

  async create(createTaskDto: CreateTaskDto, userId: string) {
    await this.teamScope.assertProjectInTeam(userId, createTaskDto.projectId);
    return this.prisma.task.create({
      data: createTaskDto,
    });
  }

  async findAll(userId: string) {
    // Solo tasks de proyectos del equipo del usuario
    const teamWhere = await this.teamScope.projectWhereForUser(userId);
    return this.prisma.task.findMany({
      where: { project: teamWhere },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, userId: string) {
    await this.teamScope.assertTaskInTeam(userId, id);
    return this.prisma.task.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateTaskDto: UpdateTaskDto, userId: string) {
    await this.teamScope.assertTaskInTeam(userId, id);
    return this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });
  }

  async remove(id: number, userId: string) {
    await this.teamScope.assertTaskInTeam(userId, id);
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async findByProject(projectId: string, userId: string, page: number = 1, limit: number = 10) {
    await this.teamScope.assertProjectInTeam(userId, projectId);
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

  async findOneWithPreference(id: number, userId: string) {
    await this.teamScope.assertTaskInTeam(userId, id);
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

  async getMeasurements(taskId: number, userId: string) {
    await this.teamScope.assertTaskInTeam(userId, taskId);
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
    await this.teamScope.assertTaskInTeam(userId, taskId);
    const jobId = `${taskId}-${Date.now()}`;
    // Control de admisión: encola si hay capacidad, 409 si la cola está
    // llena o chocaría con una medición programada (mismos dispositivos)
    return this.schedulingService.requestMeasurement(taskId, userId, {
      ranges: dto.ranges,
      selectedChannels: dto.selectedChannels,
      jobId,
    });
  }
}
