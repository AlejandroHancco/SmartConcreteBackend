import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TeamsModule } from './teams/teams.module';
import { TasksModule } from './tasks/tasks.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { DevicesModule } from './devices/devices.module';
import { TaskChannelsModule } from './task-channels/task-channels.module';
import { MeasurementChannelsModule } from './measurement-channels/measurement-channels.module';
import { ScheduledJobsModule } from './scheduled-jobs/scheduled-jobs.module';
import { PrismaService } from './prisma/prisma.service';
import { RlsMiddleware } from './prisma/prisma.middleware';
import { PrismaModule } from './prisma/prisma.module';

console.log('ANTES DE NEST:', process.env.DATABASE_URL);
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TeamsModule,
    TasksModule,
    MeasurementsModule,
    DevicesModule,
    TaskChannelsModule,
    MeasurementChannelsModule,
    ScheduledJobsModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RlsMiddleware).forRoutes('*');
  }
}
