import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskPreferenceDto } from './dto/create-task-preference.dto';
import { UpdateTaskPreferenceDto } from './dto/update-task-preference.dto';

@Injectable()
export class TaskPreferencesService {
  constructor(private prisma: PrismaService) {}

  async create(createTaskPreferenceDto: CreateTaskPreferenceDto) {
    return this.prisma.taskPreference.create({
      data: createTaskPreferenceDto,
    });
  }

  async findAll() {
    return this.prisma.taskPreference.findMany();
  }

  async findOne(id: number) {
    return this.prisma.taskPreference.findUnique({
      where: { id },
    });
  }

  async getActivePreference(taskId: number) {
    return this.prisma.$queryRaw`
      SELECT * FROM platform.get_active_preference(${taskId})
    `;
  }

  async update(id: number, updateTaskPreferenceDto: UpdateTaskPreferenceDto) {
    return this.prisma.taskPreference.update({
      where: { id },
      data: updateTaskPreferenceDto,
    });
  }

  async remove(id: number) {
    return this.prisma.taskPreference.delete({
      where: { id },
    });
  }
}
