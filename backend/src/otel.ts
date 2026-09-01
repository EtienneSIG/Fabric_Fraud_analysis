// Distributed tracing + metrics into Application Insights. No-op unless the connection string
// is present, so local runs and the mock-first contract are unaffected. Imported first.
import { useAzureMonitor } from '@azure/monitor-opentelemetry';

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  useAzureMonitor();
}
