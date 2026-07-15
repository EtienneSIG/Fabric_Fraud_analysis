"""Starter notebook logic for synthetic fraud data generation in Fabric."""

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class DomainSize:
    customers: int = 5000
    accounts: int = 7000
    devices: int = 3500
    ips: int = 2500
    merchants: int = 1200
    daily_transactions: int = 120000


OUTPUT_FIELDS: List[str] = [
    "fraud_flag",
    "risk_score",
    "population_risk_score",
    "cluster_id",
    "risk_drivers",
    "explainability_vector",
]


def build_generation_plan(seed: int = 42) -> Dict[str, object]:
    """Return deterministic generation settings for notebook orchestration."""
    return {
        "seed": seed,
        "domains": DomainSize().__dict__,
        "inject_patterns": [
            "shared_device_ring",
            "shared_ip_burst",
            "velocity_anomaly",
            "mule_chain",
            "merchant_collusion",
            "account_takeover",
        ],
        "output_fields": OUTPUT_FIELDS,
        "targets": {
            "historical_sink": "OneLake/Lakehouse",
            "stream_sink": "Eventstreams -> Eventhouse",
        },
    }


if __name__ == "__main__":
    print(build_generation_plan())
