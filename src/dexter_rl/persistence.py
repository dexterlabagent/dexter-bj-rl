from __future__ import annotations

import json
from pathlib import Path

from .models import ActionWeights, BrainState
from .config import DexterConfig


def save_brain(brain: BrainState, config: DexterConfig) -> None:
    data_dir = Path(config.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    brain_data = {
        "total_hands": brain.total_hands,
        "wins": brain.wins,
        "losses": brain.losses,
        "pushes": brain.pushes,
        "blackjacks": brain.blackjacks,
        "win_streak": brain.win_streak,
        "lose_streak": brain.lose_streak,
        "peak_balance": brain.peak_balance,
        "learning_rate": brain.learning_rate,
        "exploration_rate": brain.exploration_rate,
        "iteration": brain.iteration,
    }

    with open(data_dir / config.brain_file, "w") as f:
        json.dump(brain_data, f, indent=2)

    weights_data = {k: {"hit": v.hit, "stand": v.stand, "double": v.double} for k, v in brain.weights.items()}

    with open(data_dir / config.qtable_file, "w") as f:
        json.dump(weights_data, f, indent=2)


def load_brain(config: DexterConfig) -> BrainState | None:
    data_dir = Path(config.data_dir)
    brain_path = data_dir / config.brain_file
    qtable_path = data_dir / config.qtable_file

    if not brain_path.exists():
        return None

    with open(brain_path) as f:
        d = json.load(f)

    weights: dict[str, ActionWeights] = {}
    if qtable_path.exists():
        with open(qtable_path) as f:
            raw = json.load(f)
            weights = {
                k: ActionWeights(hit=v["hit"], stand=v["stand"], double=v.get("double", 0.0))
                for k, v in raw.items()
            }

    return BrainState(
        weights=weights,
        total_hands=d["total_hands"],
        wins=d["wins"],
        losses=d["losses"],
        pushes=d["pushes"],
        blackjacks=d["blackjacks"],
        win_streak=d["win_streak"],
        lose_streak=d["lose_streak"],
        peak_balance=d["peak_balance"],
        learning_rate=d["learning_rate"],
        exploration_rate=d["exploration_rate"],
        iteration=d["iteration"],
    )
