import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/** Lets a signed-in user whose email is not confirmed yet reach this route */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
