import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const ROLE_ADMIN_ID = 2;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  // Al crear un proyecto, asigna automáticamente al creador como admin
  async create(createProjectDto: CreateProjectDto, creatorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: createProjectDto,
      });

      await tx.userProjectRole.create({
        data: {
          userId:    creatorUserId,
          projectId: project.uuid,
          roleId:    ROLE_ADMIN_ID,
        },
      });

      return project;
    });
  }

  async findAll() {
    return this.prisma.project.findMany();
  }

  async findOne(uuid: string) {
    const project = await this.prisma.project.findUnique({
      where: { uuid },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(uuid: string, updateProjectDto: UpdateProjectDto) {
    return this.prisma.project.update({
      where: { uuid },
      data: updateProjectDto,
    });
  }

  async remove(uuid: string) {
    return this.prisma.project.delete({
      where: { uuid },
    });
  }

  async countProjectsByRole(userId: string, roleName: string): Promise<number> {
    return this.prisma.userProjectRole.count({
      where: {
        userId,
        role: {
          name: roleName,
        },
        project: {
          is: {
            status: 'active',
          },
        },
      },
    });
  }
}