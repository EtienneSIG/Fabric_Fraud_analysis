import { entity, authenticated, uuid, text, decimal, date } from '@microsoft/rayfin-core';

/** Policy — an insurance policy owned by a Customer. */
@entity()
@authenticated('*')
export class Policy {
  @uuid() id!: string;
  @text({ max: 40 }) customerId!: string;
  @text({ max: 40 }) policyType!: string;
  @date() startDate!: Date;
  @decimal() premium!: number;
  @text({ max: 20 }) status!: string;
}
