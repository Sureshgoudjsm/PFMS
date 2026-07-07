# In-memory store for active Telegram linking codes
# Format: { "CODE": (user_id, expiration_timestamp) }
active_linking_codes: dict[str, tuple[int, float]] = {}
