"""
Entry point: python -m dexter_rl

Usage:
  python -m dexter_rl --mock             # Built-in engine, no server needed
  python -m dexter_rl --api-url URL      # Connect to real game server
  python -m dexter_rl --tables 8         # 8 concurrent tables
  python -m dexter_rl --mock -v          # Verbose / debug logging
  python -m dexter_rl --mock --fast      # Zero delays, rapid training
  python -m dexter_rl --stats            # Print Q-table strategy grid and exit
"""

import argparse
import asyncio

from .config import DexterConfig
from .orchestrator import Orchestrator
from .api.client import HttpGameClient
from .api.mock import MockGameClient
from .logging_setup import setup_logging


def _print_qtable(brain_state) -> None:
    dealer_ups = list(range(2, 11)) + [11]  # 2-10 + Ace (11)
    player_totals = list(range(8, 22))

    decided = brain_state.wins + brain_state.losses
    win_rate = f"{brain_state.wins / decided * 100:.1f}%" if decided > 0 else "N/A"
    print(f"\nDEXTER Q-TABLE  |  hands={brain_state.total_hands}  "
          f"win%={win_rate}  "
          f"eps={brain_state.exploration_rate:.3f}  "
          f"alpha={brain_state.learning_rate:.3f}")

    header = "      " + "".join(f" {str(d):>3}" for d in ["2","3","4","5","6","7","8","9","10","A"])

    for label, is_soft in [("HARD", False), ("SOFT", True)]:
        print(f"\n  [{label} HANDS]")
        print(header)
        print("      " + "-" * 40)
        for total in player_totals:
            row = f"  {total:>3} |"
            for dealer_up in dealer_ups:
                key = f"{total}_{dealer_up}_{'S' if is_soft else 'H'}"
                w = brain_state.weights.get(key)
                if w is None:
                    row += "   ."
                else:
                    best = max(
                        [("H", w.hit), ("S", w.stand), ("D", w.double)],
                        key=lambda x: x[1],
                    )[0]
                    row += f"   {best}"
            print(row)

    print("\n  Legend: H=Hit  S=Stand  D=Double  .=No data yet")
    print(f"  Peak balance: ${brain_state.peak_balance}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Dexter RL Blackjack Agent")
    parser.add_argument("--mock", action="store_true", help="Use built-in game engine")
    parser.add_argument("--api-url", default="http://localhost:8080", help="Game server URL")
    parser.add_argument("--tables", type=int, default=4, help="Number of concurrent tables")
    parser.add_argument("--data-dir", default="data", help="Persistence directory")
    parser.add_argument("--balance", type=int, default=1000, help="Starting balance")
    parser.add_argument("--verbose", "-v", action="store_true", help="Debug logging")
    parser.add_argument("--fast", action="store_true", help="Zero delays for rapid mock training")
    parser.add_argument("--stats", action="store_true", help="Print Q-table strategy grid and exit")
    args = parser.parse_args()

    setup_logging(verbose=args.verbose)

    config = DexterConfig(
        api_base_url=args.api_url,
        num_tables=args.tables,
        data_dir=args.data_dir,
        initial_balance=args.balance,
    )

    if args.fast:
        config.deal_delay = 0.0
        config.hit_delay = 0.0
        config.round_pause = 0.0

    if args.stats:
        from .persistence import load_brain
        brain = load_brain(config)
        if brain is None:
            print("No brain state found. Run some training first.")
            return
        _print_qtable(brain)
        return

    if args.mock:
        client = MockGameClient(config)
    else:
        client = HttpGameClient(config)

    orchestrator = Orchestrator(client, config)
    asyncio.run(orchestrator.run())


if __name__ == "__main__":
    main()
