import socket
import ipaddress
from urllib.parse import urlparse

def validate_download_url(url: str) -> str:
    """
    Validates a URL to prevent SSRF attacks.
    Ensures the URL uses http/https, does not contain credentials,
    and resolves only to public, non-private IP addresses.
    """
    if not url:
        raise ValueError("URL cannot be empty")
        
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme}. Only http and https are allowed.")
        
    if not parsed.hostname:
        raise ValueError("URL must contain a valid hostname.")
        
    # Check for embedded credentials
    if parsed.username or parsed.password:
        raise ValueError("URLs containing embedded credentials are not allowed.")
        
    hostname = parsed.hostname.strip().lower()
    
    # Common internal/metadata server hostnames
    forbidden_hosts = {
        "localhost", 
        "metadata.google.internal", 
        "metadata", 
        "kubernetes.default",
        "kubernetes.default.svc",
        "kubernetes.default.svc.cluster.local"
    }
    if hostname in forbidden_hosts or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise ValueError(f"Access to internal or local hostname '{hostname}' is restricted.")
        
    # Resolve all IPs for the hostname and check them
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise ValueError(f"Failed to resolve hostname '{hostname}': {e}")
        
    for item in addr_info:
        ip_str = item[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
            if ip.is_loopback:
                raise ValueError(f"Access to loopback IP address {ip_str} is restricted.")
            if ip.is_private:
                raise ValueError(f"Access to private IP address {ip_str} is restricted.")
            if ip.is_link_local:
                raise ValueError(f"Access to link-local IP address {ip_str} is restricted.")
            if ip.is_multicast:
                raise ValueError(f"Access to multicast IP address {ip_str} is restricted.")
            if ip.is_reserved:
                raise ValueError(f"Access to reserved IP address {ip_str} is restricted.")
        except ValueError as e:
            # Re-raise our specific restriction errors
            if "restricted" in str(e):
                raise e
            # Ignore other IP address parsing errors (e.g. if resolved value is not a valid IP string)
            pass
            
    return url
