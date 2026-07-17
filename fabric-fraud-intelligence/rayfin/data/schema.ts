import { Customer } from './Customer.js';
import { Account } from './Account.js';
import { Transaction } from './Transaction.js';
import { FraudAlert } from './FraudAlert.js';
import { FraudCase } from './FraudCase.js';
import { Claim } from './Claim.js';
import { Policy } from './Policy.js';
import { Evidence } from './Evidence.js';
import { EntityRelationship } from './EntityRelationship.js';
import { AgentRun } from './AgentRun.js';
import { CustomerEvent } from './CustomerEvent.js';

export type FraudIntelSchema = {
  Customer: Customer;
  Account: Account;
  Transaction: Transaction;
  FraudAlert: FraudAlert;
  FraudCase: FraudCase;
  Claim: Claim;
  Policy: Policy;
  Evidence: Evidence;
  EntityRelationship: EntityRelationship;
  AgentRun: AgentRun;
  CustomerEvent: CustomerEvent;
};

export const schema = [
  Customer,
  Account,
  Transaction,
  FraudAlert,
  FraudCase,
  Claim,
  Policy,
  Evidence,
  EntityRelationship,
  AgentRun,
  CustomerEvent,
];
