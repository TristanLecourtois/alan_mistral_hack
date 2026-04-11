import logging
import sys

# ANSI colors
RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
MAGENTA= "\033[95m"
DIM    = "\033[2m"

class ColorFormatter(logging.Formatter):
    LEVEL_COLORS = {
        logging.DEBUG:    DIM,
        logging.INFO:     CYAN,
        logging.WARNING:  YELLOW,
        logging.ERROR:    RED,
        logging.CRITICAL: RED + BOLD,
    }

    def format(self, record):
        color = self.LEVEL_COLORS.get(record.levelno, RESET)
        level = f"{color}{record.levelname:<8}{RESET}"
        name  = f"{DIM}{record.name}{RESET}"
        msg   = record.getMessage()
        return f"{level} {name} » {msg}"


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(ColorFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)
        logger.propagate = False
    return logger


def log_separator(title: str = ""):
    line = "─" * 60
    if title:
        print(f"\n{BOLD}{MAGENTA}┌{line}┐{RESET}")
        print(f"{BOLD}{MAGENTA}│  {title:<58}│{RESET}")
        print(f"{BOLD}{MAGENTA}└{line}┘{RESET}\n")
    else:
        print(f"{DIM}{line}{RESET}")


def log_value(label: str, value, status: str = ""):
    icons = {"ok": f"{GREEN}✓{RESET}", "warn": f"{YELLOW}⚠{RESET}", "alert": f"{RED}✗{RESET}", "": "·"}
    icon = icons.get(status, "·")
    print(f"  {icon} {BOLD}{label:<25}{RESET} {value}")
