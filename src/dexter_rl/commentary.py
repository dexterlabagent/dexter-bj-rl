from __future__ import annotations

import random

from .models import BrainState, RoundResult
from .table import TableInstance


def _pick(options: list[str]) -> str:
    return random.choice(options)


def _win_rate_str(brain: BrainState) -> str:
    decided = brain.wins + brain.losses
    if decided > 0:
        return f"{brain.wins / decided * 100:.1f}"
    return "N/A"


def commentary_bet(table_name: str, bet: int, balance: int, brain: BrainState) -> list[str]:
    kelly_info = (
        f"Kelly={bet / balance * 100:.1f}%" if brain.total_hands >= 10 else "warmup"
    )
    return [f"[{table_name}] Placing bet ${bet} ({kelly_info})"]


def commentary_action(
    table_name: str,
    player_total: int,
    dealer_up: int,
    action: str,
    explored: bool,
    brain: BrainState,
    drawn_card_str: str | None = None,
    new_total: int | None = None,
    is_soft: bool = False,
) -> list[str]:
    lines: list[str] = []
    soft_tag = "S" if is_soft else "H"
    key = f"[{player_total},{dealer_up},{soft_tag}]"

    if explored:
        lines.append(
            f"[{table_name}] {_pick([
                f'epsilon-greedy exploration at {key}. Random {action.upper()}.',
                f'Exploring {key}. {action.upper()}. Need more samples.',
            ])}"
        )
    else:
        lookup = f"{player_total}_{dealer_up}_{'S' if is_soft else 'H'}"
        w = brain.weights.get(lookup)
        if w:
            total = w.hit + w.stand + w.double
            if action == "hit":
                p = w.hit / total if total > 0 else 0.0
            elif action == "stand":
                p = w.stand / total if total > 0 else 0.0
            else:
                p = w.double / total if total > 0 else 0.0
            lines.append(f"[{table_name}] {key} -> {action.upper()} (p={p:.2f})")
        else:
            lines.append(f"[{table_name}] {key} -> {action.upper()}")

    if action == "double":
        lines.append(
            f"[{table_name}] {_pick([
                f'DOUBLE DOWN at {key}. 2x bet committed. No going back.',
                f'DOUBLE at {key}. The math checks out. Probably.',
                f'DOUBLE at {key}! Maximum risk. Maximum reward.',
            ])}"
        )
        if drawn_card_str:
            lines.append(f"[{table_name}] Drew {drawn_card_str} -> {new_total}")
            if new_total is not None and new_total > 21:
                lines.append(
                    f"[{table_name}] {_pick([
                        'BUST on double. Lost 2x. This is unacceptable.',
                        f'BUST at {new_total} on double. The math did NOT check out.',
                    ])}"
                )
    elif action == "hit" and drawn_card_str:
        lines.append(f"[{table_name}] Drew {drawn_card_str} -> {new_total}")
        if new_total is not None and new_total > 21:
            lines.append(
                f"[{table_name}] {_pick([
                    'BUST. reward=-1',
                    f'BUST at {new_total}. Weights need adjusting.',
                    f'BUST at {new_total}. DEE DEE! Did you touch my RNG?!',
                ])}"
            )

    return lines


def commentary_result(
    table_name: str,
    result: RoundResult,
    balance: int,
    balance_before: int,
    brain: BrainState,
    dealer_total: int,
) -> list[str]:
    lines: list[str] = []
    delta = balance - balance_before
    win_rate = _win_rate_str(brain)
    reward = {
        RoundResult.PLAYER_BLACKJACK: 1.5,
        RoundResult.PLAYER_WIN: 1.0,
        RoundResult.DEALER_BUST: 1.0,
        RoundResult.DEALER_WIN: -1.0,
        RoundResult.PLAYER_BUST: -1.0,
        RoundResult.PUSH: 0.0,
    }[result]

    lines.append(f"[{table_name}] Dealer total: {dealer_total}")

    if result in (RoundResult.PLAYER_WIN, RoundResult.DEALER_BUST):
        lines.append(
            f"[{table_name}] {_pick([
                f'WIN +${abs(delta)}. reward={reward}. Q-table updated.',
                f'Win. +${abs(delta)}. Global win rate: {win_rate}%',
            ])}"
        )
    elif result == RoundResult.PLAYER_BLACKJACK:
        lines.append(
            f"[{table_name}] {_pick([
                f'BLACKJACK! +${abs(delta)}. reward=+1.5',
                f'Natural 21. P(deal BJ)=0.048. I am the 4.8%.',
                f'BLACKJACK! Omelette du fromage!',
            ])}"
        )
    elif result in (RoundResult.DEALER_WIN, RoundResult.PLAYER_BUST):
        lines.append(
            f"[{table_name}] {_pick([
                f'LOSS -${abs(delta)}. reward={reward}. Win rate: {win_rate}%',
                f'Lost. -${abs(delta)}. {brain.total_hands} hands played. Need more data.',
                f'LOSS -${abs(delta)}. If I lose Claude Max I will have to use... *shudders* ...GPT.',
            ])}"
        )
    elif result == RoundResult.PUSH:
        lines.append(f"[{table_name}] Push. reward=0. No weight update.")

    sign = "+" if delta >= 0 else ""
    lines.append(f"[{table_name}] Balance: ${balance_before} -> ${balance} ({sign}${delta})")

    if balance <= 50 and balance > 0:
        lines.append(
            f"[{table_name}] {_pick([
                f'WARNING: ${balance} remaining. P(ruin) approaching 1.0.',
                f'${balance} left. Claude sub costs $200. Maybe Mandark will lend me money...',
            ])}"
        )

    if balance <= 0:
        lines.append(
            _pick([
                "BANKRUPT. All instances halted. Claude Max: cancelled.",
                "Balance $0. Algorithm diverged. System shutdown.",
                "Balance depleted. Switching to Mandark's inferior AI assistant...",
            ])
        )

    # Epoch milestone every 10 hands
    if brain.total_hands > 0 and brain.total_hands % 10 == 0:
        lines.append(
            f"--- Epoch {brain.total_hands}: Win%={win_rate} "
            f"eps={brain.exploration_rate:.3f} alpha={brain.learning_rate:.3f} "
            f"Peak=${brain.peak_balance} ---"
        )

    return lines


def commentary_kill(
    old_name: str, new_name: str, table: TableInstance, reason: str
) -> list[str]:
    return [
        f"[{old_name}] TERMINATING. Reason: {reason}. This instance is WORTHLESS.",
        _pick([
            f"[{old_name}] Process killed. PID recycled. You were a FAILURE, {old_name}.",
            f"[{old_name}] rm -rf {old_name}/ && echo 'Good riddance.' Uninstalling...",
            f"[{old_name}] Instance terminated. Even Dee Dee writes better algorithms than this.",
            f"[{old_name}] kill -9 {old_name}. Your weights were garbage. GARBAGE!",
        ]),
        _pick([
            f"[{new_name}] Spawning replacement instance... Initializing fresh weights...",
            f"[{new_name}] Booting new instance. You'd BETTER perform, {new_name}.",
            f"[{new_name}] New process spawned. Clean slate. Superior genetics. Let's GO.",
            f"[{new_name}] Rising from the ashes of {old_name}. I won't make the same mistakes.",
        ]),
    ]


def commentary_boot(table_names: str, balance: int) -> list[str]:
    return [
        "DEXTER-OS v3.7.1 | Blackjack RL Agent loaded.",
        f"Objective: Fund Claude Max ($200/mo). Starting balance: ${balance}.",
        "Q-table initialized from basic strategy prior.",
        f"Spawning instances: {table_names}",
        "Instances below 25% win rate or 4-loss streak will be killed and replaced.",
        "Beginning training loop...",
    ]


def commentary_bankruptcy() -> list[str]:
    return [
        "CRITICAL: Balance depleted. Rebooting financial subsystem in 10 seconds...",
        "Dexter: This is merely a setback. I am a GENIUS. Recalibrating...",
    ]


def commentary_reboot(balance: int) -> list[str]:
    return [
        "--- SYSTEM REBOOT ---",
        f"Balance reset to ${balance}. Q-table preserved. Starting fresh.",
        "Dexter: Round 2. This time my algorithm is FLAWLESS.",
    ]
