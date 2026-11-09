import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
new Logger('Worker').log('Worker đã chạy, đang chờ việc trong hàng đợi');
