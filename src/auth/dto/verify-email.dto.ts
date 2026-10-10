import { Matches } from 'class-validator';

export class VerifyEmailDto {
  /** The 6-digit code from the confirmation email */
  @Matches(/^\d{6}$/, { message: 'The code is 6 digits' })
  code: string;
}
