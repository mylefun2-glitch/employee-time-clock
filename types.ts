export enum CheckType {
  IN = 'IN',
  OUT = 'OUT'
}

export interface LogEntry {
  timestamp: Date;
  type: CheckType;
  pin: string;
}

export type KeypadValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'BACKSPACE' | 'CLEAR';