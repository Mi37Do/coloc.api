import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Username can contain letters, numbers, dots, underscores and hyphens only',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstname: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastname: string;

  @IsOptional()
  @IsPhoneNumber() // international format, e.g. +33612345678
  phone?: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsNumber()
  @IsNotEmpty()
  countryId: number;

  @IsDateString()
  birthDate: Date;
}
