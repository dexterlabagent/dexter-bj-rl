from dataclasses import dataclass


@dataclass
class DexterConfig:
    # API
    api_base_url: str = "http://localhost:8080"
    sse_endpoint: str = "/events"
    bet_endpoint: str = "/bet"
    action_endpoint: str = "/action"

    # Tables
    num_tables: int = 4
    initial_balance: int = 1000
    min_bet: int = 10

    # Q-Learning
    initial_learning_rate: float = 0.3
    initial_exploration_rate: float = 0.15
    min_exploration_rate: float = 0.02
    learning_rate_decay: float = 0.01
    exploration_rate_decay: float = 0.005

    # Kelly criterion
    kelly_min: float = 0.02
    kelly_max: float = 0.25
    kelly_warmup_hands: int = 10
    kelly_warmup_fraction: float = 0.05

    # Kill / respawn
    kill_lose_streak: int = 4
    kill_min_hands: int = 5
    kill_win_rate_threshold: float = 0.25

    # Deck
    reshuffle_threshold: int = 15

    # Persistence
    data_dir: str = "data"
    brain_file: str = "brain_state.json"
    qtable_file: str = "qtable.json"
    autosave_interval_hands: int = 10

    # Timing (seconds)
    deal_delay: float = 0.3
    hit_delay: float = 0.5
    round_pause: float = 2.0
