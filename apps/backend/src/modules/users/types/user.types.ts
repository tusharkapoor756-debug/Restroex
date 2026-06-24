import { UserRole } from '../../auth/types/auth.types';

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

