import { entity, authenticated, uuid, text, decimal, date } from '@microsoft/rayfin-core';

/** Transaction — a monetary movement scored for fraud / AML. */
@entity()
@authenticated('*')
export class Transaction {
  @uuid() id!: string;
  @text({ max: 40 }) accountId!: string;
  @date() timestamp!: Date;
  @decimal() amount!: number;
  @text({ max: 8 }) currency!: string;
  @text({ max: 120 }) merchant!: string;
  @text({ max: 40 }) merchantCategory!: string;
  @text({ max: 20 }) channel!: string;
  @text({ max: 4 }) country!: string;
  @text({ max: 60 }) deviceId!: string;
  @text({ max: 4 }) ipCountry!: string;
  @text({ max: 60 }) counterpartyId!: string;
}
