import { ApiProperty } from '@nestjs/swagger';

// Molde de validación y documentación para Swagger
export class EnviarMensajeDto {
  @ApiProperty({ 
    example: '59171234567', 
    description: 'Número de teléfono con código de país, sin espacios ni caracteres especiales.' 
  })
  phone: string;

  @ApiProperty({ 
    example: '¡Hola! Alerta de sistema desde NestJS 🚀', 
    description: 'Cuerpo del mensaje de texto que se enviará.' 
  })
  message: string;
}