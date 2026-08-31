import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  dotenv.config();

  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.FRONTEND_URLS || 'http://localhost:3000,http://localhost:5174,http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  //swagger 
  const options = new DocumentBuilder()
    .setTitle('Crud-with-node')
    .setDescription('This applicatin is just created for test purpose')
    .setVersion('1.0')
    .addTag('Crystal')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
