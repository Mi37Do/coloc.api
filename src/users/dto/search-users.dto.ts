import { IsString, Length } from 'class-validator';

export class SearchUsersDto {
  /** Exact email, or username prefix */
  @IsString()
  @Length(2, 254)
  q: string;
}
