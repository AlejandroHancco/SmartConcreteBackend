import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    return this.prisma.project.create({
      data: createProjectDto,
    });
  }

  async findAll() {
    return this.prisma.project.findMany();
  }

  async findOne(uuid: string) {
    return this.prisma.project.findUnique({
      where: { uuid },
    });
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
}
