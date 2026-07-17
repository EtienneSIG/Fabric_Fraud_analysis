"""Generate a Fabric IQ Ontology item definition for the fraud domain.

Builds entity types, properties, NonTimeSeries lakehouse data bindings, and
relationship types (with contextualizations that derive the instance graph from
foreign-key columns) bound to the app tables in fraud_lakehouse.

Outputs:
  artifacts/ontology/create_body.json   -> ready-to-POST create-item request
  artifacts/ontology/parts/...          -> decoded JSON parts for inspection
"""

import base64
import json
import os
import uuid

WS = "d451f521-7e87-408f-8208-61928f1b84e3"
LH = "67f6d900-b355-4727-b49b-4e05096cf8e7"
OUT = os.path.dirname(os.path.abspath(__file__))
PARTS_DIR = os.path.join(OUT, "parts")
os.makedirs(PARTS_DIR, exist_ok=True)

S, B, D, T = "String", "Boolean", "Double", "DateTime"

# entity name -> (table, displayNameProp, [(prop, valueType), ...]); key is always "id"
ENTITIES = {
    "Customer": ("customer", "name", [
        ("id", S), ("name", S), ("segment", S), ("country", S),
        ("kycRiskRating", S), ("pepFlag", B), ("sanctionsFlag", B)]),
    "Account": ("account", "id", [
        ("id", S), ("customerId", S), ("ibanHash", S),
        ("accountOpenDate", T), ("status", S)]),
    "Transaction": ("transaction", "id", [
        ("id", S), ("accountId", S), ("timestamp", T), ("amount", D),
        ("currency", S), ("merchant", S), ("merchantCategory", S),
        ("channel", S), ("country", S), ("deviceId", S),
        ("ipCountry", S), ("counterpartyId", S)]),
    "Policy": ("policy", "id", [
        ("id", S), ("customerId", S), ("policyType", S),
        ("startDate", T), ("premium", D), ("status", S)]),
    "Claim": ("claim", "id", [
        ("id", S), ("policyId", S), ("customerId", S), ("claimType", S),
        ("claimDate", T), ("amountClaimed", D), ("repairProvider", S),
        ("status", S), ("location", S)]),
    "FraudAlert": ("fraud_alert", "alertType", [
        ("id", S), ("alertType", S), ("source", S), ("riskScore", D),
        ("severity", S), ("status", S), ("createdAt", T), ("customerId", S),
        ("transactionId", S), ("claimId", S), ("explanationShort", S)]),
    "FraudCase": ("fraud_case", "id", [
        ("id", S), ("alertId", S), ("assignedTo", S), ("status", S),
        ("decision", S), ("decisionReason", S), ("createdAt", T), ("updatedAt", T)]),
    "Evidence": ("evidence", "title", [
        ("id", S), ("caseId", S), ("evidenceType", S), ("title", S),
        ("content", S), ("sourceSystem", S), ("confidence", D), ("createdAt", T)]),
    "EntityRelationship": ("entity_relationship", "relationshipType", [
        ("id", S), ("sourceEntityId", S), ("targetEntityId", S),
        ("relationshipType", S), ("weight", D)]),
    "AgentRun": ("agent_run", "agentName", [
        ("id", S), ("caseId", S), ("agentName", S), ("prompt", S),
        ("response", S), ("groundingSources", S), ("createdAt", T), ("userId", S)]),
    "CustomerEvent": ("customer_event", "event", [
        ("id", S), ("customerId", S), ("event", S), ("occurredAt", T),
        ("location", S), ("channel", S), ("amount", D), ("description", S)]),
}

# relationship: name, source entity, target entity, ctx table, srcCol, tgtCol
# srcCol identifies the SOURCE entity key in the table; tgtCol the TARGET entity key.
RELATIONSHIPS = [
    ("owns", "Customer", "Account", "account", "customerId", "id"),
    ("hasTransaction", "Account", "Transaction", "transaction", "accountId", "id"),
    ("holdsPolicy", "Customer", "Policy", "policy", "customerId", "id"),
    ("policyHasClaim", "Policy", "Claim", "claim", "policyId", "id"),
    ("filesClaim", "Customer", "Claim", "claim", "customerId", "id"),
    ("alertFlagsCustomer", "FraudAlert", "Customer", "fraud_alert", "id", "customerId"),
    ("alertOnTransaction", "FraudAlert", "Transaction", "fraud_alert", "id", "transactionId"),
    ("caseInvestigatesAlert", "FraudCase", "FraudAlert", "fraud_case", "id", "alertId"),
    ("evidenceSupportsCase", "Evidence", "FraudCase", "evidence", "id", "caseId"),
    ("agentAnalyzesCase", "AgentRun", "FraudCase", "agent_run", "id", "caseId"),
    ("customerGeneratesEvent", "Customer", "CustomerEvent", "customer_event", "customerId", "id"),
]

# ---------------------------------------------------------------------------
_next = 1000000001


def new_id() -> str:
    global _next
    v = _next
    _next += 1
    return str(v)


parts = []


def add_part(path: str, obj: dict):
    raw = json.dumps(obj, indent=2)
    parts.append({
        "path": path,
        "payload": base64.b64encode(raw.encode("utf-8")).decode("ascii"),
        "payloadType": "InlineBase64",
    })
    disk = os.path.join(PARTS_DIR, path)
    os.makedirs(os.path.dirname(disk), exist_ok=True)
    with open(disk, "w", encoding="utf-8") as f:
        f.write(raw)


# Required root parts
add_part(".platform", {"metadata": {"type": "Ontology", "displayName": "fraud_ontology"}})
add_part("definition.json", {})

# Build entity types + data bindings
et_id = {}      # entity name -> entity type id
key_pid = {}    # entity name -> id-property id
for name, (table, disp, props) in ENTITIES.items():
    etid = new_id()
    et_id[name] = etid
    pid = {}
    prop_defs = []
    for pname, vtype in props:
        p = new_id()
        pid[pname] = p
        prop_defs.append({
            "id": p, "name": pname, "redefines": None,
            "baseTypeNamespaceType": None, "valueType": vtype,
        })
    key_pid[name] = pid["id"]
    add_part(f"EntityTypes/{etid}/definition.json", {
        "id": etid,
        "namespace": "usertypes",
        "baseEntityTypeId": None,
        "name": name,
        "entityIdParts": [pid["id"]],
        "displayNamePropertyId": pid[disp],
        "namespaceType": "Custom",
        "visibility": "Visible",
        "properties": prop_defs,
    })
    db_id = str(uuid.uuid4())
    add_part(f"EntityTypes/{etid}/DataBindings/{db_id}.json", {
        "id": db_id,
        "dataBindingConfiguration": {
            "dataBindingType": "NonTimeSeries",
            "propertyBindings": [
                {"sourceColumnName": pname, "targetPropertyId": pid[pname]}
                for pname, _ in props
            ],
            "sourceTableProperties": {
                "sourceType": "LakehouseTable",
                "workspaceId": WS,
                "itemId": LH,
                "sourceTableName": table,
            },
        },
    })

# Build relationship types + contextualizations
for rname, src, tgt, table, src_col, tgt_col in RELATIONSHIPS:
    rid = new_id()
    add_part(f"RelationshipTypes/{rid}/definition.json", {
        "namespace": "usertypes",
        "id": rid,
        "name": rname,
        "namespaceType": "Custom",
        "source": {"entityTypeId": et_id[src]},
        "target": {"entityTypeId": et_id[tgt]},
    })
    ctx_id = str(uuid.uuid4())
    add_part(f"RelationshipTypes/{rid}/Contextualizations/{ctx_id}.json", {
        "id": ctx_id,
        "dataBindingTable": {
            "workspaceId": WS,
            "itemId": LH,
            "sourceTableName": table,
            "sourceType": "LakehouseTable",
        },
        "sourceKeyRefBindings": [
            {"sourceColumnName": src_col, "targetPropertyId": key_pid[src]}
        ],
        "targetKeyRefBindings": [
            {"sourceColumnName": tgt_col, "targetPropertyId": key_pid[tgt]}
        ],
    })

body = {
    "displayName": "fraud_ontology",
    "type": "Ontology",
    "description": "Fraud domain ontology bound to fraud_lakehouse app tables.",
    "definition": {"parts": parts},
}
with open(os.path.join(OUT, "create_body.json"), "w", encoding="utf-8") as f:
    json.dump(body, f, indent=2)

print(f"entities={len(ENTITIES)} relationships={len(RELATIONSHIPS)} parts={len(parts)}")
print(f"wrote {os.path.join(OUT, 'create_body.json')}")
