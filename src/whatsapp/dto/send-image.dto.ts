import { IsNotEmpty, IsString, IsOptional, Length, Matches } from 'class-validator';

export class EnviarImagenDto {
    @IsNotEmpty({ message: 'El número de teléfono es obligatorio.' })
    @IsString({ message: 'El teléfono debe ser texto.' })
    @Length(8, 15, { message: 'El teléfono debe tener entre 8 y 15 dígitos.' })
    @Matches(/^[0-9]+$/, { message: 'El teléfono solo debe contener números.' })
    phone: string;

    @IsOptional()
    @IsString({ message: 'El pie de foto debe ser texto.' })
    caption?: string;
}