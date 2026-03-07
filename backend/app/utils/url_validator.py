"""
URL Validation Utility — SSRF Prevention

Enterprise security: Validates user-supplied URLs to prevent Server-Side Request
Forgery (SSRF) attacks. Used by all modules that make backend HTTP requests to
user-specified URLs.

Compliance: SEC-INPUT-004 | SOC2(CC6.1) | FedRAMP(SI-10) | PCI(Req.6.2) | ISO(A.8.28)

Usage:
    from app.utils.url_validator import validate_url, is_url_safe, sanitize_url_for_logging

    # Raises ValueError if URL is unsafe
    validate_url(user_url)

    # Returns bool
    if is_url_safe(user_url):
        ...

    # Safe logging (strips query params)
    logger.info(f"Scanning: {sanitize_url_for_logging(user_url)}")
"""

import ipaddress
import logging
import re
import socket
from typing import List, Optional, Set
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Private/internal IP ranges that MUST be blocked
_BLOCKED_IP_RANGES = [
    ipaddress.ip_network("0.0.0.0/8"),        # "This" network
    ipaddress.ip_network("10.0.0.0/8"),        # Private (Class A)
    ipaddress.ip_network("100.64.0.0/10"),     # Shared address space (CGN)
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("169.254.0.0/16"),    # Link-local (AWS metadata!)
    ipaddress.ip_network("172.16.0.0/12"),     # Private (Class B)
    ipaddress.ip_network("192.0.0.0/24"),      # IETF protocol assignments
    ipaddress.ip_network("192.0.2.0/24"),      # TEST-NET-1
    ipaddress.ip_network("192.168.0.0/16"),    # Private (Class C)
    ipaddress.ip_network("198.18.0.0/15"),     # Benchmark testing
    ipaddress.ip_network("198.51.100.0/24"),   # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),    # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),       # Multicast
    ipaddress.ip_network("240.0.0.0/4"),       # Reserved
    ipaddress.ip_network("255.255.255.255/32"),# Broadcast
]

# IPv6 blocked ranges
_BLOCKED_IPV6_RANGES = [
    ipaddress.ip_network("::1/128"),           # Loopback
    ipaddress.ip_network("::/128"),            # Unspecified
    ipaddress.ip_network("::ffff:0:0/96"),     # IPv4-mapped (check underlying IPv4)
    ipaddress.ip_network("fc00::/7"),          # Unique local
    ipaddress.ip_network("fe80::/10"),         # Link-local
    ipaddress.ip_network("ff00::/8"),          # Multicast
]

# Blocked hostnames (case-insensitive)
_BLOCKED_HOSTNAMES: Set[str] = {
    "localhost",
    "localhost.localdomain",
    "metadata",
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
    "kubernetes",
    "kubernetes.default",
    "kubernetes.default.svc",
}

# Allowed URL schemes
_ALLOWED_SCHEMES = {"http", "https"}

# Blocked schemes that could bypass protections
_BLOCKED_SCHEMES = {
    "file", "ftp", "gopher", "data", "javascript",
    "vbscript", "jar", "netdoc", "mailto", "tel",
}

# Maximum redirect depth
MAX_REDIRECT_DEPTH = 3


def _is_ip_blocked(ip_str: str) -> bool:
    """Check if an IP address falls within a blocked range."""
    try:
        ip = ipaddress.ip_address(ip_str)

        # Check IPv4 ranges
        if isinstance(ip, ipaddress.IPv4Address):
            for network in _BLOCKED_IP_RANGES:
                if ip in network:
                    return True

        # Check IPv6 ranges
        elif isinstance(ip, ipaddress.IPv6Address):
            for network in _BLOCKED_IPV6_RANGES:
                if ip in network:
                    return True

            # Also check IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
            if ip.ipv4_mapped:
                return _is_ip_blocked(str(ip.ipv4_mapped))

        return False
    except ValueError:
        return False


def _resolve_hostname(hostname: str) -> List[str]:
    """Resolve a hostname to IP addresses for validation."""
    try:
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        return list(set(addr[4][0] for addr in results))
    except (socket.gaierror, socket.herror, OSError):
        return []


def validate_url(
    url: str,
    allow_private: bool = False,
    allowed_domains: Optional[List[str]] = None,
    resolve_dns: bool = True,
) -> str:
    """
    Validate a URL for safety against SSRF attacks.

    Args:
        url: The URL to validate
        allow_private: If True, allows private IP ranges (for dev/testing only)
        allowed_domains: Optional whitelist of allowed domains
        resolve_dns: If True, resolves hostname to check IP (recommended)

    Returns:
        The validated URL (normalized)

    Raises:
        ValueError: If the URL is unsafe
    """
    if not url or not isinstance(url, str):
        raise ValueError("URL must be a non-empty string")

    url = url.strip()

    # Basic length check
    if len(url) > 2048:
        raise ValueError("URL exceeds maximum length (2048 characters)")

    # Parse URL
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Invalid URL format")

    # Validate scheme
    scheme = (parsed.scheme or "").lower()
    if scheme in _BLOCKED_SCHEMES:
        raise ValueError(f"URL scheme '{scheme}' is not allowed")
    if scheme not in _ALLOWED_SCHEMES:
        raise ValueError(f"URL scheme must be http or https, got '{scheme}'")

    # Validate hostname exists
    hostname = (parsed.hostname or "").lower().strip(".")
    if not hostname:
        raise ValueError("URL must contain a hostname")

    # Check against blocked hostnames
    if hostname in _BLOCKED_HOSTNAMES:
        raise ValueError(f"Hostname '{hostname}' is blocked (internal/reserved)")

    # Check for numeric IP bypass attempts (e.g., 0x7f000001, 2130706433)
    _check_ip_obfuscation(hostname)

    # Check if hostname is a direct IP address
    try:
        ip = ipaddress.ip_address(hostname)
        if not allow_private and _is_ip_blocked(str(ip)):
            raise ValueError(f"IP address {hostname} is in a blocked range (private/internal)")
    except ValueError as e:
        if "blocked range" in str(e):
            raise
        # Not an IP address — it's a domain name, continue validation

    # Validate port (block common internal service ports)
    port = parsed.port
    if port is not None:
        _BLOCKED_PORTS = {
            25, 110, 143, 465, 587, 993, 995,  # Mail
            6379, 6380,                          # Redis
            27017, 27018,                        # MongoDB
            3306,                                # MySQL
            5432,                                # PostgreSQL
            9200, 9300,                          # Elasticsearch
            2181, 2888, 3888,                    # Zookeeper
            11211,                               # Memcached
            5672, 15672,                         # RabbitMQ
            8500, 8600,                          # Consul
            2379, 2380,                          # etcd
        }
        # Only block these ports for private IPs or localhost
        # For public URLs, any port is fine
        try:
            ip_check = ipaddress.ip_address(hostname)
            if _is_ip_blocked(str(ip_check)) and port in _BLOCKED_PORTS:
                raise ValueError(f"Port {port} is blocked for internal addresses")
        except ValueError:
            pass  # Not an IP, port check via DNS below

    # Check against allowed domains whitelist (if provided)
    if allowed_domains:
        domain_match = False
        for allowed in allowed_domains:
            allowed = allowed.lower().strip(".")
            if hostname == allowed or hostname.endswith("." + allowed):
                domain_match = True
                break
        if not domain_match:
            raise ValueError(
                f"Domain '{hostname}' is not in the allowed domains list"
            )

    # DNS resolution check (catch DNS rebinding attacks)
    if resolve_dns and not allow_private:
        resolved_ips = _resolve_hostname(hostname)
        for ip_str in resolved_ips:
            if _is_ip_blocked(ip_str):
                raise ValueError(
                    f"Hostname '{hostname}' resolves to blocked IP {ip_str}"
                )

    # Check for URL containing credentials (user:pass@host)
    if parsed.username or parsed.password:
        logger.warning(
            f"URL contains embedded credentials for host: {sanitize_url_for_logging(url)}"
        )

    return url


def _check_ip_obfuscation(hostname: str):
    """Detect obfuscated IP addresses (hex, octal, decimal encoding)."""
    # Hex encoding: 0x7f000001
    if hostname.startswith("0x"):
        try:
            ip_int = int(hostname, 16)
            ip = ipaddress.IPv4Address(ip_int)
            if _is_ip_blocked(str(ip)):
                raise ValueError(f"Hex-encoded IP {hostname} resolves to blocked address {ip}")
        except (ValueError, ipaddress.AddressValueError):
            pass

    # Decimal encoding: 2130706433
    if hostname.isdigit():
        try:
            ip_int = int(hostname)
            if 0 < ip_int < 2**32:
                ip = ipaddress.IPv4Address(ip_int)
                if _is_ip_blocked(str(ip)):
                    raise ValueError(f"Decimal-encoded IP {hostname} resolves to blocked address {ip}")
        except (ValueError, ipaddress.AddressValueError):
            pass

    # Octal encoding: 0177.0.0.1
    if re.match(r"^0\d", hostname):
        try:
            parts = hostname.split(".")
            if len(parts) == 4:
                octets = [int(p, 8) if p.startswith("0") else int(p) for p in parts]
                ip_str = ".".join(str(o) for o in octets)
                ip = ipaddress.IPv4Address(ip_str)
                if _is_ip_blocked(str(ip)):
                    raise ValueError(f"Octal-encoded IP {hostname} resolves to blocked address")
        except (ValueError, ipaddress.AddressValueError):
            pass


def is_url_safe(
    url: str,
    allow_private: bool = False,
    allowed_domains: Optional[List[str]] = None,
) -> bool:
    """
    Check if a URL is safe (non-raising version of validate_url).

    Returns:
        True if the URL is safe, False otherwise
    """
    try:
        validate_url(url, allow_private=allow_private, allowed_domains=allowed_domains)
        return True
    except (ValueError, Exception):
        return False


def sanitize_url_for_logging(url: str) -> str:
    """
    Remove sensitive parts of a URL for safe logging.

    Strips: query parameters, fragments, userinfo (user:pass@)
    Keeps: scheme, host, port, path
    """
    try:
        parsed = urlparse(url)
        # Reconstruct without query, fragment, or credentials
        safe = f"{parsed.scheme}://{parsed.hostname or ''}"
        if parsed.port:
            safe += f":{parsed.port}"
        if parsed.path:
            safe += parsed.path
        return safe
    except Exception:
        return "[INVALID_URL]"


def validate_webhook_url(url: str) -> str:
    """
    Stricter validation for webhook URLs.

    Webhooks MUST use HTTPS (no HTTP) and cannot target internal services.
    """
    validated = validate_url(url, allow_private=False, resolve_dns=True)

    parsed = urlparse(validated)
    if parsed.scheme != "https":
        raise ValueError("Webhook URLs must use HTTPS")

    return validated
