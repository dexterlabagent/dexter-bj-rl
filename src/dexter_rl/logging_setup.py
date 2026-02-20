import logging
import sys


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(message)s",
        datefmt="%H:%M:%S",
    ))
    root = logging.getLogger("dexter")
    root.setLevel(level)
    root.addHandler(handler)
