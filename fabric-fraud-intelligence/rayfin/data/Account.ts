import { entity, authenticated, uuid, text, date } from '@microsoft/rayfin-core';

/** Account — a banking account owned by a Customer. */
@entity()
@authenticated('*')
export class Account {
  @uuid() id!: string;
  @text({ max: 40 }) customerId!: string;
  @text({ max: 80 }) ibanHash!: string;
  @date() accountOpenDate!: Date;
  @text({ max: 20 }) status!: string;
}
