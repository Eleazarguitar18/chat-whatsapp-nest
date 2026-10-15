import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

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
  // PROTECCIÓN DE DOCUMENTACIÓN CON BASIC AUTH
  // ==========================================
  const SWAGGER_USER = process.env.SWAGGER_USER ?? 'admin';
  const SWAGGER_PASS = process.env.SWAGGER_PASS ?? 'admin123';

  const swaggerAuthMiddleware: express.RequestHandler = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Swagger Documentation"');
      res.status(401).json({ message: 'Unauthorized: Missing or invalid Authorization header' });
      return;
    }

    try {
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      if (username !== SWAGGER_USER || password !== SWAGGER_PASS) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Swagger Documentation"');
        res.status(401).json({ message: 'Unauthorized: Invalid credentials' });
        return;
      }
    } catch {
      res.setHeader('WWW-Authenticate', 'Basic realm="Swagger Documentation"');
      res.status(401).json({ message: 'Unauthorized: Malformed credentials' });
      return;
    }

    next();
  };

  // Proteger la interfaz Swagger UI y el JSON del spec
  app.use('/docs', swaggerAuthMiddleware);
  app.use('/docs-json', swaggerAuthMiddleware);

  // ==========================================
  // CONFIGURACIÓN DE SWAGGER (OPENAPI)
  // ==========================================
  const config = new DocumentBuilder()
    .setTitle('WhatsApp API Gateway')
    .setDescription('Servicio modularizado para el envío de notificaciones y gestión de estados de WhatsApp')
    .setVersion('1.0')
    .addTag('WhatsApp Gateway', 'Gestión de conexión, sesiones, código QR y mensajería')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Levantamos la interfaz en la ruta http://localhost:3000/docs
  SwaggerModule.setup('docs', app, document);
  await app.listen(process.env.PORT ?? 3000);
  console.log(`📖 Documentación Swagger disponible en: http://localhost:3000/docs`);
}
bootstrap();
