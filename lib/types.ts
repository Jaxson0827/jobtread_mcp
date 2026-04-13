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

export interface Contact {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  title: string | null;
  locations?: { nodes: Partial<Location>[] };
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

export interface CostItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number | null;
  unitCost: number | null;
  unitPrice: number | null;
  cost: number;
  price: number;
  costCode?: Partial<CostCode>;
  costType?: Partial<CostType>;
}

export interface User {
  id: string;
  name: string;
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
