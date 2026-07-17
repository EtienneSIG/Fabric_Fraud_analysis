-- Curated historical storage and case write-back tables.
CREATE TABLE IF NOT EXISTS curated_transactions AS
SELECT * FROM bronze_transactions;

CREATE TABLE IF NOT EXISTS curated_entities AS
SELECT * FROM bronze_entities;

CREATE TABLE IF NOT EXISTS fraud_cases (
  case_id STRING,
  alert_id STRING,
  cluster_id STRING,
  owner STRING,
  status STRING,
  decision STRING,
  decision_timestamp TIMESTAMP,
  remediation_action STRING,
  analyst_feedback STRING,
  model_version STRING
);
