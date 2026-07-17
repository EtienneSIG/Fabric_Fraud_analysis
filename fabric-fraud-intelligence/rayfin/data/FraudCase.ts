import { entity, authenticated, uuid, text, date } from '@microsoft/rayfin-core';

/** FraudCase — the investigation lifecycle wrapper around an alert. */
@entity()
@authenticated('*')
export class FraudCase {
  @uuid() id!: string;
  @text({ max: 40 }) alertId!: string;
  @text({ max: 80 }) assignedTo!: string;
  @text({ max: 30 }) status!: string;
  @text({ max: 30 }) decision!: string;
  @text({ max: 300 }) decisionReason!: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
