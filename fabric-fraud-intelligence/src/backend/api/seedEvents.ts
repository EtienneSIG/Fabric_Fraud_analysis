import { DATASET } from '@/data/seed';
import { getRayfinClient, isLocalBackend } from '@/services/rayfinClient';

/**
 * Seed a representative sample of Customer 360 events into the Fabric SQL
 * Database (the CustomerEvent ontology entity). The full ~60k event log is
 * generated in-memory; here we persist a sample so it is queryable in Fabric.
 */
export async function seedCustomerEvents(
  sample = 300,
  onProgress?: (msg: string) => void
): Promise<{ created: number }> {
  if (isLocalBackend()) {
    throw new Error('Deploy to Fabric (rayfin up) to seed the SQL database.');
  }
  const client = getRayfinClient();
  const rows = DATASET.events.slice(0, sample);
  let created = 0;
  for (const e of rows) {
    await client.data.CustomerEvent.create({
      customerId: e.customerId,
      event: e.event,
      occurredAt: new Date(e.occurredAt),
      location: e.location,
      channel: e.channel,
      amount: e.amount ?? undefined,
      description: e.description,
    });
    created += 1;
    if (created % 25 === 0) onProgress?.(`Seeded ${created}/${rows.length} events…`);
  }
  onProgress?.(`Seeded ${created} events into CustomerEvent.`);
  return { created };
}
