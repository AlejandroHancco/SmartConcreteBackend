import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';

@Injectable()
export class ScheduledJobsService {
  constructor(
    private prisma: PrismaService,
    private teamScope: TeamScopeService,
  ) {}

  async create(createScheduledJobDto: CreateScheduledJobDto, userId: string) {
    const { taskId, ...data } = createScheduledJobDto;

    // Verificar que la tarea existe Y pertenece al equipo del usuario
    await this.teamScope.assertTaskInTeam(userId, taskId);

    return this.prisma.scheduledJob.create({
      data: {
        ...data,
        taskId,
        createdBy: userId,
        status: 'pending',
      },
    });
  }

  async findAll(userId: string) {
    const teamWhere = await this.teamScope.projectWhereForUser(userId);

    return this.prisma.scheduledJob.findMany({
      where: { task: { project: teamWhere } },
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

  async findOne(id: number, userId: string) {
    await this.teamScope.assertScheduledJobInTeam(userId, id);

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

  async remove(id: number, userId: string) {
    await this.teamScope.assertScheduledJobInTeam(userId, id);

    const job = await this.prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Scheduled job with ID ${id} not found`);
    }

    if (job.status === 'running') {
      throw new BadRequestException('No se puede eliminar un job en ejecución');
    }

    return this.prisma.scheduledJob.delete({ where: { id } });
  }
}
