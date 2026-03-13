# dexter-rl

A Q-learning blackjack agent that plays multiple tables concurrently, learns from experience, and sizes bets using the Kelly criterion. Built around a Dexter's Laboratory theme — the agent talks like a child genius funding his lab through card counting.

Follow us on X: https://x.com/DexterLab_sol

2ptWTStnNrupaY3GjRjiHzmmVhUryZEUZ75ji82apum

## How it works

Dexter runs N async table instances simultaneously. Each round:

1. **Bet sizing** — Kelly criterion scales the bet based on observed win rate. During warmup (first 10 hands) a fixed conservative fraction is used.
2. **Action selection** — Epsilon-greedy over a Q-table keyed by `(player_total, dealer_upcard, soft/hard)`. Soft and hard hands are tracked separately so the agent can learn that soft-17 hits differently from hard-17.
3. **Weight update** — After each hand, a TD-style update pushes the chosen action's weight toward the received reward (+1 win, −1 loss, +1.5 blackjack, 0 push).
4. **Kill / respawn** — Table instances with ≥4 consecutive losses or <25% win rate after 5+ hands are terminated and replaced with fresh instances.
5. **Persistence** — Brain state and Q-table are saved to JSON every 10 hands and on clean shutdown.

## Actions

The agent chooses from three actions per decision point:

| Action | When available | Effect |
|--------|---------------|--------|
| Hit | Any turn | Draw one card |
| Stand | Any turn | End player turn |
| Double | First decision only (2 cards) | 2× bet, draw exactly one card, then stand |

## Install

Requires Python ≥ 3.11.

```bash
pip install -e ".[dev]"   # includes pytest for tests
```

## Usage

```bash
# Train offline with the built-in mock engine
python -m dexter_rl --mock

# Train fast (no delays, thousands of hands/minute)
python -m dexter_rl --mock --fast

# Connect to a real game server
python -m dexter_rl --api-url http://localhost:8080

# Run on 8 tables concurrently
python -m dexter_rl --mock --tables 8

# Print the learned strategy grid and exit
python -m dexter_rl --stats

# Verbose logging
python -m dexter_rl --mock -v
```

### `--stats` output

```
DEXTER Q-TABLE  |  hands=5000  win%=48.2%  eps=0.020  alpha=0.017

  [HARD HANDS]
        2   3   4   5   6   7   8   9  10   A
      ----------------------------------------
    8 |   H   H   H   H   H   H   H   H   H   H
    9 |   H   D   D   D   D   H   H   H   H   H
   10 |   D   D   D   D   D   D   D   D   H   H
   11 |   D   D   D   D   D   D   D   D   D   D
   12 |   H   H   S   S   S   H   H   H   H   H
   ...

  Legend: H=Hit  S=Stand  D=Double  .=No data yet
```

## Configuration

All knobs live in `DexterConfig` ([src/dexter_rl/config.py](src/dexter_rl/config.py)):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `num_tables` | 4 | Concurrent table instances |
| `initial_balance` | 1000 | Starting bankroll |
| `min_bet` | 10 | Floor bet |
| `initial_learning_rate` | 0.3 | TD learning rate α |
| `initial_exploration_rate` | 0.15 | Starting ε |
| `min_exploration_rate` | 0.02 | ε floor |
| `kelly_min / kelly_max` | 0.02 / 0.25 | Kelly fraction bounds |
| `kill_lose_streak` | 4 | Consecutive losses before table kill |
| `autosave_interval_hands` | 10 | How often to checkpoint |

## Project layout

```
src/dexter_rl/
├── brain.py          # Q-learning agent: decide_action, decide_bet, update_weights
├── orchestrator.py   # Async game loop, multi-table management
├── table.py          # Per-table state and kill logic
├── models.py         # Card, BrainState, ActionWeights, hand helpers
├── config.py         # DexterConfig dataclass
├── commentary.py     # Dexter-flavoured log lines
├── persistence.py    # JSON save/load for brain state and Q-table
├── __main__.py       # CLI entry point
└── api/
    ├── client.py     # Abstract GameClient + HTTP SSE implementation
    ├── mock.py       # Self-contained blackjack engine (no server needed)
    └── events.py     # SSE event dataclasses

tests/
├── test_models.py    # hand_value, is_soft_hand, is_blackjack, ...
├── test_brain.py     # basic strategy, Kelly bounds, weight updates
└── test_mock.py      # mock engine integration (deal, hit, stand, double)
```

## Running tests

```bash
pytest
```

60 tests, all async-compatible via `pytest-asyncio`.

## Real server API contract

The HTTP client speaks a simple SSE + REST protocol:

```
POST /join    {"slot": int}                          → TableAssigned (SSE)
POST /leave   {"table_id": str}                      → 200 OK
POST /bet     {"table_id": str, "amount": int}       → BetAccepted + DealEvent (SSE)
POST /action  {"table_id": str, "action": str}       → CardDealt / DealerReveal + RoundResultEvent (SSE)
```

The mock engine in `api/mock.py` implements the same contract locally so the full training loop runs without a server.
