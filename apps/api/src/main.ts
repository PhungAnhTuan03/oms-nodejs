import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // rawBody: true cần cho việc xác minh chữ ký webhook Shopify ở Giai đoạn 4
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Mọi API đều bắt đầu bằng /api, ví dụ /api/products
  app.setGlobalPrefix('api');

  // whitelist: tự bỏ field lạ; forbidNonWhitelisted: báo lỗi 400 nếu gửi field lạ;
  // transform: tự đổi "20" (chuỗi trên URL) thành số 20
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('OMS API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
