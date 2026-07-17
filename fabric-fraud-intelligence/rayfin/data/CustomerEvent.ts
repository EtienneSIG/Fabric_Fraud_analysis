import { entity, authenticated, uuid, text, decimal, date } from '@microsoft/rayfin-core';

/** CustomerEvent — a Customer 360 event-log entry. "Fraud detected" is one
 *  event type among the customer journey (login, card, transfer, …). */
@entity()
@authenticated('*')
export class CustomerEvent {
  @uuid() id!: string;
  @text({ max: 40 }) customerId!: string;
  @text({ max: 60 }) event!: string;
  @date() occurredAt!: Date;
  @text({ max: 80 }) location!: string;
  @text({ max: 30 }) channel!: string;
  @decimal({ optional: true }) amount?: number;
  @text({ max: 200 }) description!: string;
}
