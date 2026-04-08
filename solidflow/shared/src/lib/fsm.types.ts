export interface FsmForLoop {
  type: 'for';
  init: string;
  condition: string;
  increment: string;
  body: FsmStatement[];
}

export interface FsmIfStatement {
  type: 'if';
  condition: string;
  body: FsmStatement[];
  elseIfs: { condition: string; body: FsmStatement[] }[];
  elseBranch?: FsmStatement[];
}

export type FsmStatement = string | FsmForLoop | FsmIfStatement;

export interface FsmTransition {
  id: string;
  name: string;
  from: string;
  to: string;
  guard?: string;
  guardConfig?: FsmGuardConfig;
  statementsMode?: 'guided' | 'code';
  statements?: FsmStatement[];
  rawStatements?: string;
  emitEvent?: boolean;
}

export interface FsmContractVariable {
  name: string;
  type: string;
  visibility?: 'public' | 'private' | 'internal';
  initialValue?: string;
}

export interface FsmCustomType {
  name: string;
  fields: { name: string; type: string }[];
}

export interface FsmPlugins {
  locking?: boolean;
  accessControl?: boolean;
  transitionCounter?: boolean;
  timedTransitions?: boolean;
  event?: boolean;
}

export interface FsmDefinition {
  id?: string;
  name: string;
  states: string[];
  initialState: string;
  transitions: FsmTransition[];
  variables?: FsmContractVariable[];
  customTypes?: FsmCustomType[];
  plugins?: FsmPlugins;
  createdAt?: string;
  updatedAt?: string;
}

// Guards

export type GuardOperator = 'AND' | 'OR';

// Entry guards
export interface AccessControlGuard { type: 'access-control'; role: string; }
export interface InputValidationGuard { type: 'input-validation'; expression: string; }
export interface StatePreconditionGuard { type: 'state-precondition'; state: string; }
export interface PauseGuard { type: 'pause'; }

// Exit guards
export interface PostconditionGuard { type: 'postcondition'; expression: string; }
export interface EventEmissionGuard { type: 'event-emission'; eventName: string; }
export interface ReturnValueGuard { type: 'return-value'; expression: string; }
export interface ReentrancyGuard { type: 'reentrancy'; }

// Temporal guards
export interface DeadlineGuard { type: 'deadline'; timestamp: string; }
export interface TimeLockGuard { type: 'timelock'; delay: string; }
export interface CooldownGuard { type: 'cooldown'; interval: string; }
export interface WindowGuard { type: 'window'; start: string; end: string; }

// Oracle guards
export interface SourceWhitelistGuard { type: 'source-whitelist'; address: string; }
export interface FreshnessGuard { type: 'freshness'; maxAge: string; }
export interface SanityBoundGuard { type: 'sanity-bound'; min: string; max: string; }

export type FsmGuard =
  | AccessControlGuard | InputValidationGuard | StatePreconditionGuard | PauseGuard
  | PostconditionGuard | EventEmissionGuard | ReturnValueGuard | ReentrancyGuard
  | DeadlineGuard | TimeLockGuard | CooldownGuard | WindowGuard
  | SourceWhitelistGuard | FreshnessGuard | SanityBoundGuard;

export interface FsmGuardConfig {
  guards: Array<{ guard: FsmGuard; operator: GuardOperator }>;
}