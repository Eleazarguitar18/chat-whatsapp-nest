import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*' });
  // ==========================================
  // CONFIGURACIÓN DE SWAGGER (OPENAPI)
  // ==========================================
  const config = new DocumentBuilder()
    .setTitle('WhatsApp API Gateway')
    .setDescription('Servicio modularizado para el envío de notificaciones y gestión de estados de WhatsApp')
    .setVersion('1.0')
    .addTag('WhatsApp Core', 'Gestión de conexión y código QR')
    .addTag('Messages', 'Operaciones de envío de mensajería del sistema')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Levantamos la interfaz en la ruta http://localhost:3000/docs
  SwaggerModule.setup('docs', app, document);
  await app.listen(process.env.PORT ?? 3000);
  console.log(`📖 Documentación Swagger disponible en: http://localhost:3000/docs`);
}
bootstrap();
