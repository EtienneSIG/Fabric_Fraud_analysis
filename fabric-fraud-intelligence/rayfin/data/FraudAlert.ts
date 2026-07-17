import { entity, authenticated, uuid, text, decimal, date } from '@microsoft/rayfin-core';

/** FraudAlert — a risk signal raised by a rule, model or data agent. */
@entity()
@authenticated('*')
export class FraudAlert {
  @uuid() id!: string;
  @text({ max: 40 }) alertType!: string;
  @text({ max: 40 }) source!: string;
  @decimal() riskScore!: number;
  @text({ max: 20 }) severity!: string;
  @text({ max: 20 }) status!: string;
  @date() createdAt!: Date;
  @text({ max: 40 }) customerId!: string;
  @text({ max: 40 }) transactionId!: string;
  @text({ max: 40 }) claimId!: string;
  @text({ max: 300 }) explanationShort!: string;
}
