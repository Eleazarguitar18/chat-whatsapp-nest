import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, Length, Matches } from 'class-validator';

export class EnviarDocumentoDto {
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
    @IsString({ message: 'El teléfono debe ser texto.' })
    @Length(8, 15, { message: 'El teléfono debe tener entre 8 y 15 dígitos.' })
    @Matches(/^[0-9]+$/, { message: 'El teléfono solo debe contener números.' })
    phone: string;

    @IsOptional()
    @IsString({ message: 'El título o nombre personalizado del archivo debe ser texto.' })
    fileName?: string;
}