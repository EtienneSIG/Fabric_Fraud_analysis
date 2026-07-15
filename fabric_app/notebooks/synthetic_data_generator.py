"""Starter notebook logic for synthetic fraud data generation in Fabric."""

from dataclasses import dataclass
from typing import Any, Dict, List


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


def build_generation_plan(seed: int = 42) -> Dict[str, Any]:
    """Return deterministic generation settings for notebook orchestration.

    Returns a dictionary with:
    - seed (int): deterministic randomization seed.
    - domains (dict[str, int]): synthetic entity/transaction target sizes.
    - inject_patterns (list[str]): fraud pattern IDs to inject.
    - output_fields (list[str]): standardized fraud scoring output columns.
    - targets (dict[str, str]): historical and stream sink destinations.
    """
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
