import { ApiProperty } from '@nestjs/swagger';
// Importamos los validadores estructurales
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class EnviarMensajeDto {
  @ApiProperty({
    example: '591',
    description: 'Código de país, solo dígitos numéricos.'
  })
  @IsNotEmpty({ message: 'El código de pais es obligatorio.' })
  @IsString({ message: 'El código debe ser texto.' })
  @Length(2, 3, { message: 'El código de pais debe tener entre 2 y 3 dígitos.' })
  @Matches(/^[0-9]+$/, { message: 'El código de pais solo debe contener números.' })
  code: string;
  @ApiProperty({
    example: '75818731',
    description: 'Número de teléfono con código de país, solo dígitos numéricos.'
  })
  @IsNotEmpty({ message: 'El número de teléfono es obligatorio.' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @Length(8, 15, { message: 'El teléfono debe tener entre 8 y 15 dígitos.' })
  @Matches(/^[0-9]+$/, { message: 'El teléfono solo debe contener números (sin símbolos +, ni espacios).' })
  phone: string;

  @ApiProperty({
    example: '¡Hola! Mensaje validado correctamente.',
    description: 'Contenido del mensaje de texto.'
  })
  @IsNotEmpty({ message: 'El contenido del mensaje no puede estar vacío.' })
  @IsString({ message: 'El mensaje debe ser una cadena de texto.' })
  message: string;
}