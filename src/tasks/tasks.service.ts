import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { MeasureDto } from './dto/measure.dto';
import * as net from 'net';
import axios from 'axios';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

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
  async findByProject(projectId: string) {
    return this.prisma.task.findMany({
      where: {projectId},
    });
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
    });

    return {
      ...task,
      points: task.points ? Number(task.points) : null,
      startFreq: Number(task.startFreq),
      stopFreq: Number(task.stopFreq),
      activePreference: activePreference ? {
        ...activePreference,
        startFreq: Number(activePreference.startFreq),
        stopFreq: Number(activePreference.stopFreq),
      } : null,
    };
  }

  async getActivePreference(taskId: number) {
    const preference = await this.prisma.taskPreference.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    if (!preference) {
      throw new NotFoundException('No active preference found for this task');
    }

    return {
      ...preference,
      startFreq: Number(preference.startFreq),
      stopFreq: Number(preference.stopFreq),
    };
  }

  async createPreference(taskId: number, dto: CreatePreferenceDto, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.taskPreference.create({
      data: {
        taskId,
        analyzerName: dto.analyzerName,
        analyzerIp: dto.analyzerIp,
        analyzerDeviceId: dto.analyzerDeviceId,
        muxName: dto.muxName,
        muxIp: dto.muxIp,
        muxDeviceId: dto.muxDeviceId,
        startFreq: dto.startFreq,
        stopFreq: dto.stopFreq,
        createdBy: userId,
      },
    });
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
    // Get active preference
    const preference = await this.getActivePreference(taskId);

    const allData = new Map<number, { g: number[]; b: number[] }>();

    for (let channel = 1; channel <= 16; channel++) {
      // Activate MUX channel with retries
      await this.activateMuxChannel(preference.muxIp, channel);

      // Connect to analyzer
      const socket = await this.connectToAnalyzer(preference.analyzerIp);

      try {
        // Send commands
        await this.sendCommand(socket, ':MODE ANALyzer');
        await this.sendCommand(socket, ':SWEep:TRIGger SEQuential');
        await this.sendCommand(socket, `:LIST:STARt:STOP ${dto.startFreq},${dto.stopFreq},${dto.points},${dto.sweepType}`);
        await this.sendCommand(socket, ':PARameter1 G');
        await this.sendCommand(socket, ':PARameter3 B');
        await this.sendCommand(socket, '*TRG');

        // Get measurement data
        const response = await this.sendCommand(socket, ':MEASure?');
        const data = this.parseCsvResponse(response);

        // Store data
        for (const [freq, g, b] of data) {
          if (!allData.has(freq)) {
            allData.set(freq, { g: new Array(16).fill(0), b: new Array(16).fill(0) });
          }
          allData.get(freq)!.g[channel - 1] = g;
          allData.get(freq)!.b[channel - 1] = b;
        }
      } finally {
        socket.destroy();
      }
    }

    // Build final data
    const data = Array.from(allData.entries()).map(([frequency, vals]) => ({
      frequency,
      g: vals.g,
      b: vals.b,
    }));

    // Save measurement
    const measurement = await this.prisma.measurement.create({
      data: {
        taskId,
        takenBy: userId,
        startFreq: dto.startFreq,
        stopFreq: dto.stopFreq,
        analyzerName: preference.analyzerName,
        analyzerIp: preference.analyzerIp,
        muxName: preference.muxName,
        muxIp: preference.muxIp,
        taskPreferenceId: preference.id,
        data,
      },
    });

    return {
      measurementId: measurement.id,
      takenAt: measurement.takenAt,
      totalPoints: data.length,
    };
  }

  private async activateMuxChannel(muxIp: string, channel: number): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await axios.get(`http://${muxIp}/?orden=${channel}`, { timeout: 5000 });
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      } catch (error) {
        if (attempt === 3) {
          throw new HttpException(`Failed to activate MUX channel ${channel}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  private async connectToAnalyzer(ip: string): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: ip, port: 3570 }, () => {
        resolve(socket);
      });

      socket.on('error', (err) => {
        reject(new HttpException(`Failed to connect to analyzer: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR));
      });

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new HttpException('Connection to analyzer timed out', HttpStatus.INTERNAL_SERVER_ERROR));
      }, 60000);

      socket.on('connect', () => {
        clearTimeout(timeout);
      });
    });
  }

  private async sendCommand(socket: net.Socket, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = command + '\r\n';
      socket.write(cmd);

      let buffer = '';
      const onData = (data: Buffer) => {
        buffer += data.toString();
        if (buffer.includes('\n')) {
          socket.removeListener('data', onData);
          resolve(buffer.trim());
        }
      };

      socket.on('data', onData);

      setTimeout(() => {
        socket.removeListener('data', onData);
        reject(new HttpException('Command timeout', HttpStatus.INTERNAL_SERVER_ERROR));
      }, 10000);
    });
  }

  private parseCsvResponse(response: string): [number, number, number][] {
    const lines = response.split('\n').filter(line => line.trim());
    const data: [number, number, number][] = [];

    for (const line of lines) {
      const parts = line.split(',').map(p => parseFloat(p.trim()));
      if (parts.length >= 3) {
        data.push([parts[0], parts[1], parts[2]]);
      }
    }

    return data;
  }
}
