"""Load the fabric-fraud-intelligence app dataset (uploaded as JSONL to
Files/appdata) into governed Delta tables in fraud_lakehouse.

These tables are the physical binding targets for the Fraud IQ ontology.
"""

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    BooleanType,
    DoubleType,
    StringType,
    StructField,
    StructType,
)

spark = SparkSession.builder.getOrCreate()

WS = "d451f521-7e87-408f-8208-61928f1b84e3"
LH = "67f6d900-b355-4727-b49b-4e05096cf8e7"
FILES = f"abfss://{WS}@onelake.dfs.fabric.microsoft.com/{LH}/Files/appdata"
TABLES = f"abfss://{WS}@onelake.dfs.fabric.microsoft.com/{LH}/Tables"

S = StringType
D = DoubleType
B = BooleanType


def sch(*fields):
    return StructType([StructField(n, t(), True) for n, t in fields])


SCHEMAS = {
    "customer": sch(
        ("id", S), ("name", S), ("segment", S), ("country", S),
        ("kycRiskRating", S), ("pepFlag", B), ("sanctionsFlag", B),
    ),
    "account": sch(
        ("id", S), ("customerId", S), ("ibanHash", S),
        ("accountOpenDate", S), ("status", S),
    ),
    "transaction": sch(
        ("id", S), ("accountId", S), ("timestamp", S), ("amount", D),
        ("currency", S), ("merchant", S), ("merchantCategory", S),
        ("channel", S), ("country", S), ("deviceId", S),
        ("ipCountry", S), ("counterpartyId", S),
    ),
    "policy": sch(
        ("id", S), ("customerId", S), ("policyType", S),
        ("startDate", S), ("premium", D), ("status", S),
    ),
    "claim": sch(
        ("id", S), ("policyId", S), ("customerId", S), ("claimType", S),
        ("claimDate", S), ("amountClaimed", D), ("repairProvider", S),
        ("status", S), ("location", S),
    ),
    "fraud_alert": sch(
        ("id", S), ("alertType", S), ("source", S), ("riskScore", D),
        ("severity", S), ("status", S), ("createdAt", S), ("customerId", S),
        ("transactionId", S), ("claimId", S), ("explanationShort", S),
    ),
    "fraud_case": sch(
        ("id", S), ("alertId", S), ("assignedTo", S), ("status", S),
        ("decision", S), ("decisionReason", S), ("createdAt", S), ("updatedAt", S),
    ),
    "evidence": sch(
        ("id", S), ("caseId", S), ("evidenceType", S), ("title", S),
        ("content", S), ("sourceSystem", S), ("confidence", D), ("createdAt", S),
    ),
    "entity_relationship": sch(
        ("id", S), ("sourceEntityId", S), ("targetEntityId", S),
        ("relationshipType", S), ("weight", D),
    ),
    "agent_run": sch(
        ("id", S), ("caseId", S), ("agentName", S), ("prompt", S),
        ("response", S), ("groundingSources", S), ("createdAt", S), ("userId", S),
    ),
    "customer_event": sch(
        ("id", S), ("customerId", S), ("event", S), ("occurredAt", S),
        ("location", S), ("channel", S), ("amount", D), ("description", S),
    ),
}

# ISO-8601 string columns to promote to real timestamps
TS_COLS = {
    "account": ["accountOpenDate"],
    "transaction": ["timestamp"],
    "policy": ["startDate"],
    "claim": ["claimDate"],
    "fraud_alert": ["createdAt"],
    "fraud_case": ["createdAt", "updatedAt"],
    "evidence": ["createdAt"],
    "agent_run": ["createdAt"],
    "customer_event": ["occurredAt"],
}

for name, schema in SCHEMAS.items():
    df = spark.read.schema(schema).json(f"{FILES}/{name}.jsonl")
    for c in TS_COLS.get(name, []):
        df = df.withColumn(c, F.to_timestamp(c))
    (df.write.mode("overwrite").format("delta")
       .option("overwriteSchema", "true").save(f"{TABLES}/{name}"))
    print(f"wrote {name}: {df.count():,} rows")

print("All app tables materialized in fraud_lakehouse.")
