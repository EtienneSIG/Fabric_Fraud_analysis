import argparse
import json
from pathlib import Path

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import (
    MCPTool,
    PromptAgentDefinition,
    WebSearchApproximateLocation,
    WebSearchTool,
)
from azure.identity import AzureCliCredential


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy the Fraud IQ Foundry agent.")
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("config.json"))
    parser.add_argument("--replace", action="store_true")
    parser.add_argument(
        "--webiq-connection-id",
        default=None,
        help="Full Foundry connection id for conn-web-iq. Omit to keep the agent on web search only.",
    )
    parser.add_argument(
        "--webiq-mcp-url",
        default=None,
        help="Web IQ MCP server URL. Defaults to config.json's webIqMcpUrl.",
    )
    return parser.parse_args()


def build_instructions(domains: list[str], webiq_enabled: bool) -> str:
    domain_list = ", ".join(domains)
    search_tool = "the webiq tool (Microsoft Web IQ)" if webiq_enabled else "web search"
    return f"""You are Fraud IQ, an advisory fraud and AML regulatory agent.

For every case-specific request:
1. Use {search_tool} to retrieve current regulatory obligations. Accept and cite sources only from these official domains: {domain_list}.
2. Treat case facts supplied by the user as unverified context. Do not claim access to Fabric or other internal data.
3. Clearly separate user-provided facts, interpretation, applicable obligations, and recommended actions.
4. Preserve the URL citations returned by {search_tool}.
5. If evidence is missing, state the gap. Never invent internal facts or substitute a non-official source.
6. Do not make a final fraud, filing, blocking, or customer decision. Require human review and approval.

Answer in the user's language. Do not send personal data, account numbers, transaction details, or other case evidence in a search query. Search only for generic legal concepts, rules, guidance, dates, and thresholds."""


def main() -> None:
    args = parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    credential = AzureCliCredential()
    project = AIProjectClient(endpoint=args.endpoint, credential=credential, allow_preview=True)

    if args.replace:
        existing_names = {agent.name for agent in project.agents.list(limit=100)}
        if config["agentName"] in existing_names:
            project.agents.delete(config["agentName"])

    tools = [
        WebSearchTool(
            user_location=WebSearchApproximateLocation(
                country="FR",
                city="Paris",
                region="Ile-de-France",
            )
        ),
    ]
    webiq_enabled = bool(args.webiq_connection_id)
    if webiq_enabled:
        tools.append(
            MCPTool(
                server_label="webiq",
                server_url=args.webiq_mcp_url or config.get("webIqMcpUrl"),
                project_connection_id=args.webiq_connection_id,
                require_approval="never",
                server_description="Microsoft Web IQ regulatory grounding, restricted to official domains.",
            )
        )

    definition = PromptAgentDefinition(
        model=config["modelDeploymentName"],
        instructions=build_instructions(config["regulatoryDomains"], webiq_enabled),
        tools=tools,
    )
    agent = project.agents.create_version(
        agent_name=config["agentName"],
        definition=definition,
        description="Grounded fraud investigation across Fabric evidence and official regulatory websites.",
        metadata={
            "solution": "fabric-fraud-intelligence",
            "managedBy": "foundry/deploy_foundry.ps1",
            "webIqEnabled": str(webiq_enabled).lower(),
        },
    )
    print(f"AGENT_NAME={agent.name}")
    print(f"AGENT_VERSION={agent.version}")
    print(f"AGENT_ID={agent.id}")


if __name__ == "__main__":
    main()