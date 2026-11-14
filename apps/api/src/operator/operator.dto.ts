import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, IsInt, Min, Max, IsDateString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha obrigatória' })
  password!: string;
}

export class MfaVerifyDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  tempToken?: string;
}

export class CreateBroadcastDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  streamPath?: string;
}

export class CreateInviteDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10)
  maxUses?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(24)
  expiresInHours?: number;
}

