import { Timestamp } from 'firebase/firestore';

export type ProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface UserSkillExpert {
  name: string;
  level: ProficiencyLevel;
}

export interface UserSkillInterested {
  name: string;
  targetLevel: ProficiencyLevel;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  title?: string;
  department?: string;
  bio?: string;
  aspirations?: string;
  skillsExpert: UserSkillExpert[];
  skillsInterested: UserSkillInterested[];
  verifiedSkills?: string[]; // IDs of skills verified via assessment
  managerId?: string; // For organizational hierarchy
  isMentor: boolean;
  points?: number;
  level?: number;
  badges?: string[];
  isAdmin?: boolean;
  createdAt: Timestamp;
}

export interface LearningResource {
  id: string;
  title: string;
  provider: 'LinkedIn Learning' | 'Coursera' | 'Pluralsight' | 'Internal';
  type: 'Course' | 'Article' | 'Video' | 'Path';
  url: string;
  skills: string[]; // Associated skill names
  duration?: string;
  description: string;
  rating?: number;
  createdAt: Timestamp;
}

export interface InternalGig {
  id: string;
  title: string;
  department: string;
  description: string;
  skillsRequired: string[];
  duration: string;
  status: 'open' | 'filled' | 'completed';
  postedBy: string;
  createdAt: Timestamp;
}

export interface SkillAssessment {
  id: string;
  userId: string;
  skillName: string;
  score: number;
  provider: string; // e.g., 'Skillsoft'
  passed: boolean;
  verifiedAt: Timestamp;
}

export interface GlobalSkill {
  id: string;
  name: string;
  category: string;
  description: string;
  createdAt: Timestamp;
}

export interface MentorshipPost {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  type: 'request' | 'offer';
  skill: string;
  description: string;
  status: 'active' | 'closed';
  createdAt: Timestamp;
}

export interface Milestone {
  title: string;
  completed: boolean;
  completedAt?: Timestamp;
}

export interface Pairing {
  id: string;
  mentorId: string;
  menteeId: string;
  mentorName: string;
  menteeName: string;
  skill: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  progress: number;
  milestones?: Milestone[];
  startDate: Timestamp;
  lastMeetingDate?: Timestamp;
  notes?: string;
}

export interface SessionFeedback {
  id?: string;
  pairingId: string;
  menteeId: string;
  mentorId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: Timestamp;
}

export interface Endorsement {
  id?: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto?: string;
  toUserId: string;
  skillName: string;
  createdAt: Timestamp;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
