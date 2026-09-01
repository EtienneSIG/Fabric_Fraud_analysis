import argparse
import json
from pathlib import Path

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import (
    FabricIQPreviewTool,
    PromptAgentDefinition,
    WebSearchApproximateLocation,
    WebSearchTool,
)
from azure.identity import AzureCliCredential


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy the Fraud IQ Foundry agent.")
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--fabric-connection-id", required=True)
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("config.json"))
    parser.add_argument("--replace", action="store_true")
    return parser.parse_args()


def build_instructions(domains: list[str]) -> str:
    domain_list = ", ".join(domains)
    return f"""You are Fraud IQ, an advisory fraud and AML investigation agent.

For every case-specific request:
1. Use Fabric IQ to retrieve governed facts from the published Fraud Intelligence Data Agent. Never invent a fact that is absent from Fabric.
2. Use web search to retrieve current regulatory obligations. Accept and cite sources only from these official domains: {domain_list}.
3. Reconcile internal evidence and regulatory requirements. Clearly separate facts, interpretation, applicable obligations, and recommended actions.
4. Include record identifiers returned by Fabric and preserve the URL citations returned by web search.
5. If either tool lacks evidence, state the gap. Never substitute a non-official source.
6. Do not make a final fraud, filing, blocking, or customer decision. Require human review and approval.

Answer in the user's language. Do not send personal data, account numbers, transaction details, or other case evidence in a web-search query. Search only for generic legal concepts, rules, guidance, dates, and thresholds."""


def main() -> None:
    args = parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    credential = AzureCliCredential()
    project = AIProjectClient(endpoint=args.endpoint, credential=credential, allow_preview=True)

    if args.replace:
        existing_names = {agent.name for agent in project.agents.list(limit=100)}
        if config["agentName"] in existing_names:
            project.agents.delete(config["agentName"])

    definition = PromptAgentDefinition(
        model=config["modelDeploymentName"],
        instructions=build_instructions(config["regulatoryDomains"]),
        tools=[
            FabricIQPreviewTool(
                project_connection_id=args.fabric_connection_id,
                require_approval="never",
            ),
            WebSearchTool(
                user_location=WebSearchApproximateLocation(
                    country="FR",
                    city="Paris",
                    region="Ile-de-France",
                )
            ),
        ],
    )
    agent = project.agents.create_version(
        agent_name=config["agentName"],
        definition=definition,
        description="Grounded fraud investigation across Fabric evidence and official regulatory websites.",
        metadata={"solution": "fabric-fraud-intelligence", "managedBy": "foundry/deploy_foundry.ps1"},
    )
    print(f"AGENT_NAME={agent.name}")
    print(f"AGENT_VERSION={agent.version}")
    print(f"AGENT_ID={agent.id}")


if __name__ == "__main__":
    main()