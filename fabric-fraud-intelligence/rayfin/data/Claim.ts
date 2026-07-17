import { entity, authenticated, uuid, text, decimal, date } from '@microsoft/rayfin-core';

/** Claim — an insurance claim under fraud investigation. */
@entity()
@authenticated('*')
export class Claim {
  @uuid() id!: string;
  @text({ max: 40 }) policyId!: string;
  @text({ max: 40 }) customerId!: string;
  @text({ max: 40 }) claimType!: string;
  @date() claimDate!: Date;
  @decimal() amountClaimed!: number;
  @text({ max: 120 }) repairProvider!: string;
  @text({ max: 20 }) status!: string;
  @text({ max: 80 }) location!: string;
}
