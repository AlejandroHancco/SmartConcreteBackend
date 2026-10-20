import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { buildCsv, CsvChannel, CsvMeasurement } from './measurement-csv';

export interface DateRange { from: Date | null; to: Date | null }

const channelSelect = {
  channelNumber: true, channelAlias: true, concreteMix: true, hasEmulsifier: true,
  sampleAge: true, temperature: true, humidity: true,
} satisfies Prisma.MeasurementChannelSelect;

type RawChannel = Prisma.MeasurementChannelGetPayload<{ select: typeof channelSelect }>;

const num = (d: Prisma.Decimal | null): number | null => (d === null ? null : Number(d));

function toCsvChannel(c: RawChannel): CsvChannel {
  return {
    channelNumber: c.channelNumber,
    channelAlias: c.channelAlias,
    concreteMix: num(c.concreteMix),
    hasEmulsifier: c.hasEmulsifier,
    sampleAge: c.sampleAge,
    temperature: num(c.temperature),
    humidity: num(c.humidity),
  };
}

function slug(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'tarea';
}

function yyyymmdd(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private teamScope: TeamScopeService) {}

  /** Valida y convierte `from`/`to` (ISO). `to` sin hora incluye el día completo. */
  parseRange(from?: string, to?: string): DateRange {
    const parse = (value: string | undefined, endOfDay: boolean): Date | null => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new BadRequestException(`Fecha inválida: ${value}`);
      if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
      return date;
    };
    const range = { from: parse(from, false), to: parse(to, true) };
    if (range.from && range.to && range.from > range.to) {
      throw new BadRequestException('La fecha "desde" debe ser anterior a "hasta"');
    }
    return range;
  }

  private takenAtWhere(range: DateRange): Prisma.MeasurementWhereInput {
    if (!range.from && !range.to) return {};
    return { takenAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } };
  }

  async listTasks(userId: string, projectId?: string) {
    const teamWhere = await this.teamScope.projectWhereForUser(userId);
    if (projectId) await this.teamScope.assertProjectInTeam(userId, projectId);

    const tasks = await this.prisma.task.findMany({
      where: { project: { ...teamWhere, ...(projectId ? { uuid: projectId } : {}) } },
      select: {
        id: true, name: true, status: true,
        project: { select: { uuid: true, name: true } },
        measurements: { select: { takenAt: true, watcherStatus: true } },
      },
    });

    return tasks
      .map((t) => {
        const statusCounts = { correct: 0, warning: 0, error: 0 };
        let last: Date | null = null;
        for (const m of t.measurements) {
          if (m.watcherStatus === 'correct' || m.watcherStatus === 'warning' || m.watcherStatus === 'error') {
            statusCounts[m.watcherStatus]++;
          }
          if (m.takenAt && (!last || m.takenAt > last)) last = m.takenAt;
        }
        return {
          taskId: t.id,
          taskName: t.name,
          taskStatus: t.status,
          projectId: t.project.uuid,
          projectName: t.project.name,
          measurementCount: t.measurements.length,
          lastMeasuredAt: last ? last.toISOString() : null,
          statusCounts,
        };
      })
      .sort((a, b) => (b.lastMeasuredAt ?? '').localeCompare(a.lastMeasuredAt ?? ''));
  }

  async getTaskReport(userId: string, taskId: number, range: DateRange) {
    await this.teamScope.assertTaskInTeam(userId, taskId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true, name: true, description: true,
        project: { select: { uuid: true, name: true } },
        taskPreferences: {
          take: 1,
          select: {
            name: true,
            analyzerDevice: { select: { name: true, ip: true } },
            muxDevice: { select: { name: true, ip: true } },
            ranges: { orderBy: { order: 'asc' }, select: { startFreq: true, stopFreq: true, points: true, sweepType: true } },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    const measurements = await this.prisma.measurement.findMany({
      where: { taskId, ...this.takenAtWhere(range) },
      orderBy: { takenAt: 'asc' },
      select: {
        id: true, takenAt: true, takenByName: true, presetName: true, sweepType: true,
        watcherStatus: true, watcherReason: true,
        measurementChannels: { select: channelSelect },
      },
    });

    const lastId = measurements.length ? measurements[measurements.length - 1].id : null;
    const latest = lastId
      ? await this.prisma.measurement.findUnique({
          where: { id: lastId },
          select: { id: true, takenAt: true, sweepType: true, data: true, measurementChannels: { select: channelSelect } },
        })
      : null;

    const pref = task.taskPreferences[0];
    return {
      task: { id: task.id, name: task.name, description: task.description },
      project: { id: task.project.uuid, name: task.project.name },
      preference: pref
        ? {
            name: pref.name,
            analyzer: pref.analyzerDevice,
            mux: pref.muxDevice,
            ranges: pref.ranges.map((r) => ({
              startFreq: Number(r.startFreq), stopFreq: Number(r.stopFreq), points: r.points, sweepType: r.sweepType,
            })),
          }
        : null,
      measurements: measurements.map(({ measurementChannels, ...m }) => ({
        ...m,
        channels: measurementChannels.map(toCsvChannel),
      })),
      latest: latest
        ? {
            id: latest.id,
            takenAt: latest.takenAt,
            sweepType: latest.sweepType,
            data: Array.isArray(latest.data) ? latest.data : [],
            channels: latest.measurementChannels.map(toCsvChannel),
          }
        : null,
      range: { from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null },
    };
  }

  private async loadCsvMeasurements(where: Prisma.MeasurementWhereInput): Promise<CsvMeasurement[]> {
    const rows = await this.prisma.measurement.findMany({
      where,
      orderBy: { takenAt: 'asc' },
      select: {
        id: true, takenAt: true, takenByName: true, presetName: true, watcherStatus: true, data: true,
        measurementChannels: { select: channelSelect },
      },
    });
    return rows.map(({ measurementChannels, ...m }) => ({ ...m, channels: measurementChannels.map(toCsvChannel) }));
  }

  private async taskHeader(taskId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true, project: { select: { name: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async measurementCsv(userId: string, measurementId: number): Promise<{ filename: string; content: string }> {
    await this.teamScope.assertMeasurementInTeam(userId, measurementId);
    const [measurement] = await this.loadCsvMeasurements({ id: measurementId });
    if (!measurement) throw new NotFoundException('Measurement not found');

    const { taskId } = await this.prisma.measurement.findUniqueOrThrow({ where: { id: measurementId }, select: { taskId: true } });
    const task = await this.taskHeader(taskId);
    const content = buildCsv(
      [`Kronos | Proyecto: ${task.project.name} | Tarea: ${task.name}`, `Medición ${measurementId} | Generado: ${new Date().toISOString()}`],
      [measurement],
    );
    return { filename: `kronos_${slug(task.name)}_${measurementId}_${yyyymmdd()}.csv`, content };
  }

  async taskCsv(userId: string, taskId: number, range: DateRange): Promise<{ filename: string; content: string }> {
    await this.teamScope.assertTaskInTeam(userId, taskId);
    const task = await this.taskHeader(taskId);
    const measurements = await this.loadCsvMeasurements({ taskId, ...this.takenAtWhere(range) });
    const rangeText = range.from || range.to
      ? `${range.from?.toISOString() ?? 'inicio'} a ${range.to?.toISOString() ?? 'hoy'}`
      : 'todo';
    const content = buildCsv(
      [`Kronos | Proyecto: ${task.project.name} | Tarea: ${task.name}`, `Generado: ${new Date().toISOString()} | Rango: ${rangeText}`],
      measurements,
    );
    return { filename: `kronos_${slug(task.name)}_todo_${yyyymmdd()}.csv`, content };
  }
}
