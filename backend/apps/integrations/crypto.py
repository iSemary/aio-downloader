import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    raw = (settings.ENCRYPTION_KEY or "").strip()
    if raw:
        key_b = raw.encode() if isinstance(raw, str) else raw
        if len(key_b) == 44:
            return Fernet(key_b)
        digest = hashlib.sha256(key_b).digest()
        key_b = base64.urlsafe_b64encode(digest)
        return Fernet(key_b)
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    key_b = base64.urlsafe_b64encode(digest)
    return Fernet(key_b)


def encrypt_str(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_str(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
