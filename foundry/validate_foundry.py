import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

from azure.ai.projects import AIProjectClient
from azure.identity import AzureCliCredential


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the Fraud IQ Foundry agent.")
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("config.json"))
    return parser.parse_args()


def citation_urls(response: object) -> list[str]:
    urls: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            for annotation in getattr(content, "annotations", []) or []:
                if getattr(annotation, "type", None) == "url_citation":
                    url = getattr(annotation, "url", None)
                    if url:
                        urls.append(url)
    return urls


def is_allowed(url: str, domains: list[str]) -> bool:
    hostname = (urlparse(url).hostname or "").lower()
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in domains)


def main() -> None:
    args = parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    project = AIProjectClient(
        endpoint=args.endpoint,
        credential=AzureCliCredential(),
        allow_preview=True,
    )
    openai = project.get_openai_client(agent_name=config["agentName"])
    for locale, question in config["validationQuestions"].items():
        response = None
        for _ in range(2):
            response = openai.responses.create(
                input=f"[OUTPUT_LOCALE={locale}]\n{question}",
                max_output_tokens=1200,
            )
            if response.output_text.strip():
                break

        if response is None or not response.output_text.strip():
            raise RuntimeError(f"The Foundry agent returned an empty {locale} response.")
        word_count = len(response.output_text.split())
        if word_count > 120:
            raise RuntimeError(
                f"The Foundry agent returned {word_count} {locale} words; expected at most 120."
            )

        urls = citation_urls(response)
        if not urls:
            raise RuntimeError(f"No regulatory URL citation was returned for {locale}.")

        unexpected = [url for url in urls if not is_allowed(url, config["regulatoryDomains"])]
        if unexpected:
            raise RuntimeError(f"Non-official {locale} citation(s) returned: {unexpected}")

        print(f"LOCALE={locale}")
        print(f"WORD_COUNT={word_count}")
        print(f"CITATION_COUNT={len(urls)}")
        for url in urls:
            print(f"CITATION={url}")
    print("VALIDATION=PASS")


if __name__ == "__main__":
    main()