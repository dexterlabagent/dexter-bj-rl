"""
Entry point: python -m dexter_rl

Usage:
  python -m dexter_rl --mock             # Built-in engine, no server needed
  python -m dexter_rl --api-url URL      # Connect to real game server
  python -m dexter_rl --tables 8         # 8 concurrent tables
  python -m dexter_rl --mock -v          # Verbose / debug logging
"""

import argparse
import asyncio

from .config import DexterConfig
from .orchestrator import Orchestrator
from .api.client import HttpGameClient
from .api.mock import MockGameClient
from .logging_setup import setup_logging


def main() -> None:
    parser = argparse.ArgumentParser(description="Dexter RL Blackjack Agent")
    parser.add_argument("--mock", action="store_true", help="Use built-in game engine")
    parser.add_argument("--api-url", default="http://localhost:8080", help="Game server URL")
    parser.add_argument("--tables", type=int, default=4, help="Number of concurrent tables")
    parser.add_argument("--data-dir", default="data", help="Persistence directory")
    parser.add_argument("--balance", type=int, default=1000, help="Starting balance")
    parser.add_argument("--verbose", "-v", action="store_true", help="Debug logging")
    args = parser.parse_args()

    setup_logging(verbose=args.verbose)

    config = DexterConfig(
        api_base_url=args.api_url,
        num_tables=args.tables,
        data_dir=args.data_dir,
        initial_balance=args.balance,
    )

    if args.mock:
        client = MockGameClient(config)
    else:
        client = HttpGameClient(config)

    orchestrator = Orchestrator(client, config)
    asyncio.run(orchestrator.run())


if __name__ == "__main__":
    main()
