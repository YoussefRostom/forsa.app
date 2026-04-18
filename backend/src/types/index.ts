export enum UserRole {
  PLAYER = 'player',
  AGENT = 'agent',
  ACADEMY = 'academy',
  PARENT = 'parent',
  CLINIC = 'clinic',
  ADMIN = 'admin',
}

export enum AccountStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export enum BookingStatus {
  REQUESTED = 'requested',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum BookingType {
  ACADEMY = 'academy',
  CLINIC = 'clinic',
}

export enum AcademyProgramType {
  GROUP_TRAINING = 'group_training',
  PRIVATE_TRAINING = 'private_training',
  SPECIALIZED_PROGRAM = 'specialized_program',
}

export interface User {
  id: string;
  email?: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  profilePhoto?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  userId: string;
  role: UserRole;
  // Player fields
  playerName?: string;
  age?: number;
  position?: string;
  // Agent fields
  agentName?: string;
  companyName?: string;
  // Academy fields
  academyName?: string;
  city?: string;
  address?: string;
  description?: string;
  fees?: { [age: string]: number };
  // Parent fields
  parentName?: string;
  childrenCount?: number;
  // Clinic fields
  clinicName?: string;
  workingHours?: any;
}

export interface Booking {
  id: string;
  userId: string; // Who made booking
  providerId: string; // Academy/Clinic
  bookingType: BookingType;
  serviceId?: string;
  programId?: string;
  date: string; // ISO date string
  time?: string;
  status: BookingStatus;
  price: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademyProgram {
  id: string;
  academyId: string;
  name: string;
  type: AcademyProgramType;
  fee: number;
  description?: string;
  isActive: boolean;

  // Private Training specific fields
  coachName?: string;
  coachBio?: string;
  coachPhotoUrl?: string;
  specializations?: string[];
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  maxParticipants: number;
  duration: number; // Duration in minutes
  availability?: any; // JSON object with schedule

  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  userId: string;
  email?: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

