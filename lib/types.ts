export interface Location {
  id: string;
  name: string;
  address: string;
  formattedAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CustomFieldValue {
  id: string;
  value: string;
  customField: {
    id: string;
    name: string;
    type: string;
  };
}

export interface Contact {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  title: string | null;
  createdAt?: string;
  locations?: { nodes: Partial<Location>[] };
  /** Email, phone, and other org-defined fields stored as custom field values */
  customFieldValues?: { nodes: CustomFieldValue[] };
}

export interface Account {
  id: string;
  name: string;
  type: string;
  primaryContact?: Partial<Contact>;
  contacts?: { nodes: Partial<Contact>[] };
  jobs?: { nodes: Partial<Job>[] };
}

export interface CostCode {
  id: string;
  name: string;
}

export interface CostType {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
}

export interface CostItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number | null;
  unitCost: number | null;
  unitPrice: number | null;
  cost: number;
  price: number;
  createdAt?: string;
  costCode?: Partial<CostCode>;
  costType?: Partial<CostType>;
  unit?: Partial<Unit>;
}

export interface JobFile {
  id: string;
  name: string;
  url: string | null;
  type: string | null;
  size: number | null;
  description: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  name: string;
  description: string | null;
  /** 0.0–1.0 as stored by the API; multiply by 100 for display */
  progress: number | null;
  /** 1 = complete, 0 = incomplete (automatically set when progress reaches 1.0) */
  completed: number;
  startDate: string | null;
  /** This is the due date */
  endDate: string | null;
  createdAt: string;
  job?: { id: string; name: string };
}

export interface Comment {
  id: string;
  /** Optional subject/title set by the author */
  name: string | null;
  /** The comment body text */
  message: string;
  createdAt: string;
  /** The account associated with this comment (business name, not individual user) */
  account?: { id: string; name: string } | null;
  job?: { id: string; name: string } | null;
}

export interface TimeEntry {
  id: string;
  minutes: number;
  notes: string | null;
  startedAt: string;
  endedAt: string;
  createdAt: string;
  user?: { id: string; name: string };
}

export interface DailyLog {
  id: string;
  date: string;
  notes: string;
  createdAt: string;
  user?: { id: string; name: string };
}

export interface Document {
  id: string;
  name: string;
  type: string;
  status: string;
  number: number;
  balance: number;
  tax: number;
  taxRate: number;
  dueDate: string | null;
  description: string | null;
  createdAt: string;
  fromName: string;
  toName: string;
  fromAddress: string;
  toAddress: string;
  account?: Partial<Account>;
  job?: Partial<Job>;
}

export interface Job {
  id: string;
  name: string;
  number: string;
  status: string;
  description: string | null;
  createdAt: string;
  location?: Partial<Location>;
  documents?: { nodes: Partial<Document>[] };
  timeEntries?: { nodes: Partial<TimeEntry>[] };
  dailyLogs?: { nodes: Partial<DailyLog>[] };
  costItems?: { nodes: Partial<CostItem>[] };
}

export interface Organization {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
