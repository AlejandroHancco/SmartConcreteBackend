import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTaskChannelDto } from './dto/update-task-channel.dto';
import { TaskChannelResponse } from './task-channels.types';

type TaskChannelRecord = {
  channelNumber: number;
  alias: string;
  concreteMix: { toString(): string } | null;
  hasEmulsifier: boolean | null;
  notes: string | null;
  sampleAge: number | null;
  temperature: { toString(): string } | null;
  humidity: { toString(): string } | null;
};

@Injectable()
export class TaskChannelsService {
  constructor(private prisma: PrismaService) {}

  async getTaskChannels(taskId: number): Promise<TaskChannelResponse[]> {
    await this.ensureTaskExists(taskId);

    const existingChannels = await this.prisma.taskChannel.findMany({
      where: { taskId },
    });

    const channelMap = new Map(
      existingChannels.map((channel) => [channel.channelNumber, channel]),
    );

    return Array.from({ length: 16 }, (_, index) => {
      const channelNumber = index + 1;
      const channel = channelMap.get(channelNumber);

      return {
        channelNumber,
        alias: channel?.alias ?? `Canal ${channelNumber}`,
        concreteMix: channel?.concreteMix ? Number(channel.concreteMix) : null,
        hasEmulsifier: channel?.hasEmulsifier ?? null,
        notes: channel?.notes ?? null,
        sampleAge: channel?.sampleAge ?? null,
        temperature: channel?.temperature ? Number(channel.temperature) : null,
        humidity: channel?.humidity ? Number(channel.humidity) : null,
      };
    });
  }

  async updateTaskChannel(
    taskId: number,
    channelNumber: number,
    dto: UpdateTaskChannelDto,
  ): Promise<TaskChannelResponse> {
    if (channelNumber < 1 || channelNumber > 16) {
      throw new BadRequestException(
        'channelNumber must be between 1 and 16',
      );
    }

    await this.ensureTaskExists(taskId);

    const result = await this.prisma.taskChannel.upsert({
      where: {
        taskId_channelNumber: { taskId, channelNumber },
      },
      create: {
        taskId,
        channelNumber,
        alias: dto.alias,
        concreteMix: dto.concreteMix ?? null,
        hasEmulsifier: dto.hasEmulsifier ?? false,
        notes: dto.notes ?? null,
        sampleAge: dto.sampleAge ?? null,
        temperature: dto.temperature ?? null,
        humidity: dto.humidity ?? null,
      },
      update: {
        alias: dto.alias,
        concreteMix: dto.concreteMix ?? null,
        hasEmulsifier: dto.hasEmulsifier ?? false,
        notes: dto.notes ?? null,
        sampleAge: dto.sampleAge ?? null,
        temperature: dto.temperature ?? null,
        humidity: dto.humidity ?? null,
      },
    });

    return this.toTaskChannelResponse(result);
  }

  private async ensureTaskExists(taskId: number): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
  }

  private toTaskChannelResponse(result: TaskChannelRecord): TaskChannelResponse {
    return {
      channelNumber: result.channelNumber,
      alias: result.alias,
      concreteMix: result.concreteMix ? Number(result.concreteMix) : null,
      hasEmulsifier: result.hasEmulsifier,
      notes: result.notes,
      sampleAge: result.sampleAge,
      temperature: result.temperature ? Number(result.temperature) : null,
      humidity: result.humidity ? Number(result.humidity) : null,
    };
  }
}
