import { entity, authenticated, uuid, text, boolean } from '@microsoft/rayfin-core';

/** Customer — the party under investigation (banking or insurance). */
@entity()
@authenticated('*')
export class Customer {
  @uuid() id!: string;
  @text({ max: 120 }) name!: string;
  @text({ max: 30 }) segment!: string;
  @text({ max: 4 }) country!: string;
  @text({ max: 20 }) kycRiskRating!: string;
  @boolean() pepFlag!: boolean;
  @boolean() sanctionsFlag!: boolean;
}
